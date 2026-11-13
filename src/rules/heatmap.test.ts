import { heatmapLevel, heatmapWeeks, weekSummary, type HeatmapCell } from './heatmap';
import type { GameDay } from './types';

describe('heatmapLevel', () => {
  it('has four levels: none, less than half, at least half, all', () => {
    expect(heatmapLevel(0, 4)).toBe(0);
    expect(heatmapLevel(1, 4)).toBe(1);
    expect(heatmapLevel(1, 3)).toBe(1);
    expect(heatmapLevel(2, 4)).toBe(2);
    expect(heatmapLevel(3, 4)).toBe(2);
    expect(heatmapLevel(4, 4)).toBe(3);
    expect(heatmapLevel(1, 1)).toBe(3);
  });

  it('is null on a day with no missions expected', () => {
    expect(heatmapLevel(0, 0)).toBeNull();
  });

  it('refuses counts that do not add up', () => {
    expect(() => heatmapLevel(3, 2)).toThrow(RangeError);
    expect(() => heatmapLevel(-1, 2)).toThrow(RangeError);
  });
});

describe('heatmapWeeks', () => {
  it('ends with the week of today, from week_start', () => {
    // Wednesday 18 November 2026, weeks from Monday.
    const weeks = heatmapWeeks('2026-11-18', 3, 1);
    expect(weeks).toEqual([
      { start: '2026-11-02', days: days('2026-11-02', 7) },
      { start: '2026-11-09', days: days('2026-11-09', 7) },
      { start: '2026-11-16', days: ['2026-11-16', '2026-11-17', '2026-11-18'] },
    ]);
  });

  it('follows a week starting on Sunday', () => {
    const weeks = heatmapWeeks('2026-11-18', 1, 7);
    expect(weeks).toEqual([
      { start: '2026-11-15', days: ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'] },
    ]);
  });
});

describe('weekSummary', () => {
  const cell = (day: GameDay, level: HeatmapCell['level'], inRange = true): HeatmapCell => ({
    day,
    level,
    inRange,
  });

  it('counts the full days among the days of the hero', () => {
    expect(
      weekSummary([
        cell('2026-11-02', 3, false),
        cell('2026-11-03', 3),
        cell('2026-11-04', 2),
        cell('2026-11-05', null),
        cell('2026-11-06', 3),
      ]),
    ).toEqual({ full: 2, days: 4 });
  });
});

function days(from: string, count: number): string[] {
  const [y, m, d] = from.split('-').map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
  );
}
