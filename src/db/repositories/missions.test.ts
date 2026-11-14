import { asc, eq } from 'drizzle-orm';

import { appendEvent, notDeleted } from '@/db/repositories/events';
import {
  archiveMission,
  createMission,
  deleteMission,
  getMission,
  isMissionNameTaken,
  listTodayMissions,
  missionReminderTimes,
  moveMission,
  pauseMission,
  restoreMission,
  resumeMission,
  undoArchiveMission,
  updateMission,
} from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import {
  dayPlan,
  events,
  missionDays,
  missionReminders,
  missions,
  scheduledReminders,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { MISSION_FIELDS } from '@/rules/config';
import type { Frequency } from '@/rules/frequency';

import { createTestDb } from '../../../test/db';

const NOW = Date.UTC(2026, 10, 6, 8, 0); // 09:00 in Rome on Friday 6 November
const CONTEXT = { now: NOW, tzOffset: 60 };

function eventsOf(db: Db, missionId: string): string[] {
  return db
    .select({ type: events.type })
    .from(events)
    .where(eq(events.missionId, missionId))
    .orderBy(asc(events.seq))
    .all()
    .map((row) => row.type);
}

function markDone(db: Db, missionId: string, gameDay: `${number}-${number}-${number}`): void {
  db.insert(missionDays)
    .values({ missionId, gameDay, status: 'done', source: 'app', doneAt: NOW, updatedAt: NOW })
    .run();
}

function todayIds(db: Db, day: `${number}-${number}-${number}`): string[] {
  return listTodayMissions(db, day).map((mission) => mission.id);
}

describe('createMission', () => {
  it('saves a daily medium habit with just a name (US-EDT-01)', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: '  Leggi  ' }, CONTEXT);
    expect(mission).toMatchObject({
      name: 'Leggi',
      kind: 'habit',
      frequency: { type: 'daily' },
      difficulty: 'medium',
      goalType: 'none',
      statPrimary: null,
      status: 'active',
      sortOrder: 1,
      createdAt: NOW,
    });
    expect(db.select().from(missionReminders).all()).toEqual([]);
    expect(eventsOf(db, mission.id)).toEqual(['mission.created']);
  });

  it('saves every field of the editor', () => {
    const db = createTestDb();
    const mission = createMission(
      db,
      {
        name: 'Bevi',
        difficulty: 'easy',
        frequency: { type: 'weekdays', days: [1, 3, 5] },
        goal: { type: 'quantity', target: 2, unit: 'liter', increment: 0.25 },
        statPrimary: 'constitution',
        statSecondary: 'discipline',
        categoryKey: 'health',
        notes: 'Con la borraccia',
      },
      CONTEXT,
    );
    expect(mission).toMatchObject({
      difficulty: 'easy',
      frequency: { type: 'weekdays', days: [1, 3, 5] },
      goalType: 'quantity',
      goalTarget: 2,
      goalUnit: 'liter',
      goalStep: 0.25,
      statPrimary: 'constitution',
      statSecondary: 'discipline',
      categoryKey: 'health',
      notes: 'Con la borraccia',
    });
  });

  it('reads back the advanced fields after an update: secondary stat, category, icon, notes', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi', statPrimary: 'intelligence' }, CONTEXT);
    updateMission(
      db,
      mission.id,
      {
        statSecondary: 'wisdom',
        categoryKey: 'mind',
        iconKey: 'nota',
        notes: 'Prima riga\nSeconda riga',
        frequency: { type: 'yearly', month: 2, day: 29 },
      },
      CONTEXT,
    );
    expect(getMission(db, mission.id)).toMatchObject({
      statPrimary: 'intelligence',
      statSecondary: 'wisdom',
      categoryKey: 'mind',
      iconKey: 'nota',
      notes: 'Prima riga\nSeconda riga',
      frequency: { type: 'yearly', month: 2, day: 29 },
    });
    updateMission(db, mission.id, { categoryKey: null, iconKey: null, notes: null }, CONTEXT);
    expect(getMission(db, mission.id)).toMatchObject({
      categoryKey: null,
      iconKey: null,
      notes: null,
    });
  });

  it('trims the notes, saves blank notes as none and refuses notes that are too long', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi', notes: '  Dal comodino \n' }, CONTEXT);
    expect(mission.notes).toBe('Dal comodino');
    expect(updateMission(db, mission.id, { notes: '   ' }, CONTEXT).notes).toBeNull();
    expect(() =>
      updateMission(db, mission.id, { notes: 'a'.repeat(MISSION_FIELDS.notesMax + 1) }, CONTEXT),
    ).toThrow(RangeError);
    expect(
      updateMission(db, mission.id, { notes: 'a'.repeat(MISSION_FIELDS.notesMax) }, CONTEXT).notes,
    ).toHaveLength(MISSION_FIELDS.notesMax);
  });

  it('saves a task with an optional due day and no frequency', () => {
    const db = createTestDb();
    const task = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-10' },
      CONTEXT,
    );
    expect(task).toMatchObject({ kind: 'task', frequency: null, dueDay: '2026-11-10' });
    const noDate = createMission(db, { name: 'Bollette', kind: 'task' }, CONTEXT);
    expect(noDate).toMatchObject({ frequency: null, dueDay: null, sortOrder: 2 });
  });

  it('validates the frequency with Zod and rejects wrong missions, writing nothing', () => {
    const db = createTestDb();
    const wrong: Parameters<typeof createMission>[1][] = [
      { name: 'Corri', frequency: { type: 'weekdays', days: [8] } as unknown as Frequency },
      { name: 'Corri', frequency: { type: 'hourly' } as unknown as Frequency },
      { name: '   ' },
      { name: 'Dentista', kind: 'task', frequency: { type: 'daily' } },
      { name: 'Corri', dueDay: '2026-11-10' },
      { name: 'Dentista', kind: 'task', dueDay: '2026-02-30' },
      { name: 'Leggi', statPrimary: 'wisdom', statSecondary: 'wisdom' },
      { name: 'Leggi', goal: { type: 'quantity', target: 0, unit: 'page', increment: 5 } },
    ];
    for (const input of wrong) {
      expect(() => createMission(db, input, CONTEXT)).toThrow();
    }
    expect(db.select().from(missions).all()).toEqual([]);
    expect(db.select().from(events).all()).toEqual([]);
  });
});

