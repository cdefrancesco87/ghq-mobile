import { HEALTH } from './config';
import type { GameDay } from './types';

// The data of Apple Salute and Health Connect that move a measurable mission by themselves
// (design-sezioni.md 12.7, analisi-funzionale.md US-WID-02). Pure functions: the reading itself
// is done by the health source of the phone, outside the rules.

export const HEALTH_METRICS = ['steps', 'active_minutes', 'sleep_hours'] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

const UNITS: Readonly<Record<HealthMetric, string>> = {
  steps: 'step',
  active_minutes: 'minute',
  sleep_hours: 'hour',
};

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The unit of the goal of a mission linked to a metric: a key of the units of the editor. */
export function healthUnit(metric: HealthMetric): string {
  return UNITS[metric];
}

export interface HealthWindowInput {
  readonly metric: HealthMetric;
  readonly day: GameDay;
  /** Local `HH:MM` when the game day starts. */
  readonly dayChange: string;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
  /** UTC instant of the reading, in milliseconds. */
  readonly now: number;
}

/** UTC instants, in milliseconds. */
export interface HealthWindow {
  readonly start: number;
  readonly end: number;
}

/**
 * The time a reading covers for a game day: from its start until now, never past its end. Sleep
 * starts some hours earlier (`HEALTH.sleepLookbackHours`), so the night before counts.
 */
export function healthWindow(input: HealthWindowInput): HealthWindow {
  const [year, month, dayOfMonth] = input.day.split('-').map(Number);
  const [hours, minutes] = input.dayChange.split(':').map(Number);
  const dayStart =
    Date.UTC(year, month - 1, dayOfMonth) + (hours * 60 + minutes - input.tzOffset) * MS_PER_MINUTE;
  const lookback = input.metric === 'sleep_hours' ? HEALTH.sleepLookbackHours * MS_PER_HOUR : 0;
  return { start: dayStart - lookback, end: Math.min(input.now, dayStart + MS_PER_DAY) };
}

/** A reading as the value of a mission: whole steps and minutes, tenths of an hour of sleep. */
export function healthValue(metric: HealthMetric, reading: number): number {
  if (!Number.isFinite(reading) || reading <= 0) {
    return 0;
  }
  if (metric === 'sleep_hours') {
    const scale = 10 ** HEALTH.sleepDecimals;
    // The small epsilon keeps 7.3 from becoming 7.2 through the binary fractions.
    return Math.floor(reading * scale + 1e-9) / scale;
  }
  return Math.floor(reading);
}

/** What a reading adds to the value already reached today; a lower reading adds nothing. */
export function healthAmount(current: number, reading: number): number {
  const amount = Math.round((reading - current) * 100) / 100;
  return amount > 0 ? amount : 0;
}

/**
 * Hours asleep in a window from the sleep samples of the phone, which can overlap (the watch and
 * the phone record the same night): every minute counts once.
 */
export function sleepHoursOf(
  intervals: readonly { readonly start: number; readonly end: number }[],
  window: HealthWindow,
): number {
  const clipped = intervals
    .map(({ start, end }) => ({
      start: Math.max(start, window.start),
      end: Math.min(end, window.end),
    }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let coveredUntil = -Infinity;
  for (const { start, end } of clipped) {
    const from = Math.max(start, coveredUntil);
    if (end > from) {
      total += end - from;
    }
    coveredUntil = Math.max(coveredUntil, end);
  }
  return total / MS_PER_HOUR;
}
