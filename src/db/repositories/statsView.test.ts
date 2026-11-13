import { closePendingDays } from '@/db/repositories/closing';
import { archiveMission, createMission, deleteMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { getStatsView } from '@/db/repositories/statsView';
import { missionDays } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';

import { at, clockAt, missionId, newGame } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome; "today" is a later day. Day numbers past 30
// are in December (`clockAt(40, …)` is 10 December).

function markDays(
  db: Db,
  id: string,
  days: readonly GameDay[],
  status: 'done' | 'skipped' = 'done',
): void {
  db.insert(missionDays)
    .values(
      days.map((gameDay) => ({
        missionId: id,
        gameDay,
        status,
        source: 'app' as const,
        doneAt: 0,
        updatedAt: 0,
      })),
    )
    .run();
}

/** The game days from `from` to `to` included. */
function range(from: GameDay, to: GameDay): GameDay[] {
  const days: GameDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const view = (db: Db, day: number) => getStatsView(db, clockAt(day, 10));

describe('getStatsView: this week', () => {
  it('counts the completions from the first day of the week set in week_start', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    // Last week Monday 9, Tuesday 10, Wednesday 11; this week Saturday 14 … Tuesday 17.
    markDays(db, id, [
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      ...range('2026-11-14', '2026-11-17'),
    ]);

    // Monday: 16 and 17, against Monday 9 and Tuesday 10 of last week.
    expect(view(db, 17).summary).toMatchObject({ weekDone: 2, weekDoneChange: 0 });

    // Sunday: 15, 16 and 17, against Sunday 8 … Tuesday 10.
    setSetting(db, 'week_start', 7, at(17, 9));
    expect(view(db, 17).summary).toMatchObject({ weekDone: 3, weekDoneChange: 1 });
  });

  it('has no comparison in the first week of the hero', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), ['2026-11-06', '2026-11-07']);
    // Sunday 8 is still the week of Monday 2, before the hero.
    expect(view(db, 8).summary).toMatchObject({ weekDone: 2, weekDoneChange: null });
  });

  it('excludes skipped days and deleted missions', () => {
    const db = newGame(['journal']);
    const gone = createMission(db, { name: 'Sparita' }, clockAt(6, 9)).id;
    markDays(db, missionId(db, 'journal'), ['2026-11-16'], 'skipped');
    markDays(db, gone, ['2026-11-16', '2026-11-17']);
    deleteMission(db, gone, clockAt(17, 9));
    expect(view(db, 17).summary.weekDone).toBe(0);
  });
});

describe('getStatsView: last 30 days', () => {
  it('adds up the missions, without skipped days and deleted missions', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    const gone = createMission(db, { name: 'Sparita' }, clockAt(6, 9)).id;
    // Monday 16: from the 6th to the 15th, 10 closed days; 4 done and 2 skipped.
    markDays(db, journal, range('2026-11-06', '2026-11-09'));
    markDays(db, journal, ['2026-11-10', '2026-11-11'], 'skipped');
    markDays(db, gone, range('2026-11-06', '2026-11-15'));
    deleteMission(db, gone, clockAt(16, 9));
    expect(view(db, 16).summary.rate).toBe(50);
  });

  it('adds the tasks of the window and stops archived missions at their archive', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-15'));
    const old = createMission(db, { name: 'Vecchia' }, clockAt(6, 9)).id;
    markDays(db, old, ['2026-11-06']);
    // Archived on Sunday 8: 1 of 2 (the 6th and the 7th), never missed later.
    archiveMission(db, old, clockAt(8, 9));
    createMission(db, { name: 'Dentista', kind: 'task', dueDay: '2026-11-12' }, clockAt(6, 9));
    // 10 + 1 done of 10 + 2 + 1.
    expect(view(db, 16).summary.rate).toBe(Math.floor((11 / 13) * 100));
  });

  it('has no rate before a day was expected', () => {
    const db = newGame(['journal']);
    expect(view(db, 6).summary).toMatchObject({ rate: null, rateChange: null });
  });

  it('compares with the 30 days before, whose last day is closed', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    // Thursday 10 December. The 30 days before: 6–10 November, 2 done of 5.
    markDays(db, id, ['2026-11-06', '2026-11-07']);
    // The last 30: 11 November – 10 December, the 29 closed ones all done.
    markDays(db, id, range('2026-11-11', '2026-12-09'));
    expect(view(db, 40).summary).toMatchObject({ rate: 100, rateChange: 60 });
  });

  it('keeps the day of an archive open in the 30 days before', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-10'));
    const old = createMission(db, { name: 'Vecchia' }, clockAt(6, 9)).id;
    markDays(db, old, range('2026-11-06', '2026-11-09'));
    // Archived on Tuesday 10 November, the last day before the 30 days of 10 December.
    archiveMission(db, old, clockAt(10, 9));
    // Before: 5 + 4 of 5 + 4; now nothing.
    expect(view(db, 40).summary).toMatchObject({ rate: 0, rateChange: -100 });
  });

  it('gives a negative change too: the screen hides it', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-10'));
    expect(view(db, 40).summary).toMatchObject({ rate: 0, rateChange: -100 });
  });
});

