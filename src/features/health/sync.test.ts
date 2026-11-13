import { eq } from 'drizzle-orm';

import { createMission } from '@/db/repositories/missions';
import { createProfile } from '@/db/repositories/onboarding';
import { setSetting } from '@/db/repositories/settings';
import { events, missionDays } from '@/db/schema';
import type { Db } from '@/db/types';
import type { NotificationText } from '@/features/notifications/texts';
import { formatAmount } from '@/features/shared/amount';

import { createTestDb } from '../../../test/db';
import { createFakeHealthSource } from '../../../test/health';
import { NO_HEALTH } from './source';
import { syncHealth, type HealthNotifier } from './sync';

/** An instant in Rome (UTC+1 in November) on 13 November 2026. */
const at = (hour: number, minute = 0) => Date.UTC(2026, 10, 13, hour - 1, minute);
const clockAt =
  (hour: number, minute = 0) =>
  () => ({ now: at(hour, minute), tzOffset: 60 });

const STEPS = { type: 'quantity', target: 8000, unit: 'step', increment: 1000 } as const;

function newGame(): { db: Db; walk: string } {
  const db = createTestDb();
  createProfile(
    db,
    { name: 'Claudio', language: 'it', theme: 'minimal', templateKeys: ['gym'] },
    clockAt(9)(),
  );
  const walk = createMission(
    db,
    { name: 'Cammina', goal: STEPS, healthMetric: 'steps' },
    clockAt(9)(),
  ).id;
  return { db, walk };
}

function fakeNotifier() {
  const sent: { text: NotificationText; fireAt: number; now: number }[] = [];
  const notifier: HealthNotifier = {
    notify: async (text, fireAt, now) => {
      sent.push({ text, fireAt, now });
    },
  };
  return { notifier, sent };
}

function value(db: Db, missionId: string) {
  return db.select().from(missionDays).where(eq(missionDays.missionId, missionId)).get();
}

describe('syncHealth', () => {
  it('moves a linked mission to the value read since the start of the day', async () => {
    const { db, walk } = newGame();
    const source = createFakeHealthSource();
    source.readings.steps = 6200.6;
    const outcomes = await syncHealth(db, source, clockAt(15));
    expect(outcomes.map((outcome) => outcome.result.status)).toEqual(['progressed']);
    expect(value(db, walk)).toMatchObject({ status: 'partial', value: 6200, source: 'health' });
    // The game day starts at 06:00 in Rome, 05:00 UTC.
    expect(source.reads[0].window).toEqual({ start: Date.UTC(2026, 10, 13, 5), end: at(15) });
  });

  it('completes the mission once and sends «Obiettivo raggiunto» with the XP', async () => {
    const { db, walk } = newGame();
    const source = createFakeHealthSource();
    const { notifier, sent } = fakeNotifier();
    source.readings.steps = 8000;
    const first = await syncHealth(db, source, clockAt(15), { notifier });
    expect(first[0].result.status).toBe('completed');
    source.readings.steps = 9100;
    expect(await syncHealth(db, source, clockAt(16), { notifier })).toEqual([]);
    expect(value(db, walk)?.status).toBe('done');
    const completions = db.select().from(events).where(eq(events.type, 'mission.completed')).all();
    expect(completions).toHaveLength(1);
    expect(sent).toHaveLength(1);
    const xp = first[0].result.completion?.xp;
    expect(sent[0].text).toEqual({
      title: 'Cammina',
      body: `Obiettivo raggiunto: ${formatAmount(8000, 'step', 'it')} · +${xp} XP`,
    });
    expect(sent[0].fireAt).toBe(at(15));
  });

  it('keeps the notification until «Non disturbare» is over', async () => {
    const { db } = newGame();
    setSetting(db, 'quiet_hours', [{ start: '22:00', end: '07:00' }], at(9));
    const source = createFakeHealthSource();
    const { notifier, sent } = fakeNotifier();
    source.readings.steps = 8000;
    await syncHealth(db, source, clockAt(23, 30), { notifier });
    expect(sent).toHaveLength(1);
    expect(sent[0].now).toBe(at(23, 30));
    // 07:00 of the next morning in Rome.
    expect(sent[0].fireAt).toBe(Date.UTC(2026, 10, 14, 6));
  });

  it('leaves the mission to do by hand when the permission is denied', async () => {
    const { db, walk } = newGame();
    const source = createFakeHealthSource();
    source.permissions.steps = 'denied';
    source.readings.steps = 9000;
    const { notifier, sent } = fakeNotifier();
    expect(await syncHealth(db, source, clockAt(15), { notifier })).toEqual([]);
    expect(value(db, walk)).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it('reads nothing on a phone without health data', async () => {
    const { db, walk } = newGame();
    expect(await syncHealth(db, NO_HEALTH, clockAt(15))).toEqual([]);
    expect(value(db, walk)).toBeUndefined();
  });
});
