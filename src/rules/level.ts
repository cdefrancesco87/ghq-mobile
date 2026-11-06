import { HERO_LEVELS } from './config';

/** Level and XP of the hero, as stored in `hero.level`, `hero.xp_in_level` and `hero.xp_total`. */
export interface HeroLevel {
  /** From 1 to HERO_LEVELS.max. */
  readonly level: number;
  /** XP gained towards the next level; always 0 at the maximum level. */
  readonly xpInLevel: number;
  /** All the XP gained, never negative. */
  readonly xpTotal: number;
}

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > HERO_LEVELS.max) {
    throw new RangeError(`Invalid hero level (expected 1 to ${HERO_LEVELS.max}): ${level}`);
  }
}

/**
 * XP needed to go from `level` to the next one: 50 × (level + 3). At the maximum level there
 * is no next level: the value follows the same formula, but `applyXp` never uses it.
 */
export function xpToNext(level: number): number {
  assertLevel(level);
  return HERO_LEVELS.xpToNextFactor * (level + HERO_LEVELS.xpToNextOffset);
}

/** Level and XP in the level that correspond to a total of XP. */
export function heroLevelFromXp(xpTotal: number): HeroLevel {
  if (!Number.isInteger(xpTotal) || xpTotal < 0) {
    throw new RangeError(`Invalid total XP: ${xpTotal}`);
  }
  let level = 1;
  let xpInLevel = xpTotal;
  while (level < HERO_LEVELS.max && xpInLevel >= xpToNext(level)) {
    xpInLevel -= xpToNext(level);
    level++;
  }
  // Above the maximum level only the total keeps growing.
  return { level, xpInLevel: level === HERO_LEVELS.max ? 0 : xpInLevel, xpTotal };
}

/**
 * Adds `deltaXp` (negative for an undo) to the hero. The level can climb or drop several
 * levels at once, never below 1, and the total XP never goes below 0. Level and XP in the
 * level are recomputed from the total, so the result is always consistent.
 */
export function applyXp(state: HeroLevel, deltaXp: number): HeroLevel {
  if (!Number.isInteger(deltaXp)) {
    throw new RangeError(`The XP change must be an integer: ${deltaXp}`);
  }
  if (!Number.isInteger(state.xpTotal) || state.xpTotal < 0) {
    throw new RangeError(`Invalid total XP: ${state.xpTotal}`);
  }
  return heroLevelFromXp(Math.max(0, state.xpTotal + deltaXp));
}

/** Index of the hero title, from 0 (level 1) to 10 (level 50): it changes every 5 levels. */
export function titleIndex(level: number): number {
  assertLevel(level);
  return Math.floor(level / HERO_LEVELS.titleEveryLevels);
}
