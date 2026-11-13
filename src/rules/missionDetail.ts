import { isScheduled } from './frequency';
import { addDays, diffDays, weekday, weekStartOf, type Weekday } from './gameDay';
import { archivedWindow, completionCounts, isPaused, rateOf, type RateInput } from './missionRate';
import type { GameDay } from './types';

// The charts of the detail of a mission (design-sezioni.md 8.5). PROVISIONAL (gap L15, not yet
// approved): period Settimana shows one mark per day, Mese the rate of every week and Anno the
// rate of every calendar month; a measurable mission adds its value of every day.

/** A row of `mission_days` with the value reached by a measurable mission. */
export interface DetailDay {
  readonly gameDay: GameDay;
  readonly status: string;
  readonly value: number | null;
}

/** What the charts of a mission need: its rate input without a window, and the values. */
export type DetailInput = Omit<RateInput, 'lastDay' | 'days' | 'windowDays' | 'lastDayClosed'> & {
  readonly days: readonly DetailDay[];
};

/** A column of a chart: the game days from `from` to `to`, both included. */
export interface Bucket {
  readonly from: GameDay;
  readonly to: GameDay;
}

/**
 * What a day was for a mission: done, missed, skipped, expected today and not done yet, or not
 * expected (rest, pause, frequency, before the creation or from the day of the archive).
 */
export type DayMark = 'done' | 'missed' | 'skipped' | 'open' | 'off';

/** The week of today and the `count - 1` weeks before it, from `week_start`; the last ends today. */
export function weekBuckets(today: GameDay, count: number, weekStart: Weekday): Bucket[] {
  const current = weekStartOf(today, weekStart);
  return Array.from({ length: count }, (_, index) => {
    const from = addDays(current, 7 * (index - count + 1));
    const end = addDays(from, 6);
    return { from, to: end < today ? end : today };
  });
}

/** The calendar month of today and the `count - 1` months before it; the last ends today. */
export function monthBuckets(today: GameDay, count: number): Bucket[] {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    // Months from 0, like Date.UTC, which carries them over the years.
    const first = new Date(Date.UTC(year, month - 1 + index - count + 1, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const from = first.toISOString().slice(0, 10) as GameDay;
    const end = last.toISOString().slice(0, 10) as GameDay;
    return { from, to: end < today ? end : today };
  });
}

/**
 * The completion rate of the days of a column, from 0 to 100, or null when nothing was expected.
 * A column of the past is closed; the one of today is still open. For «N volte a settimana» the
 * column takes the whole weeks that end in it, so a week cut by two months goes to the later one.
 */
export function bucketRate(
  input: DetailInput,
  bucket: Bucket,
  today: GameDay,
  archivedDay: GameDay | null,
): number | null {
  let { from, to } = bucket;
  if (input.mission.frequency?.type === 'times_per_week') {
    from = weekStartOf(from, input.weekStart);
    const lastWeek = weekStartOf(to, input.weekStart);
    if (to < today && addDays(lastWeek, 6) !== to) {
      to = addDays(lastWeek, -1);
    }
  }
  const lastDay = to < today ? to : today;
  if (lastDay < from) {
    return null;
  }
  const window = archivedWindow(
    { lastDay, lastDayClosed: lastDay < today, windowDays: diffDays(from, lastDay) + 1 },
    archivedDay,
  );
  return rateOf(completionCounts({ ...input, ...window }));
}

/** What `day` was for the mission, seen from `today`. */
export function dayMark(
  input: DetailInput,
  day: GameDay,
  today: GameDay,
  archivedDay: GameDay | null,
): DayMark {
  const status = input.days.find((row) => row.gameDay === day)?.status;
  if (status === 'done' || status === 'skipped') {
    return status;
  }
  const { mission } = input;
  // The day of the archive is never missed, like in the rates (`archivedWindow`).
  if (day < mission.createdDay || (archivedDay !== null && day >= archivedDay)) {
    return 'off';
  }
  if (mission.kind === 'task') {
    const done = input.days.some((row) => row.status === 'done');
    if (done || mission.dueDay !== day) {
      return 'off';
    }
    return day < today ? 'missed' : 'open';
  }
  // A week of «N volte a settimana» is judged as a whole: no day of it is missed.
  if (mission.frequency === null || mission.frequency.type === 'times_per_week') {
    return 'off';
  }
  if (
    !isScheduled(mission.frequency, day, { weekStart: input.weekStart, completedDays: [] }) ||
    input.restDays.includes(weekday(day)) ||
    isPaused(day, input.pauses)
  ) {
    return 'off';
  }
  return day < today ? 'missed' : 'open';
}

function valuesIn(input: DetailInput, from: GameDay, to: GameDay): number[] {
  return input.days
    .filter((row) => row.gameDay >= from && row.gameDay <= to)
    .map((row) => row.value ?? 0)
    .filter((value) => value > 0);
}

function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** The average value of the days with a value from `from` to `to`, or null without any. */
export function averageValue(input: DetailInput, from: GameDay, to: GameDay): number | null {
  return average(valuesIn(input, from, to));
}

/** The average value of every column, on its days with a value. */
export function bucketAverages(input: DetailInput, buckets: readonly Bucket[]): (number | null)[] {
  return buckets.map((bucket) => averageValue(input, bucket.from, bucket.to));
}