describe('updateMission', () => {
  it('changes the mission and records which fields changed', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi' }, CONTEXT);
    const updated = updateMission(
      db,
      mission.id,
      { difficulty: 'hard', statPrimary: 'intelligence', name: 'Leggi 30 pagine' },
      { ...CONTEXT, now: NOW + 1000 },
    );
    expect(updated).toMatchObject({
      difficulty: 'hard',
      statPrimary: 'intelligence',
      name: 'Leggi 30 pagine',
      updatedAt: NOW + 1000,
    });
    expect(eventsOf(db, mission.id)).toEqual(['mission.created', 'mission.updated']);
    const updateEvent = db.select().from(events).orderBy(asc(events.seq)).all()[1];
    expect(updateEvent.payload).toEqual({ fields: ['difficulty', 'name', 'statPrimary'] });
  });

  it('counts the new difficulty only from the next completions: the past stays as it was', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi' }, CONTEXT);
    markDone(db, mission.id, '2026-11-05');
    appendEvent(db, {
      type: 'mission.completed',
      occurredAt: NOW,
      tzOffset: 60,
      source: 'app',
      missionId: mission.id,
      deltas: { xp: 25, coins: 5, hp: 1 },
    });
    const pastEvents = db.select().from(events).all();
    const pastDays = db.select().from(missionDays).all();
    updateMission(db, mission.id, { difficulty: 'hard' }, CONTEXT);
    expect(db.select().from(events).all().slice(0, pastEvents.length)).toEqual(pastEvents);
    expect(db.select().from(missionDays).all()).toEqual(pastDays);
  });

  it('validates the result and rejects changes that are not valid', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi', statPrimary: 'intelligence' }, CONTEXT);
    expect(() =>
      updateMission(
        db,
        mission.id,
        { frequency: { type: 'monthly', day: 40 } as unknown as Frequency },
        CONTEXT,
      ),
    ).toThrow();
    expect(() =>
      updateMission(db, mission.id, { statSecondary: 'intelligence' }, CONTEXT),
    ).toThrow();
    expect(() => updateMission(db, 'missing', { name: 'Altro' }, CONTEXT)).toThrow();
    expect(eventsOf(db, mission.id)).toEqual(['mission.created']);
  });
});

