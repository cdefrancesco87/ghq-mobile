import { isFullDay, isPlanComplete } from './day';
import { isGameDay } from './gameDay';
import type { Deltas, GameDay, StatKey, StatPoints } from './types';

// Undo (US-OGGI-04): an undo never deletes an event, it adds an `event.reverted` event with
// the opposite changes (modello-dati.md, 4.3).

/** The bonuses of a day, as event types of the log. */
export type DayBonus = 'bonus.full_day' | 'bonus.plan';

/** An action can be undone only on the game day it belongs to, until the day change. */
export function canUndo(eventGameDay: GameDay, today: GameDay): boolean {
  for (const day of [eventGameDay, today]) {
    if (!isGameDay(day)) {
      throw new RangeError(`Invalid game day: ${day}`);
    }
  }
  return eventGameDay === today;
}

function opposite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`A change must be a finite number: ${value}`);
  }
  // 0 - 0 would give -0, which is a different number for Jest and for Object.is.
  return value === 0 ? 0 : -value;
}

/**
 * The changes of an `event.reverted` event: the opposite of the recorded ones. The recorded
 * changes are the ones really applied (for example +2 hit points when the bonus met the cap of
 * 50), so the undo gives back exactly what was taken.
 */
export function revertDeltas(deltas: Deltas): Deltas {
  const stats: StatPoints = {};
  for (const [stat, points] of Object.entries(deltas.stats) as [StatKey, number][]) {
    stats[stat] = opposite(points);
  }
  return {
    xp: opposite(deltas.xp),
    coins: opposite(deltas.coins),
    hp: opposite(deltas.hp),
    stats,
  };
}

export interface DayBonusState {
  /** Ids of the missions due on the day. */
  readonly scheduled: readonly string[];
  /** Ids of the missions in the day plan. */
  readonly plan: readonly string[];
  /** Ids of the missions still done after the undo. */
  readonly doneAfterUndo: readonly string[];
  /** Bonuses given on the day and not reverted yet. */
  readonly given: readonly DayBonus[];
}

/**
 * The bonuses to take back together with an undo: the full-day and plan bonuses go away when
 * the undo makes the day, or the plan, incomplete again (CLAUDE.md, choice 4).
 */
export function bonusesToRevert({
  scheduled,
  plan,
  doneAfterUndo,
  given,
}: DayBonusState): DayBonus[] {
  const toRevert: DayBonus[] = [];
  if (given.includes('bonus.full_day') && !isFullDay(scheduled, doneAfterUndo)) {
    toRevert.push('bonus.full_day');
  }
  if (given.includes('bonus.plan') && !isPlanComplete(plan, doneAfterUndo)) {
    toRevert.push('bonus.plan');
  }
  return toRevert;
}
