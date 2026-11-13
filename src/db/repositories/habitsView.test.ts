import { and, eq } from 'drizzle-orm';

import { completeMission } from '@/db/repositories/completion';
import { listHabitsView } from '@/db/repositories/habitsView';
import {
  archiveCompletedSingles,
  archiveMission,
  createMission,
  deleteMission,
  pauseMission,
  resumeMission,
} from '@/db/repositories/missions';
import { events, missionDays, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import type { GameDay } from '@/rules/types';

import { clockAt, newGame } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome; "today" is a later day of November.

function markDays(
  db: Db,
  missionId: string,
  days: readonly GameDay[],
  status: 'done' | 'skipped' = 'done',
): void {
  db.insert(missionDays)
    .values(
      days.map((gameDay) => ({
        missionId,
        gameDay,
        status,
        source: 'app' as const,
        doneAt: 0,
        updatedAt: 0,
      })),
    )
    .run();
}

function novemberDays(from: number, to: number): GameDay[] {
  return Array.from(
    { length: to - from + 1 },
    (_, i) => `2026-11-${String(from + i).padStart(2, '0')}` as GameDay,
  );
}

function item(db: Db, id: string, day = 16) {
  const view = listHabitsView(db, clockAt(day, 10));
  return [...view.categories.flatMap((category) => category.items), ...view.archived].find(
    (row) => row.mission.id === id,
  );
}

describe('listHabitsView', () => {
  it('gives the streak and the rate of the last 30 days, without skipped and paused days', () => {
    const db = newGame(['journal']);
    const id = createMission(db, { name: 'Leggi' }, clockAt(6, 9)).id;
    // Monday 16: from the 6th to the 15th, 10 closed days.
    markDays(db, id, novemberDays(6, 9));
    expect(item(db, id)?.completionRate).toBe(40);
    markDays(db, id, novemberDays(10, 11), 'skipped');
    expect(item(db, id)?.completionRate).toBe(50);
    pauseMission(db, id, '2026-11-14', clockAt(12, 9));
    resumeMission(db, id, clockAt(14, 9));
    // 12 and 13 paused: 4 done of 6 (6–9, 14, 15).
    expect(item(db, id)?.completionRate).toBe(66);
    db.update(missions).set({ streak: 4 }).where(eq(missions.id, id)).run();
    expect(item(db, id)?.mission.streak).toBe(4);
  });

  it('counts the missions by filter, with the archived ones apart', () => {
    const db = newGame(['meditation', 'read_pages']);
    const task = createMission(db, { name: 'Dentista', kind: 'task' }, clockAt(6, 9)).id;
    const old = createMission(db, { name: 'Vecchia' }, clockAt(6, 9)).id;
    archiveMission(db, old, clockAt(8, 9));
    const gone = createMission(db, { name: 'Sparita' }, clockAt(6, 9)).id;
    deleteMission(db, gone, clockAt(7, 9));

    const view = listHabitsView(db, clockAt(10, 10));
    expect(view.counts).toEqual({ all: 3, habits: 2, tasks: 1, archived: 1 });
    expect(view.archived.map((row) => [row.mission.name, row.archivedDay])).toEqual([
      ['Vecchia', '2026-11-08'],
    ]);
    const names = view.categories.flatMap((category) => category.items.map((r) => r.mission.id));
    expect(names).toContain(task);
    expect(names).not.toContain(old);
    expect(names).not.toContain(gone);
  });

  it('groups by category in the order of the templates, «no category» last', () => {
    const db = newGame(['read_pages', 'drink_water']);
    createMission(db, { name: 'Senza' }, clockAt(6, 9));
    createMission(db, { name: 'Casa', categoryKey: 'home' }, clockAt(6, 9));
    const view = listHabitsView(db, clockAt(7, 10));
    expect(view.categories.map((category) => category.key)).toEqual([
      'health',
      'mind',
      'home',
      null,
    ]);
  });

  it('keeps the rate of an archived mission up to the day of the archive', () => {
    const db = newGame(['journal']);
    const id = createMission(db, { name: 'Leggi' }, clockAt(6, 9)).id;
    markDays(db, id, novemberDays(6, 9));
    archiveMission(db, id, clockAt(10, 9));
    // Later days are not misses.
    expect(item(db, id, 25)?.completionRate).toBe(100);
  });

  it('gives the day a task was done', () => {
    const db = newGame(['journal']);
    const id = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-07' },
      clockAt(6, 9),
    ).id;
    completeMission(db, { missionId: id, source: 'app', ...clockAt(7, 10) });
    expect(item(db, id, 9)).toMatchObject({ doneDay: '2026-11-07', completionRate: 100 });
  });
});

describe('archiveCompletedSingles', () => {
  function setup() {
    const db = newGame(['journal']);
    const task = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-07' },
      clockAt(6, 9),
    ).id;
    completeMission(db, { missionId: task, source: 'app', ...clockAt(7, 10) });
    const open = createMission(
      db,
      { name: 'Bollette', kind: 'task', dueDay: '2026-11-07' },
      clockAt(6, 9),
    ).id;
    const habit = createMission(db, { name: 'Leggi' }, clockAt(6, 9)).id;
    markDays(db, habit, ['2026-11-06']);
    return { db, task, open, habit };
  }

  it('archives a single task 7 days after it was done, and nothing else', () => {
    const { db, task, open, habit } = setup();
    expect(archiveCompletedSingles(db, clockAt(13, 10))).toEqual([]);
    expect(archiveCompletedSingles(db, clockAt(14, 10))).toEqual([task]);
    const rows = db.select().from(missions).all();
    expect(rows.find((row) => row.id === task)).toMatchObject({
      status: 'archived',
      archivedAt: clockAt(14, 10).now,
    });
    expect(rows.find((row) => row.id === open)?.status).toBe('active');
    expect(rows.find((row) => row.id === habit)?.status).toBe('active');
    const logged = db
      .select()
      .from(events)
      .where(and(eq(events.missionId, task), eq(events.type, 'mission.archived')))
      .all();
    expect(logged).toEqual([
      expect.objectContaining({ source: 'system', payload: { auto: true } }),
    ]);
  });

  it('runs again without changes, and skips deleted and already archived tasks', () => {
    const { db } = setup();
    archiveCompletedSingles(db, clockAt(14, 10));
    expect(archiveCompletedSingles(db, clockAt(20, 10))).toEqual([]);

    const other = setup();
    deleteMission(other.db, other.task, clockAt(8, 9));
    expect(archiveCompletedSingles(other.db, clockAt(20, 10))).toEqual([]);
  });

  it('follows the day change setting', () => {
    const { db, task } = setup();
    // The day changes at 06:00: 05:00 of the 14th is still the game day of the 13th.
    expect(archiveCompletedSingles(db, clockAt(14, 5))).toEqual([]);
    expect(archiveCompletedSingles(db, clockAt(14, 7))).toEqual([task]);
  });
});