describe('getStatsView: streak', () => {
  it('gives the hero streak, its record and the change in 7 days', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-16'));
    // Closes the 6th … 16th: 11 days in a row; 4 at the close of Monday 9.
    closePendingDays(db, clockAt(17, 10));
    expect(view(db, 17).summary).toMatchObject({ streak: 11, streakBest: 11, streakChange: 7 });
  });

  it('has no change when the day 7 days before was never closed', () => {
    const db = newGame(['journal']);
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-09'));
    closePendingDays(db, clockAt(10, 10));
    expect(view(db, 10).summary).toMatchObject({ streak: 4, streakChange: null });
  });
});

describe('getStatsView: mission trends', () => {
  it('lists the active habits from the least constant, by period', () => {
    const db = newGame(['journal', 'meditation', 'read_pages']);
    const journal = missionId(db, 'journal');
    const meditation = missionId(db, 'meditation');
    const reading = missionId(db, 'read_pages');
    // Thursday 10 December. Journal: every day of November, none in December.
    markDays(db, journal, range('2026-11-06', '2026-11-30'));
    // Meditation: only the last 9 days.
    markDays(db, meditation, range('2026-12-01', '2026-12-09'));
    // Reading: half of the last 6 days, and nothing else.
    markDays(db, reading, ['2026-12-04', '2026-12-06', '2026-12-08']);
    createMission(db, { name: 'Dentista', kind: 'task', dueDay: '2026-12-01' }, clockAt(6, 9));
    const archived = createMission(db, { name: 'Vecchia' }, clockAt(6, 9)).id;
    archiveMission(db, archived, clockAt(8, 9));
    const fresh = createMission(db, { name: 'Nuova' }, clockAt(40, 9)).id;
    const gone = createMission(db, { name: 'Sparita' }, clockAt(6, 9)).id;
    deleteMission(db, gone, clockAt(8, 9));

    const { trends } = view(db, 40);
    const rows = (period: keyof typeof trends) =>
      trends[period].map((row) => [row.mission.id, row.rate]);
    // Week: 4–10 December, 6 closed days and today open.
    expect(rows('week')).toEqual([
      [journal, 0],
      [reading, 50],
      [meditation, 100],
      [fresh, null],
    ]);
    // Month: 11 November – 10 December, 29 closed days.
    expect(rows('month')).toEqual([
      [reading, Math.floor((3 / 29) * 100)],
      [meditation, Math.floor((9 / 29) * 100)],
      [journal, Math.floor((20 / 29) * 100)],
      [fresh, null],
    ]);
    // Year: from the creation on 6 November, 34 closed days.
    expect(rows('year')[0]).toEqual([reading, Math.floor((3 / 34) * 100)]);
  });
});
