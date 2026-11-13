import { closePendingDays } from '@/db/repositories/closing';
import { getHeatmap, getHeatmapDay, type HeatmapView } from '@/db/repositories/heatmap';
import { deleteMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { missionDays } from '@/db/schema';
import type { Db } from '@/db/types';
import { HEATMAP } from '@/rules/config';
import type { GameDay } from '@/rules/types';

import { at, clockAt, missionId, newGame } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome; "today" is a later day of November.

const DAILY = ['journal', 'meditation', 'read_pages', 'no_social_evening'];

function mark(
  db: Db,
  key: string,
  days: readonly GameDay[],
  status: 'done' | 'skipped' = 'done',
): void {
  const id = missionId(db, key);
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

function cell(view: HeatmapView, day: GameDay) {
  for (const week of view.weeks) {
    const found = week.cells.find((item) => item.day === day);
    if (found !== undefined) {
      return found;
    }
  }
  throw new Error(`No cell for ${day}`);
}

describe('getHeatmap', () => {
  it('has 12 months of weeks with today last', () => {
    const db = newGame(DAILY);
    const view = getHeatmap(db, clockAt(18, 10));
    expect(view.today).toBe('2026-11-18');
    expect(view.weeks).toHaveLength(HEATMAP.weeks);
    const last = view.weeks[view.weeks.length - 1];
    expect(last.start).toBe('2026-11-16');
    expect(last.cells.map((item) => item.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });

  it('colours the closed days in four levels', () => {
    const db = newGame(DAILY);
    // Friday 6: nothing; Saturday 7: 1 of 4; Sunday 8: 2 of 4; Monday 9: 4 of 4.
    mark(db, 'journal', ['2026-11-07', '2026-11-08', '2026-11-09']);
    mark(db, 'meditation', ['2026-11-08', '2026-11-09']);
    mark(db, 'read_pages', ['2026-11-09']);
    mark(db, 'no_social_evening', ['2026-11-09']);
    closePendingDays(db, clockAt(10, 10));
    const view = getHeatmap(db, clockAt(10, 10));
    expect(cell(view, '2026-11-06').level).toBe(0);
    expect(cell(view, '2026-11-07').level).toBe(1);
    expect(cell(view, '2026-11-08').level).toBe(2);
    expect(cell(view, '2026-11-09').level).toBe(3);
    expect(view.anyDay).toBe(true);
  });

  it('leaves empty a day with no missions expected and the days before the hero', () => {
    const db = newGame(DAILY);
    setSetting(db, 'rest_days', [6], at(6, 10));
    closePendingDays(db, clockAt(9, 10));
    const view = getHeatmap(db, clockAt(9, 10));
    expect(cell(view, '2026-11-07')).toEqual({ day: '2026-11-07', level: null, inRange: true });
    expect(cell(view, '2026-11-05')).toEqual({ day: '2026-11-05', level: null, inRange: false });
  });

  it('leaves the skipped missions out of the day', () => {
    const db = newGame(['journal', 'meditation']);
    mark(db, 'journal', ['2026-11-07']);
    mark(db, 'meditation', ['2026-11-07'], 'skipped');
    closePendingDays(db, clockAt(8, 10));
    expect(cell(getHeatmap(db, clockAt(8, 10)), '2026-11-07').level).toBe(3);
  });

  it('colours today with what is done so far', () => {
    const db = newGame(['journal', 'meditation']);
    closePendingDays(db, clockAt(8, 10));
    expect(cell(getHeatmap(db, clockAt(8, 10)), '2026-11-08').level).toBe(0);
    mark(db, 'journal', ['2026-11-08']);
    expect(cell(getHeatmap(db, clockAt(8, 10)), '2026-11-08').level).toBe(2);
  });

  it('has no coloured day in the first day of the hero', () => {
    const db = newGame(['journal']);
    expect(getHeatmap(db, clockAt(6, 10)).anyDay).toBe(false);
  });
});

describe('getHeatmapDay', () => {
  it('lists the missions of a closed day: done, missed, skipped', () => {
    const db = newGame(['journal', 'meditation', 'read_pages']);
    mark(db, 'journal', ['2026-11-07']);
    mark(db, 'meditation', ['2026-11-07'], 'skipped');
    closePendingDays(db, clockAt(8, 10));
    const day = getHeatmapDay(db, clockAt(8, 10), '2026-11-07');
    expect(day).toMatchObject({ day: '2026-11-07', done: 1, scheduled: 2, rate: 50 });
    expect(day.missions.map(({ mission, mark }) => [mission.templateKey, mark])).toEqual([
      ['journal', 'done'],
      ['meditation', 'skipped'],
      ['read_pages', 'missed'],
    ]);
  });

  it('shows today with the missions still to do', () => {
    const db = newGame(['journal', 'meditation']);
    mark(db, 'journal', ['2026-11-06']);
    const day = getHeatmapDay(db, clockAt(6, 10), '2026-11-06');
    expect(day).toMatchObject({ done: 1, scheduled: 2, rate: 50 });
    expect(day.missions.map(({ mark }) => mark)).toEqual(['done', 'open']);
  });

  it('marks a week of «N volte a settimana» missed on its last day', () => {
    const db = newGame(['call_friend'], 9);
    // Monday 9 to Sunday 15: never called.
    closePendingDays(db, clockAt(16, 10));
    expect(getHeatmapDay(db, clockAt(16, 10), '2026-11-14').missions).toEqual([]);
    const sunday = getHeatmapDay(db, clockAt(16, 10), '2026-11-15');
    expect(sunday.missions.map(({ mark }) => mark)).toEqual(['missed']);
    expect(sunday).toMatchObject({ done: 0, scheduled: 1, rate: 0 });
  });

  it('excludes the deleted missions', () => {
    const db = newGame(['journal', 'meditation']);
    mark(db, 'journal', ['2026-11-07']);
    deleteMission(db, missionId(db, 'meditation'), clockAt(8, 9));
    closePendingDays(db, clockAt(8, 10));
    const day = getHeatmapDay(db, clockAt(8, 10), '2026-11-07');
    expect(day.missions.map(({ mission }) => mission.templateKey)).toEqual(['journal']);
  });

  it('has no rate on a day with no missions expected', () => {
    const db = newGame(['journal']);
    setSetting(db, 'rest_days', [6], at(6, 10));
    closePendingDays(db, clockAt(8, 10));
    expect(getHeatmapDay(db, clockAt(8, 10), '2026-11-07')).toMatchObject({
      rate: null,
      missions: [],
    });
  });
});