describe('reminders of a mission', () => {
  const times = (db: Db, id: string) => missionReminderTimes(db, id);

  it('saves the times of a habit in order, once each', () => {
    const db = createTestDb();
    const mission = createMission(
      db,
      { name: 'Leggi', reminders: ['21:00', '08:00', '21:00'] },
      CONTEXT,
    );
    expect(times(db, mission.id)).toEqual(['08:00', '21:00']);
    expect(db.select().from(missionReminders).all()).toEqual([
      expect.objectContaining({ missionId: mission.id, time: '08:00', leadMinutes: null }),
      expect.objectContaining({ missionId: mission.id, time: '21:00', leadMinutes: null }),
    ]);
  });

  it('replaces the times on update, removes them with an empty list, keeps them when missing', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Leggi', reminders: ['08:00'] }, CONTEXT);

    updateMission(db, mission.id, { name: 'Leggi 30 pagine' }, CONTEXT);
    expect(times(db, mission.id)).toEqual(['08:00']);

    updateMission(db, mission.id, { reminders: ['07:30', '22:15'] }, CONTEXT);
    expect(times(db, mission.id)).toEqual(['07:30', '22:15']);
    const last = db.select().from(events).orderBy(asc(events.seq)).all().at(-1);
    expect(last?.payload).toEqual({ fields: ['reminders'] });

    updateMission(db, mission.id, { reminders: [] }, CONTEXT);
    expect(times(db, mission.id)).toEqual([]);
  });

  it('refuses a time that is not HH:MM and the times of a task, which has no due time', () => {
    const db = createTestDb();
    expect(() => createMission(db, { name: 'Leggi', reminders: ['8:00'] }, CONTEXT)).toThrow();
    expect(() => createMission(db, { name: 'Leggi', reminders: ['24:00'] }, CONTEXT)).toThrow();
    expect(() =>
      createMission(db, { name: 'Dentista', kind: 'task', reminders: ['08:00'] }, CONTEXT),
    ).toThrow(RangeError);
    expect(db.select().from(missions).all()).toEqual([]);
  });
});

describe('pause, resume, archive and restore', () => {
  it('pauses a mission until an end day, when it comes back by itself', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    const paused = pauseMission(db, mission.id, '2026-11-10', CONTEXT);
    expect(paused).toMatchObject({ status: 'paused', pausedUntil: '2026-11-10' });
    expect(todayIds(db, '2026-11-09')).toEqual([]);
    expect(todayIds(db, '2026-11-10')).toEqual([mission.id]);
    expect(eventsOf(db, mission.id)).toEqual(['mission.created', 'mission.paused']);
  });

  it('pauses a mission without an end day and resumes it', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    pauseMission(db, mission.id, null, CONTEXT);
    expect(todayIds(db, '2026-12-31')).toEqual([]);
    expect(resumeMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'active',
      pausedUntil: null,
    });
    expect(todayIds(db, '2026-11-06')).toEqual([mission.id]);
    expect(eventsOf(db, mission.id)).toEqual([
      'mission.created',
      'mission.paused',
      'mission.resumed',
    ]);
  });

  it('rejects a pause that ends today or before, and resuming a mission that is not paused', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    expect(() => pauseMission(db, mission.id, '2026-11-06', CONTEXT)).toThrow(RangeError);
    expect(() => resumeMission(db, mission.id, CONTEXT)).toThrow(RangeError);
  });

  it('archives a mission and restores it', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    expect(archiveMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'archived',
      archivedAt: NOW,
    });
    expect(todayIds(db, '2026-11-06')).toEqual([]);
    expect(restoreMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'active',
      archivedAt: null,
    });
    expect(todayIds(db, '2026-11-06')).toEqual([mission.id]);
    expect(eventsOf(db, mission.id)).toEqual([
      'mission.created',
      'mission.archived',
      'mission.restored',
    ]);
  });

  it('undoes the archive of a paused mission keeping its pause', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    pauseMission(db, mission.id, '2026-11-10', CONTEXT);
    archiveMission(db, mission.id, CONTEXT);
    expect(undoArchiveMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'paused',
      pausedUntil: '2026-11-10',
      archivedAt: null,
    });
    expect(eventsOf(db, mission.id)).toEqual([
      'mission.created',
      'mission.paused',
      'mission.archived',
      'mission.restored',
    ]);

    // Paused with no end, it comes back paused with no end.
    pauseMission(db, mission.id, null, CONTEXT);
    archiveMission(db, mission.id, CONTEXT);
    expect(undoArchiveMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'paused',
      pausedUntil: null,
    });
  });

  it('undoes the archive as active when the pause has ended meanwhile, or it was active', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    pauseMission(db, mission.id, '2026-11-08', CONTEXT);
    archiveMission(db, mission.id, CONTEXT);
    const later = { now: NOW + 3 * 24 * 3_600_000, tzOffset: 60 };
    expect(undoArchiveMission(db, mission.id, later)).toMatchObject({
      status: 'active',
      pausedUntil: null,
    });
    archiveMission(db, mission.id, CONTEXT);
    expect(undoArchiveMission(db, mission.id, CONTEXT)).toMatchObject({
      status: 'active',
      pausedUntil: null,
    });
    expect(() => undoArchiveMission(db, mission.id, CONTEXT)).toThrow(RangeError);
  });

  it('restores only archived missions', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    expect(() => restoreMission(db, mission.id, CONTEXT)).toThrow(RangeError);
  });
});

