import { STAT_TREND } from './config';
import type { StatChange } from './statTrend';
import { levelsAt, monthStart, statTrend } from './statTrend';

describe('levelsAt', () => {
  it('adds the points up to the day, undone points included', () => {
    const changes: StatChange[] = [
      { gameDay: '2026-09-01', stats: { strength: 100 } },
      { gameDay: '2026-09-02', stats: { strength: 200, wisdom: 30 } },
      { gameDay: '2026-09-02', stats: { strength: -200 } },
      { gameDay: '2026-10-01', stats: { strength: 200 } },
    ];
    expect(levelsAt(changes, '2026-09-30')).toMatchObject({ strength: 1, wisdom: 0 });
    expect(levelsAt(changes, '2026-10-01')).toMatchObject({ strength: 2, discipline: 0 });
  });
});

describe('monthStart', () => {
  it('goes back across the years', () => {
    expect(monthStart('2026-11-13')).toBe('2026-11-01');
    expect(monthStart('2026-02-13', 3)).toBe('2025-11-01');
  });
});

describe('statTrend', () => {
  const changes: StatChange[] = [
    { gameDay: '2026-05-10', stats: { strength: 300 } },
    { gameDay: '2026-08-31', stats: { strength: 300 } },
    { gameDay: '2026-09-15', stats: { strength: 400 } },
    { gameDay: '2026-11-02', stats: { strength: 500 } },
  ];

  it('gives the level at the end of each of the last months, today for the current one', () => {
    expect(STAT_TREND.chartMonths).toBe(6);
    const trend = statTrend(changes, '2026-01-01', '2026-11-13');
    expect(trend.months.map((month) => month.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    // 300 points: level 2; 600: level 3; 1000: level 4; 1500: level 5.
    expect(trend.months.map((month) => month.levels.strength)).toEqual([2, 2, 3, 4, 4, 5]);
    // «da 3 a 5 negli ultimi 3 mesi»: the level at the end of August, and today.
    expect(trend.from.strength).toBe(3);
    expect(trend.to.strength).toBe(5);
  });

  it('starts at the month of the hero', () => {
    const trend = statTrend(changes, '2026-10-20', '2026-11-13');
    expect(trend.months.map((month) => month.month)).toEqual(['2026-10', '2026-11']);
  });
});
