import type { GameDay } from '@/rules/types';

export { formatNumber } from '@/features/shared/amount';

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
