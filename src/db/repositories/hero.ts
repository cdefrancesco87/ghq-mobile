import { eq, sql } from 'drizzle-orm';

import { applyHp } from '../../rules/day';
import { applyXp } from '../../rules/level';
import type { Deltas, StatKey } from '../../rules/types';
import { hero, heroStats } from '../schema';
import type { Db } from '../types';
import { appendEvent, type EventSource } from './events';

// Changes to the hero shared by the game actions. The changes really applied (hit points stop at
// 0 and 50) go into the events, so the log always adds up to the hero (modello-dati.md, 4.3).

export type Hero = typeof hero.$inferSelect;

/** When and how an action happens. */
export interface ActionClock {
  /** UTC instant of the action, in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
  /** Where the action comes from; `app` when missing. */
  readonly source?: EventSource;
}

export interface HeroChange {
  /** The changes really applied. */
  readonly deltas: Deltas;
  readonly levelBefore: number;
  readonly levelAfter: number;
}

export function loadHero(tx: Db): Hero {
  const row = tx.select().from(hero).get();
  if (row === undefined) {
    throw new RangeError('There is no profile yet: the first launch must create it');
  }
  return row;
}

/** Applies XP, coins, hit points and stat points to the hero and returns what was applied. */
export function changeHero(tx: Db, deltas: Partial<Deltas>, now: number): HeroChange {
  const current = loadHero(tx);
  const level = applyXp(current, deltas.xp ?? 0);
  const hp = applyHp(current.hp, deltas.hp ?? 0);
  const coins = current.coins + (deltas.coins ?? 0);
  if (coins < 0) {
    throw new RangeError(`Not enough coins: ${current.coins}`);
  }
  tx.update(hero)
    .set({
      level: level.level,
      xpInLevel: level.xpInLevel,
      xpTotal: level.xpTotal,
      hp,
      coins,
      updatedAt: now,
    })
    .where(eq(hero.id, current.id))
    .run();
  const stats = deltas.stats ?? {};
  for (const [stat, points] of Object.entries(stats)) {
    if (points) {
      tx.update(heroStats)
        .set({ points: sql`${heroStats.points} + ${points}` })
        .where(eq(heroStats.statKey, stat as StatKey))
        .run();
    }
  }
  return {
    deltas: {
      xp: level.xpTotal - current.xpTotal,
      coins: deltas.coins ?? 0,
      hp: hp - current.hp,
      stats,
    },
    levelBefore: current.level,
    levelAfter: level.level,
  };
}

/** Writes the `hero.level_up` event when a change made the hero climb a level. */
export function recordLevelUp(tx: Db, change: HeroChange, clock: ActionClock): void {
  if (change.levelAfter > change.levelBefore) {
    appendEvent(tx, {
      type: 'hero.level_up',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      payload: { from: change.levelBefore, to: change.levelAfter },
    });
  }
}
