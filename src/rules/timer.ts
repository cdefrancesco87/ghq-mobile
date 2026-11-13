import { TIMER } from './config';

// The timer of a duration mission (design-sezioni.md 2.5; backlog T79): it saves only the instant
// it started, so it goes on with the app closed and the screen off. What it counted before a
// pause is already in the value of the day, in minutes.

const MINUTE_MS = 60_000;

export interface TimerInput {
  /** UTC instant of the start in milliseconds; null when the timer is not running. */
  readonly startedAt: number | null;
  /** The target of the mission, in minutes. */
  readonly target: number;
  /** The minutes already saved today. */
  readonly value: number;
}

/** The instant the running timer reaches the target. */
export function timerEndsAt({
  startedAt,
  target,
  value,
}: TimerInput & { readonly startedAt: number }): number {
  return startedAt + Math.max(target - value, 0) * MINUTE_MS;
}

/** The milliseconds still missing from the target at `now`, never less than zero. */
export function timerRemainingMs(input: TimerInput & { readonly now: number }): number {
  const { startedAt, target, value, now } = input;
  const missing = Math.max(target - value, 0) * MINUTE_MS;
  if (startedAt === null) {
    return missing;
  }
  // A clock read before the start (a view drawn earlier) shows the whole time missing.
  return Math.min(Math.max(timerEndsAt({ startedAt, target, value }) - now, 0), missing);
}

/** The minutes from `startedAt` to `now`, with the decimals of `TIMER.minuteDecimals`. */
export function elapsedMinutes(startedAt: number, now: number): number {
  const scale = 10 ** TIMER.minuteDecimals;
  return Math.round((Math.max(now - startedAt, 0) / MINUTE_MS) * scale) / scale;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** «09:30», or «1:05:00» beyond an hour; a started second counts as a whole one. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(ms, 0) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
