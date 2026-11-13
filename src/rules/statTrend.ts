import { STAT_TREND } from './config';
import { addDays } from './gameDay';
import { statLevel } from './stats';
import { STAT_KEYS, type GameDay, type StatKey, type StatPoints } from './types';

// The trend of the stats of the hero (design-sezioni.md 8.8; backlog T81): the level of each stat
// at the end of every month, from the stat points of the event log, and the sentence «Forza: da 3
// a 7 negli ultimi 3 mesi». An undone completion takes its points back in the log, so the sums
// are the points really held.

/** The stat points changed on a game day (the `d_stats` of an event). */
export interface StatChange {
  readonly gameDay: GameDay;
  readonly stats: StatPoints;
}

export type StatLevels = Readonly<Record<StatKey, number>>;

export interface StatTrendMonth {
  /** `YYYY-MM`. */
  readonly month: string;
  /** The level of each stat at the end of the month; for the current month, today. */
  readonly levels: StatLevels;
}

export interface StatTrend {
  /** Oldest first, the current month last; never before the month of the hero. */
  readonly months: readonly StatTrendMonth[];
  /** The levels at the start of the last `STAT_TREND.sentenceMonths` months, and now. */
  readonly from: StatLevels;
  readonly to: StatLevels;
}

/** The levels of the stats with the points changed up to `day`, included. */
export function levelsAt(changes: readonly StatChange[], day: GameDay): StatLevels {
  const points = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as Record<StatKey, number>;
  for (const change of changes) {
    if (change.gameDay <= day) {
      for (const key of STAT_KEYS) {
        points[key] += change.stats[key] ?? 0;
      }
    }
  }
  return Object.fromEntries(
    STAT_KEYS.map((key) => [key, statLevel(Math.max(0, points[key]))]),
  ) as Record<StatKey, number>;
}

/** The first day of the month `months` months before the month of `day` (0 = its own month). */
export function monthStart(day: GameDay, months = 0): GameDay {
  const [year, month] = day.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 - months, 1));
  return date.toISOString().slice(0, 10) as GameDay;
}

/** The trend up to `today`, for a hero created on `firstDay`. */
export function statTrend(
  changes: readonly StatChange[],
  firstDay: GameDay,
  today: GameDay,
): StatTrend {
  const months: StatTrendMonth[] = [];
  for (let back = STAT_TREND.chartMonths - 1; back >= 0; back--) {
    const start = monthStart(today, back);
    if (start < monthStart(firstDay)) {
      continue;
    }
    const end = back === 0 ? today : addDays(monthStart(today, back - 1), -1);
    months.push({ month: start.slice(0, 7), levels: levelsAt(changes, end) });
  }
  return {
    months,
    from: levelsAt(changes, addDays(monthStart(today, STAT_TREND.sentenceMonths - 1), -1)),
    to: levelsAt(changes, today),
  };
}
