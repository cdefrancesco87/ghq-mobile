import type { GameDay } from './types';

// Game days and calendar arithmetic, without date libraries. Every function works on UTC
// numbers only, so the result never depends on the time zone of the machine that runs it:
// the phone time zone always arrives as a parameter.

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
/** Real time zones go from UTC−12:00 to UTC+14:00; ±18:00 leaves a margin. */
const MAX_TZ_OFFSET_MINUTES = 18 * 60;

const GAME_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_CHANGE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Formats a day number (days since 1970-01-01) as `YYYY-MM-DD`. */
function formatDayNumber(dayNumber: number): GameDay {
  const date = new Date(dayNumber * MS_PER_DAY);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Day out of range: ${dayNumber}`);
  }
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as GameDay;
}

/** Day number (days since 1970-01-01) of a `YYYY-MM-DD` string, or NaN if it is not a real date. */
function parseDayNumber(value: string): number {
  const match = GAME_DAY_PATTERN.exec(value);
  if (!match) {
    return Number.NaN;
  }
  const [, year, month, day] = match;
  const dayNumber = Date.UTC(Number(year), Number(month) - 1, Number(day)) / MS_PER_DAY;
  // Date.UTC turns 2026-02-30 into 2 March and reads the years 0–99 as 1900–1999:
  // formatting the result back catches both cases.
  return formatDayNumber(dayNumber) === value ? dayNumber : Number.NaN;
}

function toDayNumber(day: GameDay): number {
  const dayNumber = parseDayNumber(day);
  if (Number.isNaN(dayNumber)) {
    throw new RangeError(`Invalid game day: ${day}`);
  }
  return dayNumber;
}

/** Minutes after midnight of a day change time in the `HH:MM` format, from 00:00 to 23:59. */
function parseDayChange(dayChange: string): number {
  const match = DAY_CHANGE_PATTERN.exec(dayChange);
  if (!match) {
    throw new RangeError(`Invalid day change time (expected HH:MM): ${dayChange}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** True when `value` is a real date in the `YYYY-MM-DD` format. */
export function isGameDay(value: unknown): value is GameDay {
  return typeof value === 'string' && !Number.isNaN(parseDayNumber(value));
}

/**
 * The game day an instant belongs to.
 *
 * @param instantMs UTC instant in milliseconds.
 * @param tzOffsetMinutes Offset of the phone time zone at that instant, in minutes east of UTC:
 *   local time = UTC + offset. Rome is +60 in winter and +120 in summer, New York −300 in winter.
 *   It has the opposite sign of `Date.prototype.getTimezoneOffset()`.
 * @param dayChange Local time when the game day changes, `HH:MM` (06:00 by default). Before that
 *   time an instant still belongs to the previous game day.
 */
export function toGameDay(instantMs: number, tzOffsetMinutes: number, dayChange: string): GameDay {
  if (!Number.isFinite(instantMs)) {
    throw new RangeError(`Invalid instant: ${instantMs}`);
  }
  if (!Number.isInteger(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > MAX_TZ_OFFSET_MINUTES) {
    throw new RangeError(`Invalid time zone offset in minutes: ${tzOffsetMinutes}`);
  }
  const changeMinutes = parseDayChange(dayChange);
  // Moving the instant back by the day change time makes the game day start at midnight.
  const shiftedMs = instantMs + (tzOffsetMinutes - changeMinutes) * MS_PER_MINUTE;
  return formatDayNumber(Math.floor(shiftedMs / MS_PER_DAY));
}

/** The game day `days` days after `day` (before it, when `days` is negative). */
export function addDays(day: GameDay, days: number): GameDay {
  if (!Number.isInteger(days)) {
    throw new RangeError(`The number of days must be an integer: ${days}`);
  }
  return formatDayNumber(toDayNumber(day) + days);
}

/** Calendar days from `from` to `to`: positive when `to` comes later. */
export function diffDays(from: GameDay, to: GameDay): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** ISO weekday of a game day: 1 = Monday … 7 = Sunday. */
export function weekday(day: GameDay): Weekday {
  // Day number 0, 1 January 1970, was a Thursday. The second modulo keeps the result positive
  // for the days before 1970.
  const daysSinceMonday = (((toDayNumber(day) + 3) % 7) + 7) % 7;
  return (daysSinceMonday + 1) as Weekday;
}

/** The first day of the week that contains `day`, for weeks that start on `weekStart`. */
export function weekStartOf(day: GameDay, weekStart: Weekday): GameDay {
  if (!Number.isInteger(weekStart) || weekStart < 1 || weekStart > 7) {
    throw new RangeError(`Invalid week start (expected 1 to 7): ${weekStart}`);
  }
  return addDays(day, -((weekday(day) - weekStart + 7) % 7));
}

/**
 * The whole game days strictly between `from` and `to`, in order. With `from` the last closed
 * day and `to` today, these are the days still to close. The list is empty when `to` is not at
 * least two days after `from`, for example after a flight west that moved the game day back.
 */
export function daysBetween(from: GameDay, to: GameDay): GameDay[] {
  const days: GameDay[] = [];
  const end = toDayNumber(to);
  for (let dayNumber = toDayNumber(from) + 1; dayNumber < end; dayNumber++) {
    days.push(formatDayNumber(dayNumber));
  }
  return days;
}
