import { eq } from 'drizzle-orm';

import { skipMission } from '@/db/repositories/completion';
import {
  hasHealthMissions,
  healthMissionsToRead,
  recordHealthValue,
} from '@/db/repositories/health';
import { archiveMission, createMission, updateMission } from '@/db/repositories/missions';
import { createProfile } from '@/db/repositories/onboarding';
import { undoEvent } from '@/db/repositories/undo';
import { events, missionDays } from '@/db/schema';
import type { Db } from '@/db/types';

import { createTestDb } from '../../../test/db';

/** An instant in Rome (UTC+1 in November) on a day of November 2026. */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);
const FRIDAY = 13;
const clock = (hour: number, day = FRIDAY) => ({ now: at(day, hour), tzOffset: 60 });

const STEPS = { type: 'quantity', target: 8000, unit: 'step', increment: 1000 } as const;

function newGame(): Db {
  const db = createTestDb();
  createProfile(
    db,
    { name: 'Claudio', language: 'it', theme: 'minimal', templateKeys: ['steps'] },
    clock(9),
  );
  return db;
}

function walk(db: Db, healthMetric: 'steps' | null = 'steps') {
  return createMission(db, { name: 'Cammina', goal: STEPS, healthMetric }, clock(9)).id;
}

function dayRow(db: Db, missionId: string) {
  return db.select().from(missionDays).where(eq(missionDays.missionId, missionId)).get();
}

describe('linking a mission to the health data', () => {
  it('needs a quantity goal in the unit of the metric', () => {
    const db = newGame();
    expect(() => createMission(db, { name: 'Cammina', healthMetric: 'steps' }, clock(9))).toThrow(
      RangeError,
    );
    expect(() =>
      createMission(
        db,
        { name: 'Cammina', goal: { ...STEPS, unit: 'km' }, healthMetric: 'steps' },
        clock(9),
      ),
    ).toThrow(RangeError);
    const id = walk(db);
    expect(() => updateMission(db, id, { healthMetric: 'sleep_hours' }, clock(10))).toThrow(
      RangeError,
    );
    expect(updateMission(db, id, { healthMetric: null }, clock(10)).healthMetric).toBeNull();
  });
});

describe('hasHealthMissions', () => {
  it('is true while a mission not archived is linked', () => {
    const db = newGame();
    expect(hasHealthMissions(db)).toBe(false);
    const id = walk(db);
    expect(hasHealthMissions(db)).toBe(true);
    archiveMission(db, id, clock(10));
    expect(hasHealthMissions(db)).toBe(false);
  });
});

describe('healthMissionsToRead', () => {
  it('lists the linked missions of today still to do, with their metric', () => {
    const db = newGame();
    const linked = walk(db);
    walk(db, null);
    // The template «steps» of the first launch is not linked: the permission is asked only in the
    // editor (design 12.7).
    expect(healthMissionsToRead(db, clock(10))).toEqual([
      {
        missionId: linked,
        metric: 'steps',
        day: '2026-11-13',
        dayChange: '06:00',
        value: 0,
        name: 'Cammina',
        target: 8000,
        unit: 'step',
      },
    ]);
  });

  it('leaves out the missions done or skipped today', () => {
    const db = newGame();
    const done = walk(db);
    const skipped = walk(db);
    recordHealthValue(db, { missionId: done, value: 8000, ...clock(10) });
    skipMission(db, { missionId: skipped, reason: 'rest', ...clock(10) });
    expect(healthMissionsToRead(db, clock(11))).toEqual([]);
  });
});

describe('recordHealthValue', () => {
  it('moves the mission to the value read, with the source «health»', () => {
    const db = newGame();
    const id = walk(db);
    const result = recordHealthValue(db, { missionId: id, value: 6200, ...clock(10) });
    expect(result?.status).toBe('progressed');
    expect(dayRow(db, id)).toMatchObject({ status: 'partial', value: 6200, source: 'health' });
    const event = db.select().from(events).where(eq(events.type, 'mission.progressed')).get();
    // The key ends with the events of the mission that day before it: here its creation.
    expect(event).toMatchObject({ source: 'health', idemKey: `health:${id}|2026-11-13|6200|1` });

    // A later reading adds only the difference.
    recordHealthValue(db, { missionId: id, value: 7000, ...clock(11) });
    expect(dayRow(db, id)?.value).toBe(7000);
  });

  it('records the same reading again after an undo brought the value back', () => {
    const db = newGame();
    const id = walk(db);
    const first = recordHealthValue(db, { missionId: id, value: 8100, ...clock(10) });
    expect(first?.status).toBe('completed');
    // The same reading twice (the app and the background task) still counts once.
    expect(recordHealthValue(db, { missionId: id, value: 8100, ...clock(10) })).toBeNull();
    undoEvent(db, first!.completion!.eventId, clock(11));
    expect(dayRow(db, id)?.value ?? 0).toBe(0);

    const again = recordHealthValue(db, { missionId: id, value: 8100, ...clock(12) });
    expect(again?.status).toBe('completed');
    expect(dayRow(db, id)).toMatchObject({ status: 'done', value: 8100 });
  });

  it('does nothing when the reading is not higher than the value of the day', () => {
    const db = newGame();
    const id = walk(db);
    recordHealthValue(db, { missionId: id, value: 6200, ...clock(10) });
    expect(recordHealthValue(db, { missionId: id, value: 6200, ...clock(11) })).toBeNull();
    expect(recordHealthValue(db, { missionId: id, value: 5000, ...clock(11) })).toBeNull();
    expect(dayRow(db, id)?.value).toBe(6200);
  });

  it('completes the mission once when the goal is reached', () => {
    const db = newGame();
    const id = walk(db);
    const first = recordHealthValue(db, { missionId: id, value: 8100, ...clock(10) });
    expect(first?.status).toBe('completed');
    expect(first?.completion?.xp).toBeGreaterThan(0);
    expect(recordHealthValue(db, { missionId: id, value: 9500, ...clock(12) })).toBeNull();
    const completions = db.select().from(events).where(eq(events.type, 'mission.completed')).all();
    expect(completions).toHaveLength(1);
    expect(completions[0].source).toBe('health');
  });

  it('counts the same reading once, even from two readers at the same time', () => {
    const db = newGame();
    const id = walk(db);
    recordHealthValue(db, { missionId: id, value: 3000, ...clock(10) });
    // The background task read 6200 a moment before the app wrote the same reading.
    expect(recordHealthValue(db, { missionId: id, value: 6200, ...clock(10) })?.status).toBe(
      'progressed',
    );
    expect(recordHealthValue(db, { missionId: id, value: 6200, ...clock(10) })).toBeNull();
    expect(dayRow(db, id)?.value).toBe(6200);
  });

  it('ignores a reading of a game day already over', () => {
    const db = newGame();
    const id = walk(db);
    expect(
      recordHealthValue(db, { missionId: id, value: 9000, day: '2026-11-12', ...clock(10) }),
    ).toBeNull();
    expect(dayRow(db, id)).toBeUndefined();
  });

  it('refuses a mission that is not linked', () => {
    const db = newGame();
    const id = walk(db, null);
    expect(() => recordHealthValue(db, { missionId: id, value: 100, ...clock(10) })).toThrow(
      RangeError,
    );
  });
});
