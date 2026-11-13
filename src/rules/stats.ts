import { DIFFICULTY_VALUES, STATS } from './config';
import { DIFFICULTIES, STAT_KEYS, type Difficulty, type StatKey, type StatPoints } from './types';

/** Form arrow next to a stat: more or fewer points than in the window before. */
export type FormArrow = 'up' | 'down';

function assertStatKey(stat: string): void {
  if (!(STAT_KEYS as readonly string[]).includes(stat)) {
    throw new RangeError(`Unknown stat: ${stat}`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${value}`);
  }
}

/**
 * Stat points of one completion: 10, 20 or 30 to the primary stat by difficulty, and 30% of
 * them, rounded down, to the optional secondary stat. Without a primary stat there are no points.
 */
export function statPoints(
  difficulty: Difficulty,
  primary: StatKey | null,
  secondary: StatKey | null,
): StatPoints {
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    throw new RangeError(`Unknown difficulty: ${difficulty}`);
  }
  if (primary !== null) {
    assertStatKey(primary);
  }
  if (secondary !== null) {
    assertStatKey(secondary);
    if (secondary === primary) {
      throw new RangeError(`The secondary stat must differ from the primary one: ${secondary}`);
    }
  }
  if (primary === null) {
    return {};
  }
  const primaryPoints = DIFFICULTY_VALUES[difficulty].statPoints;
  const points: StatPoints = { [primary]: primaryPoints };
  if (secondary !== null) {
    points[secondary] = Math.floor(primaryPoints * STATS.secondaryShare);
  }
  return points;
}

/** Points needed to take a stat from `level` to the next one: 100 × (level + 1). */
export function statPointsToNext(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > STATS.levelMax) {
    throw new RangeError(`Invalid stat level (expected 0 to ${STATS.levelMax}): ${level}`);
  }
  return STATS.pointsToNextFactor * (level + STATS.pointsToNextOffset);
}

/** Where a stat stands: its level and the points towards the next one. */
export interface StatProgress {
  /** From 0 to STATS.levelMax. */
  readonly level: number;
  /** Points gained inside the level; at the cap, all the points above it. */
  readonly inLevel: number;
  /** Points of the whole level, to reach the next one; null at the cap. */
  readonly toNext: number | null;
  /** The stat is at the cap of the first version («Max», design-sezioni.md 9.4). */
  readonly max: boolean;
}

/** Level of a stat and points towards the next level, from its total points. */
export function statProgress(points: number): StatProgress {
  assertNonNegativeInteger(points, 'Stat points');
  let level = 0;
  let remaining = points;
  while (level < STATS.levelMax && remaining >= statPointsToNext(level)) {
    remaining -= statPointsToNext(level);
    level++;
  }
  const max = level === STATS.levelMax;
  return { level, inLevel: remaining, toNext: max ? null : statPointsToNext(level), max };
}

/** Level of a stat from its total points: from 0 up to the cap, while the points keep adding up. */
export function statLevel(points: number): number {
  return statProgress(points).level;
}

/**
 * Form arrow of a stat: up with at least 10% more points in the last 30 days than in the 30
 * days before, down with at least 10% fewer, none for a smaller change. It never shows in the
 * first 30 days of use.
 *
 * @param last30 Points gained in the last 30 days.
 * @param prev30 Points gained in the 30 days before.
 * @param daysOfUse Days since the first use of the app, counting the first day as 1.
 */
export function formArrow(last30: number, prev30: number, daysOfUse: number): FormArrow | null {
  assertNonNegativeInteger(last30, 'Points of the last 30 days');
  assertNonNegativeInteger(prev30, 'Points of the 30 days before');
  if (!Number.isInteger(daysOfUse) || daysOfUse < 1) {
    throw new RangeError(`Days of use must be an integer from 1: ${daysOfUse}`);
  }
  if (daysOfUse <= STATS.formHiddenFirstDays || last30 === prev30) {
    return null;
  }
  if (prev30 === 0) {
    return 'up';
  }
  // With integer points a change of exactly 10% gives the same number as the 0.1 threshold,
  // so the borders count as a change.
  const change = (last30 - prev30) / prev30;
  if (change >= STATS.formChangeThreshold) {
    return 'up';
  }
  if (change <= -STATS.formChangeThreshold) {
    return 'down';
  }
  return null;
}
