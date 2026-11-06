import { DIFFICULTY_VALUES, HP, STREAK_MULTIPLIERS } from './config';
import { statPoints } from './stats';
import type { Deltas, Difficulty, StatKey } from './types';

// The rewards of one completion. They are the same whatever the source of the completion
// (app, notification, widget or health data), so this function takes no source.

export interface CompletionInput {
  readonly difficulty: Difficulty;
  /** Hero streak at the moment of the completion (CLAUDE.md, choice 2). */
  readonly heroStreak: number;
  /** True on the exhausted day, when the XP are halved. */
  readonly exhausted: boolean;
  readonly statPrimary: StatKey | null;
  readonly statSecondary: StatKey | null;
}

export interface CompletionDeltas extends Deltas {
  /** Damage dealt to the boss linked to the mission, if there is one. */
  readonly bossDamage: number;
}

/**
 * Removes the floating-point noise of sums and products of decimal values: in JavaScript
 * 0.7 + 0.1 is 0.7999999999999999 and 50 × 1.15 is 57.49999999999999.
 */
function withoutNoise(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * The single rounding of an XP amount, at the end of the calculation (CLAUDE.md, choice 1):
 * Math.round, half up, applied to the exact decimal value.
 */
export function roundXp(value: number): number {
  return Math.round(withoutNoise(value));
}

/** XP multiplier of a hero streak: ×1.1 from 7 days, ×1.2 from 30, ×1.3 from 100. */
export function streakMultiplier(streak: number): number {
  if (!Number.isInteger(streak) || streak < 0) {
    throw new RangeError(`The streak must be a non-negative integer: ${streak}`);
  }
  let multiplier = 1;
  for (const threshold of STREAK_MULTIPLIERS) {
    if (streak >= threshold.fromDays) {
      multiplier = threshold.multiplier;
    }
  }
  return multiplier;
}

/**
 * XP, coins, hit points, stat points and boss damage of one completion. XP = base × streak
 * multiplier × 0.5 when exhausted, rounded once; the multiplier and the exhausted day change
 * only the XP.
 */
export function completionDeltas(input: CompletionInput): CompletionDeltas {
  const { difficulty, heroStreak, exhausted, statPrimary, statSecondary } = input;
  // statPoints also checks the difficulty and the two stats.
  const stats = statPoints(difficulty, statPrimary, statSecondary);
  const values = DIFFICULTY_VALUES[difficulty];
  const exhaustedFactor = exhausted ? HP.exhaustedXpMultiplier : 1;
  return {
    xp: roundXp(values.xp * streakMultiplier(heroStreak) * exhaustedFactor),
    coins: values.coins,
    hp: HP.perCompletion,
    stats,
    bossDamage: values.bossDamage,
  };
}

export interface MeasurableInput {
  /** Value reached so far (litres, pages, minutes…). */
  readonly value: number;
  /** Increment of one tap, or minutes of the timer; always positive. */
  readonly step: number;
  /** Goal of the mission. */
  readonly target: number;
}

export interface MeasurableProgress {
  /** Value after the step. */
  readonly value: number;
  /** True when the value has reached the target. */
  readonly done: boolean;
  /** True only for the step that reaches the target: the rewards arrive once. */
  readonly completesNow: boolean;
}

/**
 * Adds one step to a measurable mission. The mission is done when the value reaches the
 * target; going beyond it gives nothing more, so only the step that reaches the target
 * completes the mission.
 */
export function measurableProgress({ value, step, target }: MeasurableInput): MeasurableProgress {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`The value must be zero or more: ${value}`);
  }
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError(`The step must be more than zero: ${step}`);
  }
  if (!Number.isFinite(target) || target <= 0) {
    throw new RangeError(`The target must be more than zero: ${target}`);
  }
  const next = withoutNoise(value + step);
  return { value: next, done: next >= target, completesNow: value < target && next >= target };
}