describe('deleteMission', () => {
  it('hides the mission everywhere but keeps its history and its events', () => {
    const db = createTestDb();
    const kept = createMission(db, { name: 'Leggi' }, CONTEXT);
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    markDone(db, mission.id, '2026-11-05');
    db.insert(missionReminders).values({ id: 'r1', missionId: mission.id, time: '08:00' }).run();
    db.insert(scheduledReminders)
      .values({ osId: 'os-1', missionId: mission.id, gameDay: '2026-11-06', fireAt: NOW })
      .run();
    db.insert(dayPlan)
      .values([
        { gameDay: '2026-11-05', missionId: mission.id, position: 0 },
        { gameDay: '2026-11-06', missionId: mission.id, position: 0 },
      ])
      .run();

    const result = deleteMission(db, mission.id, CONTEXT);

    expect(result).toEqual({ cancelledNotificationIds: ['os-1'] });
    expect(db.select().from(missions).where(eq(missions.id, mission.id)).get()?.deletedAt).toBe(
      NOW,
    );
    expect(db.select({ id: missions.id }).from(missions).where(notDeleted(missions)).all()).toEqual(
      [{ id: kept.id }],
    );
    expect(todayIds(db, '2026-11-06')).toEqual([kept.id]);
    expect(db.select().from(missionReminders).all()).toEqual([]);
    expect(db.select().from(scheduledReminders).all()).toEqual([]);
    expect(db.select({ day: dayPlan.gameDay }).from(dayPlan).all()).toEqual([
      { day: '2026-11-05' },
    ]);
    expect(db.select().from(missionDays).all()).toHaveLength(1);
    expect(eventsOf(db, mission.id)).toEqual(['mission.created', 'mission.deleted']);
  });

  it('refuses every action on a deleted mission', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    deleteMission(db, mission.id, CONTEXT);
    expect(() => deleteMission(db, mission.id, CONTEXT)).toThrow(RangeError);
    expect(() => updateMission(db, mission.id, { name: 'Altro' }, CONTEXT)).toThrow(RangeError);
    expect(() => pauseMission(db, mission.id, null, CONTEXT)).toThrow(RangeError);
    expect(() => archiveMission(db, mission.id, CONTEXT)).toThrow(RangeError);
  });
});

describe('listTodayMissions', () => {
  it('lists the habits due today by frequency and the tasks due or overdue, in order', () => {
    const db = createTestDb();
    const fridays = createMission(
      db,
      { name: 'Venerdì', frequency: { type: 'weekdays', days: [5] } },
      CONTEXT,
    );
    createMission(db, { name: 'Lunedì', frequency: { type: 'weekdays', days: [1] } }, CONTEXT);
    const overdue = createMission(
      db,
      { name: 'Bollette', kind: 'task', dueDay: '2026-11-02' },
      CONTEXT,
    );
    createMission(db, { name: 'Dentista', kind: 'task', dueDay: '2026-11-10' }, CONTEXT);
    const done = createMission(db, { name: 'Fatta', kind: 'task', dueDay: '2026-11-01' }, CONTEXT);
    markDone(db, done.id, '2026-11-03');
    expect(todayIds(db, '2026-11-06')).toEqual([fridays.id, overdue.id]);
  });

  it('hides a times-per-week habit once it reached its number in the week', () => {
    const db = createTestDb();
    const twice = createMission(
      db,
      { name: 'Palestra', frequency: { type: 'times_per_week', times: 2 } },
      CONTEXT,
    );
    markDone(db, twice.id, '2026-11-02');
    expect(todayIds(db, '2026-11-04')).toEqual([twice.id]);
    markDone(db, twice.id, '2026-11-04');
    expect(todayIds(db, '2026-11-05')).toEqual([]);
    expect(todayIds(db, '2026-11-09')).toEqual([twice.id]);
  });

  it('lists nothing on a rest day (design 10.5)', () => {
    const db = createTestDb();
    createMission(db, { name: 'Leggi' }, CONTEXT);
    setSetting(db, 'rest_days', [7], NOW);
    expect(todayIds(db, '2026-11-08')).toEqual([]);
    expect(todayIds(db, '2026-11-09')).toHaveLength(1);
  });
});

