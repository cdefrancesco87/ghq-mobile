import type { SettingValue } from '@/db/repositories/settings';
import { formatClock } from '@/features/shared/formatClock';
import type { Weekday } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';

// The words of the Settings that come from the calendar of the language (Intl): weekdays, dates
// and times, so no list of names has to be translated by hand.

/** Monday 2 November 2026: the weekday `n` is `n - 1` days later. */
const A_MONDAY = Date.UTC(2026, 10, 2);
const MS_PER_DAY = 86_400_000;

/** The times of the day change: from 00:00 to 06:00 every 30 minutes (design 10.5). */
export const DAY_CHANGE_TIMES: readonly string[] = Array.from({ length: 13 }, (_, index) => {
  const minutes = index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});

/** The weekdays in the order of the week, from its first day. */
export function weekdaysFrom(weekStart: Weekday): Weekday[] {
  return Array.from({ length: 7 }, (_, index) => (((weekStart - 1 + index) % 7) + 1) as Weekday);
}

const capitalize = (text: string, language: string) =>
  text.charAt(0).toLocaleUpperCase(language) + text.slice(1);

/** «Lunedì», «Lun», «L»: the name of a weekday in the language. */
export function weekdayName(
  day: Weekday,
  language: string,
  style: 'long' | 'short' | 'narrow' = 'long',
): string {
  const name = new Intl.DateTimeFormat(language, { weekday: style, timeZone: 'UTC' }).format(
    new Date(A_MONDAY + (day - 1) * MS_PER_DAY),
  );
  return capitalize(name, language);
}

/** «7 novembre» of a game day. */
export function dayAndMonth(day: GameDay, language: string): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, dayOfMonth)));
}

/** The rest days in the order of the week, short: «Sab, Dom». */
export function restDaysText(
  days: readonly Weekday[],
  weekStart: Weekday,
  language: string,
): string {
  return weekdaysFrom(weekStart)
    .filter((day) => days.includes(day))
    .map((day) => weekdayName(day, language, 'short'))
    .join(', ');
}

export type QuietInterval = SettingValue<'quiet_hours'>[number];

/** The start and the end of an interval of «Non disturbare», in the way of the language. */
export function quietTimes(interval: QuietInterval, language: string) {
  return { start: formatClock(interval.start, language), end: formatClock(interval.end, language) };
}
