import { clamp } from './clamp';
import { DAY_PLAN, HP, SKIPS } from './config';
import type { GameMode } from './types';

// Hit points and bonuses of a game day.

export interface HpLossInput {
  /** XP of all the missions due on the day. */
  readonly scheduledXp: number;
  /** XP of the missions due and not done (skipped and paused missions excluded). */
  readonly missedXp: number;
  readonly isRestDay: boolean;
  readonly gameMode: GameMode;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${value}`);
  }
}

/**
 * Hit points lost at the day change: 10 × missed XP ÷ scheduled XP, rounded once (half up), so
 * at most 10. Nothing is lost on a rest day or in the Essential mode.
 */
export function hpLoss({ scheduledXp, missedXp, isRestDay, gameMode }: HpLossInput): number {
  assertNonNegativeInteger(scheduledXp, 'Scheduled XP');
  assertNonNegativeInteger(missedXp, 'Missed XP');
  if (missedXp > scheduledXp) {
    throw new RangeError(`Missed XP (${missedXp}) cannot exceed scheduled XP (${scheduledXp})`);
  }
  if (isRestDay || gameMode === 'essential' || missedXp === 0) {
    return 0;
  }
  // The integer product comes first, so a result like 2.5 stays exact before rounding.
  return Math.round((HP.dailyLossMax * missedXp) / scheduledXp);
}

/** Hit points after a change, always between 0 and the maximum (50). */
export function applyHp(hp: number, delta: number): number {
  if (!Number.isInteger(hp) || !Number.isInteger(delta)) {
    throw new RangeError(`Hit points and their change must be integers: ${hp}, ${delta}`);
  }
  return clamp(hp + delta, 0, HP.max);
}

/** Every one of `required` is in `done`, and there is at least one. */
function allDone(required: readonly string[], done: readonly string[]): boolean {
  const doneIds = new Set(done);
  return required.length > 0 && required.every((id) => doneIds.has(id));
}

/**
 * Full day: every mission due today is done. False with no missions due, so an empty day
 * gives no bonus.
 *
 * @param scheduled Ids of the missions due today.
 * @param done Ids of the missions done today.
 */
export function isFullDay(scheduled: readonly string[], done: readonly string[]): boolean {
  return allDone(scheduled, done);
}

/**
 * Day plan completed: every priority is done. False with no priorities.
 *
 * @param plan Ids of the missions in the day plan.
 * @param done Ids of the missions done today.
 */
export function isPlanComplete(plan: readonly string[], done: readonly string[]): boolean {
  return allDone(plan, done);
}

/** A mission can join the day plan while it has fewer than 3 priorities. */
export function canAddToPlan(plan: readonly string[]): boolean {
  return plan.length < DAY_PLAN.maxPriorities;
}

/** «Salta oggi» still available this week for one mission: at most 3 a week. */
export function skipsLeft(skipsThisWeek: number): number {
  assertNonNegativeInteger(skipsThisWeek, 'Skips this week');
  return Math.max(0, SKIPS.maxPerMissionPerWeek - skipsThisWeek);
}
