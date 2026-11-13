import type { CompletionDeltas } from './completion';
import { BACKFILL, DIFFICULTY_VALUES } from './config';
import { addDays } from './gameDay';
import { statPoints } from './stats';
import type { Difficulty, GameDay, StatKey } from './types';

// The forgotten completion (US-STAT-03): a mission expected on one of the last 7 days and not
// done can be completed afterwards, with smaller rewards so that adding completions later does
// not pay (xp-e-monete.md section 1, «Proposta»; BACKFILL in config.ts).

export interface BackfillInput {
  readonly difficulty: Difficulty;
  readonly statPrimary: StatKey | null;
  readonly statSecondary: StatKey | null;
}

/**
 * The rewards of a forgotten completion: base XP and coins of the difficulty, no streak
 * multiplier, no halving of the exhausted day and no hit points.
 */
export function backfillDeltas(input: BackfillInput): CompletionDeltas {
  const { difficulty, statPrimary, statSecondary } = input;
  // statPoints also checks the difficulty and the two stats.
  const stats = statPoints(difficulty, statPrimary, statSecondary);
  const values = DIFFICULTY_VALUES[difficulty];
  return {
    xp: values.xp,
    coins: values.coins,
    hp: 0,
    stats: BACKFILL.givesStatPoints ? stats : {},
    bossDamage: BACKFILL.damagesBoss ? values.bossDamage : 0,
  };
}

/** The days that can be corrected: the 7 before today, the latest first. */
export function backfillDays(today: GameDay): GameDay[] {
  return Array.from({ length: BACKFILL.maxDaysBack }, (_, index) => addDays(today, -(index + 1)));
}

/** True for a day among the 7 before today. */
export function canBackfill(day: GameDay, today: GameDay): boolean {
  return day < today && day >= addDays(today, -BACKFILL.maxDaysBack);
}