function orderOf(db: Db): string[] {
  return db
    .select({ name: missions.name })
    .from(missions)
    .orderBy(asc(missions.sortOrder))
    .all()
    .map((row) => row.name);
}

describe('moveMission (design-sezioni.md 3.4)', () => {
  function four(db: Db) {
    const make = (name: string, categoryKey: string | null) =>
      createMission(db, { name, categoryKey }, CONTEXT);
    return {
      a: make('A', 'health'),
      b: make('B', 'health'),
      c: make('C', 'health'),
      m: make('M', 'mind'),
    };
  }

  it('moves a mission before another one in the same category', () => {
    const db = createTestDb();
    const { a, c } = four(db);
    const moved = moveMission(db, c.id, { categoryKey: 'health', beforeId: a.id }, CONTEXT);
    expect(moved.categoryKey).toBe('health');
    expect(orderOf(db)).toEqual(['C', 'A', 'B', 'M']);
    expect(eventsOf(db, c.id)).toEqual(['mission.created', 'mission.updated']);
    const payload = db
      .select({ payload: events.payload })
      .from(events)
      .where(eq(events.type, 'mission.updated'))
      .get()?.payload;
    expect(payload).toEqual({ fields: ['sortOrder'] });
  });

  it('moves a mission to the end of its category', () => {
    const db = createTestDb();
    const { a } = four(db);
    moveMission(db, a.id, { categoryKey: 'health', beforeId: null }, CONTEXT);
    expect(orderOf(db)).toEqual(['B', 'C', 'A', 'M']);
  });

  it('moves a mission into another category, which changes its category', () => {
    const db = createTestDb();
    const { b, m } = four(db);
    const moved = moveMission(db, b.id, { categoryKey: 'mind', beforeId: m.id }, CONTEXT);
    expect(moved.categoryKey).toBe('mind');
    expect(orderOf(db)).toEqual(['A', 'C', 'B', 'M']);
    const payload = db
      .select({ payload: events.payload })
      .from(events)
      .where(eq(events.type, 'mission.updated'))
      .get()?.payload;
    expect(payload).toEqual({ fields: ['categoryKey', 'sortOrder'] });
  });

  it('moves a mission to the end of another category and to «Senza categoria»', () => {
    const db = createTestDb();
    const { a, m } = four(db);
    moveMission(db, a.id, { categoryKey: 'mind', beforeId: null }, CONTEXT);
    expect(orderOf(db)).toEqual(['B', 'C', 'M', 'A']);
    expect(getMission(db, a.id)?.categoryKey).toBe('mind');
    moveMission(db, m.id, { categoryKey: null, beforeId: null }, CONTEXT);
    expect(getMission(db, m.id)?.categoryKey).toBeNull();
  });

  it('numbers the missions again when there is no room between two of them', () => {
    const db = createTestDb();
    const { a, b, c } = four(db);
    for (let round = 0; round < 60; round += 1) {
      moveMission(
        db,
        round % 2 === 0 ? c.id : a.id,
        { categoryKey: 'health', beforeId: b.id },
        CONTEXT,
      );
    }
    expect(orderOf(db)).toEqual(['C', 'A', 'B', 'M']);
    const orders = db.select({ order: missions.sortOrder }).from(missions).all();
    expect(new Set(orders.map((row) => row.order)).size).toBe(4);
  });

  it('keeps the order used by Today for the missions without a time', () => {
    const db = createTestDb();
    const { a, c } = four(db);
    moveMission(db, c.id, { categoryKey: 'health', beforeId: a.id }, CONTEXT);
    expect(listTodayMissions(db, '2026-11-06').map((mission) => mission.name)).toEqual([
      'C',
      'A',
      'B',
      'M',
    ]);
  });

  it('rejects an archived mission, an unknown category and a wrong neighbour', () => {
    const db = createTestDb();
    const { a, b } = four(db);
    expect(() => moveMission(db, a.id, { categoryKey: 'garden', beforeId: null }, CONTEXT)).toThrow(
      RangeError,
    );
    expect(() => moveMission(db, a.id, { categoryKey: 'health', beforeId: a.id }, CONTEXT)).toThrow(
      RangeError,
    );
    expect(() =>
      moveMission(db, a.id, { categoryKey: 'health', beforeId: 'nobody' }, CONTEXT),
    ).toThrow(RangeError);
    archiveMission(db, b.id, CONTEXT);
    expect(() => moveMission(db, b.id, { categoryKey: 'health', beforeId: null }, CONTEXT)).toThrow(
      RangeError,
    );
    expect(orderOf(db)).toEqual(['A', 'B', 'C', 'M']);
  });
});

