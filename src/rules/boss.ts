import { roundXp } from './completion';
import { BOSS, STARTER_QUEST_REWARD, STATS } from './config';
import { diffDays } from './gameDay';
import { xpToNext } from './level';
import {
  DIFFICULTIES,
  STAT_KEYS,
  type Difficulty,
  type GameDay,
  type StatKey,
  type StatPoints,
} from './types';

// Bosses: big goals split into steps (analisi-funzionale.md, «Regole di gioco» and section 5).

/** Hit points of a boss and the steps still to do. */
export interface BossHealth {
  readonly hp: number;
  readonly stepsLeft: number;
}

export interface BossHit {
  readonly hp: number;
  /** True when the last step is done: only the last step defeats a boss. */
  readonly defeated: boolean;
}

export interface VictoryReward {
  readonly xp: number;
  readonly coins: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${value}`);
  }
}

function assertSteps(steps: number): void {
  if (!Number.isInteger(steps) || steps < BOSS.minSteps || steps > BOSS.maxSteps) {
    throw new RangeError(`A boss has from ${BOSS.minSteps} to ${BOSS.maxSteps} steps: ${steps}`);
  }
}

/** Hit points of a new boss: 20 per step. */
export function bossHpMax(steps: number): number {
  assertSteps(steps);
  return steps * BOSS.hpPerStep;
}

/**
 * Hits a boss with the damage of a step (20) or of a linked mission (2, 5 or 10). The hit
 * points never go below 10 × steps left, so missions alone can never win: the boss is defeated
 * when its last step is done.
 *
 * @param health Hit points before the hit, and steps still to do after it (a step completed by
 *   this hit no longer counts).
 */
export function applyBossDamage({ hp, stepsLeft }: BossHealth, damage: number): BossHit {
  assertNonNegativeInteger(hp, 'Boss hit points');
  assertNonNegativeInteger(stepsLeft, 'Steps left');
  assertNonNegativeInteger(damage, 'Damage');
  if (stepsLeft === 0) {
    return { hp: 0, defeated: true };
  }
  const floor = BOSS.minHpPerRemainingStep * stepsLeft;
  // A hit never heals the boss, even when its hit points are already below the floor.
  return { hp: Math.min(hp, Math.max(hp - damage, floor)), defeated: false };
}

/**
 * The hit points that only the last step can take (design-sezioni.md 5.3): 10 per step left, at
 * most the hit points left. The card of the boss draws them as a striped part of the bar.
 */
export function protectedHp({ hp, stepsLeft }: BossHealth): number {
  assertNonNegativeInteger(hp, 'Boss hit points');
  assertNonNegativeInteger(stepsLeft, 'Steps left');
  return Math.min(hp, BOSS.minHpPerRemainingStep * stepsLeft);
}

/** Reward of a victory: steps × 10 XP × boss difficulty (1, 1.5, 2), and a fifth of it in coins. */
export function victoryReward(steps: number, difficulty: Difficulty): VictoryReward {
  assertSteps(steps);
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    throw new RangeError(`Unknown difficulty: ${difficulty}`);
  }
  const xp = roundXp(steps * BOSS.victoryXpPerStep * BOSS.difficultyMultiplier[difficulty]);
  return { xp, coins: Math.floor(xp / BOSS.victoryXpPerCoin) };
}

export interface BossPreview extends VictoryReward {
  readonly hp: number;
}

/**
 * The preview of a new boss (design-sezioni.md 5.2): hit points and reward of a victory. Null while
 * the steps are fewer than 2 or more than 20, since that boss cannot be created.
 */
export function bossPreview(steps: number, difficulty: Difficulty): BossPreview | null {
  if (!Number.isInteger(steps) || steps < BOSS.minSteps || steps > BOSS.maxSteps) {
    return null;
  }
  return { hp: bossHpMax(steps), ...victoryReward(steps, difficulty) };
}

/** Coins stolen when a deadline passes: 10% of the coins, rounded down, at most 500. */
export function deadlineSteal(coins: number): number {
  assertNonNegativeInteger(coins, 'Coins');
  return Math.min(Math.floor(coins * BOSS.deadlineStealShare), BOSS.deadlineStealMax);
}

/**
 * Whether to send the deadline warning: from 3 days before the deadline up to the deadline day,
 * once (`warned` is `boss.deadline_warned`). A late check still sends it once.
 */
export function shouldWarnDeadline(
  today: GameDay,
  deadline: GameDay | null,
  warned: boolean,
): boolean {
  if (warned || deadline === null) {
    return false;
  }
  const daysLeft = diffDays(today, deadline);
  return daysLeft >= 0 && daysLeft <= BOSS.deadlineWarningDays;
}

/** A new boss can start while fewer than 3 are active. */
export function canCreateBoss(activeCount: number): boolean {
  assertNonNegativeInteger(activeCount, 'Active bosses');
  return activeCount < BOSS.maxActive;
}

/**
 * Reward of the quest of the first launch (CLAUDE.md, choice 12): exactly the XP missing to reach
 * level 2 (at most 200) and the coins of a potion; no stat points.
 */
export function starterQuestReward(hero: { level: number; xpInLevel: number }): VictoryReward {
  const xp =
    hero.level < STARTER_QUEST_REWARD.xpToLevel
      ? Math.max(0, xpToNext(hero.level) - hero.xpInLevel)
      : 0;
  return { xp, coins: STARTER_QUEST_REWARD.coins };
}

/** Stat points of a completed step: 10 to the stat of the boss, if it has one. */
export function stepStatPoints(bossStat: StatKey | null): StatPoints {
  if (bossStat === null) {
    return {};
  }
  if (!(STAT_KEYS as readonly string[]).includes(bossStat)) {
    throw new RangeError(`Unknown stat: ${bossStat}`);
  }
  return { [bossStat]: STATS.bossStepPoints };
}
