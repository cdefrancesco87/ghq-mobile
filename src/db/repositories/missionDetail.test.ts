import { completeMission, progressMission, skipMission } from '@/db/repositories/completion';
import { getMissionDetail } from '@/db/repositories/missionDetail';
import { archiveMission, createMission, deleteMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { undoEvent } from '@/db/repositories/undo';
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
  status: 'done' | 'partial' | 'skipped' = 'done',
  value: number | null = null,
): void {
  db.insert(missionDays)
    .values(
      days.map((gameDay) => ({
        missionId: id,
        gameDay,
        status,
        value,
        source: 'app' as const,
        doneAt: 0,
        updatedAt: 0,
      })),
    )
    .run();
}

function range(from: GameDay, to: GameDay): GameDay[] {
  const days: GameDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const detail = (db: Db, id: string, day: number) => {
  const view = getMissionDetail(db, clockAt(day, 10), id);
  if (view === null) {
    throw new Error('No detail');
  }
  return view;
};

describe('getMissionDetail of a simple habit', () => {
  it('gives streak, record and the rate of every period, like the trends of Statistics', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    // Friday 6 … Thursday 26 November: 21 days, 15 done.
    markDays(db, id, range('2026-11-12', '2026-11-26'));
    const view = detail(db, id, 27);
    expect(view.mission.id).toBe(id);
    expect(view.today).toBe('2026-11-27');
    expect(view.periods.week.rate).toBe(100);
    expect(view.periods.month.rate).toBe(Math.floor((15 / 21) * 100));
    expect(view.periods.year.rate).toBe(Math.floor((15 / 21) * 100));
  });

  it('shows the last 7 days in period Settimana, one mark per day', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, ['2026-11-21', '2026-11-23']);
    markDays(db, id, ['2026-11-24'], 'skipped');
    const chart = detail(db, id, 26).periods.week.chart;
    expect(chart).toEqual({
      kind: 'days',
      columns: [
        { day: '2026-11-20', mark: 'missed' },
        { day: '2026-11-21', mark: 'done' },
        { day: '2026-11-22', mark: 'missed' },
        { day: '2026-11-23', mark: 'done' },
        { day: '2026-11-24', mark: 'skipped' },
        { day: '2026-11-25', mark: 'missed' },
        { day: '2026-11-26', mark: 'open' },
      ],
    });
  });

  it('shows the rate by week in period Mese and by month in period Anno', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, range('2026-11-09', '2026-11-15'));
    markDays(db, id, ['2026-12-01']);
    const view = detail(db, id, 33); // Thursday 3 December
    expect(view.periods.month.chart).toEqual({
      kind: 'rates',
      columns: [
        // Created on Friday 6: only Friday 6 … Sunday 8 were expected.
        { from: '2026-11-02', to: '2026-11-08', rate: 0 },
        { from: '2026-11-09', to: '2026-11-15', rate: 100 },
        { from: '2026-11-16', to: '2026-11-22', rate: 0 },
        { from: '2026-11-23', to: '2026-11-29', rate: 0 },
        { from: '2026-11-30', to: '2026-12-03', rate: 33 },
      ],
    });
    const year = view.periods.year.chart;
    expect(year.kind === 'rates' && year.columns).toHaveLength(12);
    expect(year.kind === 'rates' && year.columns.slice(-3)).toEqual([
      { from: '2026-10-01', to: '2026-10-31', rate: null },
      { from: '2026-11-01', to: '2026-11-30', rate: Math.floor((7 / 25) * 100) },
      { from: '2026-12-01', to: '2026-12-03', rate: 50 },
    ]);
  });

  it('follows week_start in period Mese', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    setSetting(db, 'week_start', 7, at(6, 10));
    const chart = detail(db, id, 26).periods.month.chart;
    expect(chart.kind === 'rates' && chart.columns.at(-1)).toEqual({
      from: '2026-11-22',
      to: '2026-11-26',
      rate: 0,
    });
  });

  it('has no chart of values for a mission that is not measurable', () => {
    const db = newGame(['journal']);
    const view = detail(db, missionId(db, 'journal'), 10);
    expect(view.periods.week.values).toBeNull();
    expect(view.periods.week.average).toBeNull();
  });
});

