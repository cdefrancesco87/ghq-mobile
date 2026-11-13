import type { GameDay } from '@/rules/types';

/** «1,25»: a value of a measurable mission, at most two decimals. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
}

/** A game day in words, e.g. `{ weekday: 'long', day: 'numeric', month: 'long' }`. */
export function formatDay(
  day: GameDay,
  language: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, dayOfMonth)),
  );
}
