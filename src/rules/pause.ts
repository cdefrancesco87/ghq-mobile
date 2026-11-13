import { addDays, diffDays, isGameDay } from './gameDay';
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

// The general pause (CLAUDE.md, choice 23; modello-dati.md 3.10 and 4.2): unlike the
// `paused_until` of a mission, its `untilDay` is the last paused day, included, and null for a
// pause without an end.

/** A general pause in progress, scheduled or over. */
export interface PauseInterval {
  readonly fromDay: GameDay;
  /** The last paused day, included; null for a pause without an end. */
  readonly untilDay: GameDay | null;
}

/** The pause events of the log, in the order they were written. */
export type PauseEvent =
  | { readonly type: 'pause.started'; readonly payload: PauseInterval }
  | {
      readonly type: 'pause.changed';
      readonly payload: PauseInterval & { readonly oldUntilDay: GameDay | null };
    }
  | {
      readonly type: 'pause.ended';
      readonly payload: PauseInterval & { readonly cancelled?: boolean };
    };

/**
 * The general pauses written in the log, oldest first: a pause started (now or in the future),
 * with its end changed by «Cambia» or «Riprendi», and closed by its end. A scheduled pause
 * cancelled before its start leaves nothing.
 */
export function pauseIntervals(events: readonly PauseEvent[]): PauseInterval[] {
  const byStart = new Map<GameDay, PauseInterval>();
  for (const event of events) {
    const { fromDay, untilDay } = event.payload;
    if (event.type === 'pause.ended' && event.payload.cancelled === true) {
      byStart.delete(fromDay);
    } else {
      byStart.set(fromDay, { fromDay, untilDay });
    }
  }
  return [...byStart.values()].sort((a, b) => (a.fromDay < b.fromDay ? -1 : 1));
}

function contains(interval: PauseInterval, day: GameDay): boolean {
  return day >= interval.fromDay && (interval.untilDay === null || day <= interval.untilDay);
}

/** Whether `day` is a day of general pause. */
export function isPausedDay(day: GameDay, intervals: readonly PauseInterval[]): boolean {
  return intervals.some((interval) => contains(interval, day));
}

/** How many days of general pause fall between `from` and `to`, both included. */
export function pausedDaysBetween(
  intervals: readonly PauseInterval[],
  from: GameDay,
  to: GameDay,
): number {
  let count = 0;
  for (const interval of intervals) {
    const start = interval.fromDay > from ? interval.fromDay : from;
    const end = interval.untilDay === null || interval.untilDay > to ? to : interval.untilDay;
    if (start <= end) {
      count += diffDays(start, end) + 1;
    }
  }
  return count;
}

/** The days of a pause with an end, the first and the last included. */
export function pauseLength(interval: {
  readonly fromDay: GameDay;
  readonly untilDay: GameDay;
}): number {
  return diffDays(interval.fromDay, interval.untilDay) + 1;
}

/**
 * The first day of a window of `windowDays` days not paused that ends on `end`: the days of
 * general pause stretch it back (choice 23), e.g. the windows of the form arrow.
 */
export function windowStartOutsidePause(
  end: GameDay,
  windowDays: number,
  intervals: readonly PauseInterval[],
): GameDay {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new RangeError(`A window lasts at least one day: ${windowDays}`);
  }
  let day = end;
  let counted = isPausedDay(day, intervals) ? 0 : 1;
  while (counted < windowDays) {
    day = addDays(day, -1);
    if (!isPausedDay(day, intervals)) {
      counted += 1;
    }
  }
  return day;
}

/**
 * The deadline of a boss once `pause` is over (endPauseIfOver): a deadline from the first paused
 * day on moves forward by the paused days, an earlier one stays. Null while a pause without an end
 * holds the deadline, which is not known yet.
 */
export function deadlineAfterPause(deadline: GameDay, pause: PauseInterval | null): GameDay | null {
  if (pause === null || deadline < pause.fromDay) {
    return deadline;
  }
  return pause.untilDay === null
    ? null
    : addDays(deadline, pauseLength({ fromDay: pause.fromDay, untilDay: pause.untilDay }));
}

/**
 * A deadline the general pause holds («Scadenza ferma», design 2.8): it falls from the first paused
 * day on, so it moves when the pause ends (endPauseIfOver).
 */
export function isDeadlineHeld(
  deadline: GameDay | null,
  pause: { readonly fromDay: GameDay } | null,
): boolean {
  return deadline !== null && pause !== null && deadline >= pause.fromDay;
}