describe('getMissionDetail of a measurable habit', () => {
  it('gives the value of every day, and of every month in period Anno', () => {
    const db = newGame(['drink_water']);
    const id = missionId(db, 'drink_water');
    markDays(db, id, ['2026-11-20'], 'done', 2);
    markDays(db, id, ['2026-11-22'], 'partial', 1.25);
    markDays(db, id, ['2026-11-23'], 'skipped');
    const view = detail(db, id, 26);
    expect(view.periods.week.values).toEqual([
      { from: '2026-11-20', to: '2026-11-20', value: 2 },
      { from: '2026-11-21', to: '2026-11-21', value: 0 },
      { from: '2026-11-22', to: '2026-11-22', value: 1.25 },
      { from: '2026-11-23', to: '2026-11-23', value: 0 },
      { from: '2026-11-24', to: '2026-11-24', value: 0 },
      { from: '2026-11-25', to: '2026-11-25', value: 0 },
      { from: '2026-11-26', to: '2026-11-26', value: 0 },
    ]);
    expect(view.periods.week.average).toBe(1.625);
    // Period Mese: 30 days, null before the creation on the 6th.
    const month = view.periods.month.values!;
    expect(month).toHaveLength(30);
    expect(month[0]).toEqual({ from: '2026-10-28', to: '2026-10-28', value: null });
    expect(month.at(-1)).toEqual({ from: '2026-11-26', to: '2026-11-26', value: 0 });
    const year = view.periods.year.values!;
    expect(year).toHaveLength(12);
    expect(year.at(-1)).toEqual({ from: '2026-11-01', to: '2026-11-26', value: 1.625 });
    expect(year.at(-2)!.value).toBeNull();
    // The partial day counts as not done in the rate.
    expect(view.periods.week.rate).toBe(Math.floor((1 / 5) * 100));
  });
});

describe('getMissionDetail: history', () => {
  it('lists completions, progress, skips and backfills of the mission, the latest first', () => {
    const db = newGame(['journal', 'drink_water']);
    const journal = missionId(db, 'journal');
    const water = missionId(db, 'drink_water');
    completeMission(db, { missionId: journal, source: 'app', ...clockAt(7, 10) });
    skipMission(db, { missionId: journal, reason: 'travel', ...clockAt(8, 10) });
    const undone = completeMission(db, { missionId: journal, source: 'app', ...clockAt(9, 10) });
    undoEvent(db, undone.completion!.eventId, clockAt(9, 11));
    completeMission(db, { missionId: water, source: 'app', ...clockAt(9, 10) });
    progressMission(db, { missionId: water, source: 'app', ...clockAt(10, 10) });

    const history = detail(db, journal, 10).history;
    expect(history.map((entry) => [entry.type, entry.gameDay])).toEqual([
      ['mission.skipped', '2026-11-08'],
      ['mission.completed', '2026-11-07'],
    ]);
    expect(history[1].xp).toBeGreaterThan(0);
    expect(history[1].coins).toBeGreaterThan(0);

    const waterHistory = detail(db, water, 10).history;
    expect(waterHistory.map((entry) => [entry.type, entry.value])).toEqual([
      ['mission.progressed', 0.25],
      ['mission.completed', 2],
    ]);
  });

  it('keeps one progress a day, the latest, and none on a day completed', () => {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    progressMission(db, { missionId: water, source: 'app', ...clockAt(7, 10) });
    progressMission(db, { missionId: water, source: 'app', ...clockAt(7, 11) });
    progressMission(db, { missionId: water, source: 'app', ...clockAt(8, 10) });
    for (let tap = 0; tap < 7; tap++) {
      progressMission(db, { missionId: water, source: 'app', ...clockAt(8, 11) });
    }
    expect(
      detail(db, water, 8).history.map((entry) => [entry.type, entry.gameDay, entry.value]),
    ).toEqual([
      ['mission.completed', '2026-11-08', 2],
      ['mission.progressed', '2026-11-07', 0.5],
    ]);
  });

  it('keeps only the latest entries', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    for (let day = 7; day <= 30; day++) {
      completeMission(db, { missionId: id, source: 'app', ...clockAt(day, 10) });
    }
    const history = detail(db, id, 30).history;
    expect(history).toHaveLength(20);
    expect(history[0].gameDay).toBe('2026-11-30');
  });
});

describe('getMissionDetail: tasks, archived and deleted missions', () => {
  it('has no charts for a task', () => {
    const db = newGame(['journal']);
    const task = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-10' },
      clockAt(6, 9),
    ).id;
    const view = detail(db, task, 12);
    expect(view.periods.week.chart).toEqual({ kind: 'none' });
    expect(view.periods.week.rate).toBe(0);
  });

  it('stops the rates of an archived mission on the day of the archive', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, range('2026-11-20', '2026-11-23'));
    archiveMission(db, id, clockAt(24, 9));
    const view = detail(db, id, 26);
    // Friday 20 … Monday 23 done; Tuesday 24, the day of the archive, never missed.
    expect(view.periods.week.rate).toBe(100);
    const chart = view.periods.week.chart;
    expect(chart.kind === 'days' && chart.columns.map((column) => column.mark)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'off',
      'off',
      'off',
    ]);
  });

  it('gives nothing for a deleted or unknown mission', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    deleteMission(db, id, clockAt(8, 9));
    expect(getMissionDetail(db, clockAt(8, 10), id)).toBeNull();
    expect(getMissionDetail(db, clockAt(8, 10), 'nope')).toBeNull();
  });
});
