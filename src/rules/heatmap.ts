import { addDays, weekStartOf, type Weekday } from './gameDay';
import type { GameDay } from './types';

// The heatmap of Statistics (design-sezioni.md 8.3): a strip of weeks with today on the right and
// four colours of completion. Skipped and paused missions are not in the counts of the day.

/** 0 nothing done, 1 less than half, 2 at least half, 3 all; null with no missions expected. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | null;

/** A day of the strip; `inRange` is false before the hero existed. */
export interface HeatmapCell {
  readonly day: GameDay;
  readonly level: HeatmapLevel;
  readonly inRange: boolean;
}

/** A column of the strip: the days of a week from `week_start`, the last one ending today. */
export interface HeatmapWeekDays {
  readonly start: GameDay;
  readonly days: readonly GameDay[];
}

/** The colour level of a day with `done` missions out of `scheduled`. */
export function heatmapLevel(done: number, scheduled: number): HeatmapLevel {
  if (!Number.isInteger(done) || !Number.isInteger(scheduled) || done < 0 || done > scheduled) {
    throw new RangeError(`Invalid day counts: ${done} of ${scheduled}`);
  }
  if (scheduled === 0) {
    return null;
  }
  if (done === 0) {
    return 0;
  }
  if (done === scheduled) {
    return 3;
  }
  return done * 2 < scheduled ? 1 : 2;
}

/** The week of today and the `count - 1` weeks before it; the last stops at today. */
export function heatmapWeeks(today: GameDay, count: number, weekStart: Weekday): HeatmapWeekDays[] {
  const current = weekStartOf(today, weekStart);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(current, 7 * (index - count + 1));
    const days: GameDay[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const day = addDays(start, offset);
      if (day > today) {
        break;
      }
      days.push(day);
    }
    return { start, days };
  });
}

/** For the screen reader (8.12): the days with every mission done among the days of the hero. */
export function weekSummary(cells: readonly HeatmapCell[]): { full: number; days: number } {
  const inRange = cells.filter((cell) => cell.inRange);
  return { full: inRange.filter((cell) => cell.level === 3).length, days: inRange.length };
}