describe('edge cases', () => {
  it('keeps the goal of a measurable mission when other fields change', () => {
    const db = createTestDb();
    const water = createMission(
      db,
      { name: 'Bevi', goal: { type: 'quantity', target: 2, unit: 'liter', increment: 0.25 } },
      CONTEXT,
    );
    const timer = createMission(
      db,
      { name: 'Medita', goal: { type: 'duration', target: 10, increment: 5 } },
      CONTEXT,
    );
    expect(updateMission(db, water.id, { name: 'Bevi acqua' }, CONTEXT)).toMatchObject({
      goalType: 'quantity',
      goalTarget: 2,
      goalUnit: 'liter',
      goalStep: 0.25,
    });
    expect(updateMission(db, timer.id, { difficulty: 'easy' }, CONTEXT)).toMatchObject({
      goalType: 'duration',
      goalTarget: 10,
      goalUnit: 'minute',
      goalStep: 5,
    });
  });

  it('rejects unknown difficulties and stats', () => {
    const db = createTestDb();
    expect(() =>
      createMission(db, { name: 'Leggi', difficulty: 'epic' as never }, CONTEXT),
    ).toThrow(RangeError);
    expect(() =>
      createMission(db, { name: 'Leggi', statPrimary: 'luck' as never }, CONTEXT),
    ).toThrow(RangeError);
  });

  it('refuses to pause or archive again an archived mission', () => {
    const db = createTestDb();
    const mission = createMission(db, { name: 'Corri' }, CONTEXT);
    archiveMission(db, mission.id, CONTEXT);
    expect(() => pauseMission(db, mission.id, null, CONTEXT)).toThrow(RangeError);
    expect(() => archiveMission(db, mission.id, CONTEXT)).toThrow(RangeError);
  });

  it('rejects a day that does not exist', () => {
    const db = createTestDb();
    expect(() => listTodayMissions(db, '2026-02-30')).toThrow(RangeError);
  });

  it('lists nothing when there are no missions', () => {
    expect(listTodayMissions(createTestDb(), '2026-11-06')).toEqual([]);
  });
});

describe('getMission', () => {
  it('reads a mission to edit, archived too, but not a deleted or unknown one', () => {
    const db = createTestDb();
    const read = createMission(db, { name: 'Leggi' }, CONTEXT);
    const run = createMission(db, { name: 'Corsa' }, CONTEXT);
    archiveMission(db, run.id, CONTEXT);

    expect(getMission(db, read.id)).toEqual(read);
    expect(getMission(db, run.id)?.status).toBe('archived');
    deleteMission(db, read.id, CONTEXT);
    expect(getMission(db, read.id)).toBeNull();
    expect(getMission(db, 'missing')).toBeNull();
  });
});

describe('isMissionNameTaken', () => {
  it('finds a mission with the same name, ignoring case and spaces, but not a deleted one', () => {
    const db = createTestDb();
    const read = createMission(db, { name: 'Leggi 20 pagine' }, CONTEXT);
    archiveMission(db, createMission(db, { name: 'Corsa' }, CONTEXT).id, CONTEXT);

    expect(isMissionNameTaken(db, '  leggi 20 PAGINE ')).toBe(true);
    expect(isMissionNameTaken(db, 'Corsa')).toBe(true);
    expect(isMissionNameTaken(db, 'Leggi 10 pagine')).toBe(false);
    expect(isMissionNameTaken(db, '   ')).toBe(false);

    deleteMission(db, read.id, CONTEXT);
    expect(isMissionNameTaken(db, 'Leggi 20 pagine')).toBe(false);
  });
});
