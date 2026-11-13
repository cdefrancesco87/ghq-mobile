import { addDays, isGameDay } from './gameDay';
import type { GameDay } from './types';

// Pausing a single mission (US-ABI-02, design-sezioni.md 3.6). `paused_until` is the first day
// active again (CLAUDE.md, choice 20); the sheet and the rows speak of the last paused day.

function assertGameDay(day: GameDay): void {
  if (!isGameDay(day)) {
    throw new RangeError(`Invalid game day: ${day}`);
  }
}

/** What «Fino a quando?» asks: a number of days, the last paused day, or no end. */
export type PauseChoice =
  { readonly days: number } | { readonly lastDay: GameDay } | { readonly open: true };

/** The `paused_until` of a pause starting today, or null for a pause without an end. */
export function pauseUntil(today: GameDay, choice: PauseChoice): GameDay | null {
  assertGameDay(today);
  if ('open' in choice) {
    return null;
  }
  if ('lastDay' in choice) {
    assertGameDay(choice.lastDay);
    if (choice.lastDay < today) {
      throw new RangeError(`The last day of a pause cannot be in the past: ${choice.lastDay}`);
    }
    return addDays(choice.lastDay, 1);
  }
  if (!Number.isInteger(choice.days) || choice.days < 1) {
    throw new RangeError(`A pause lasts at least one day: ${choice.days}`);
  }
  return addDays(today, choice.days);
}

/** The last paused day, shown as «In pausa fino al …»; null for a pause without an end. */
export function pauseLastDay(pausedUntil: GameDay | null): GameDay | null {
  return pausedUntil === null ? null : addDays(pausedUntil, -1);
}

/** Whether a mission is paused on `day`: a pause with an end day ends by itself on that day. */
export function isPausedOn(
  mission: { readonly status: string; readonly pausedUntil: GameDay | null },
  day: GameDay,
): boolean {
  return mission.status === 'paused' && (mission.pausedUntil === null || day < mission.pausedUntil);
}
