import { eq } from 'drizzle-orm';

import { HP } from '../../rules/config';
import { heroLevelFromXp } from '../../rules/level';
import { STAT_KEYS } from '../../rules/types';
import { events, hero, heroStats } from '../schema';
import type { Db } from '../types';
import { loadHero } from './hero';

// The repair function (modello-dati.md, 4.3): the sum of d_xp, d_coins, d_hp and d_stats of the
// event log always gives `hero` and `hero_stats`, so the hero can be recomputed from the log.
// It writes no event: the log is the truth and does not change.

/**
 * Recomputes XP, level, coins, hit points and stat points of the hero from the event log, in one
 * transaction. Refuses a log whose sums are impossible (negative XP or coins, hit points out of
 * 0–50) and leaves the hero as it was. Returns whether something was different.
 */
export function rebuildHeroFromEvents(db: Db, now: number): { repaired: boolean } {
  return db.transaction((tx) => {
    const current = loadHero(tx);
    let xp = 0;
    let coins = 0;
    let hp = 0;
    const stats = Object.fromEntries(STAT_KEYS.map((stat) => [stat, 0]));
    for (const event of tx.select().from(events).all()) {
      xp += event.dXp;
      coins += event.dCoins;
      hp += event.dHp;
      for (const [stat, points] of Object.entries(event.dStats ?? {})) {
        if (!(stat in stats)) {
          throw new RangeError(`Unknown stat in the log: ${stat}`);
        }
        stats[stat] += points ?? 0;
      }
    }
    if (coins < 0 || hp < 0 || hp > HP.max) {
      throw new RangeError(`Impossible totals in the log: ${coins} coins, ${hp} hit points`);
    }
    const level = heroLevelFromXp(xp);
    let repaired =
      current.xpTotal !== level.xpTotal ||
      current.level !== level.level ||
      current.xpInLevel !== level.xpInLevel ||
      current.coins !== coins ||
      current.hp !== hp;
    if (repaired) {
      tx.update(hero)
        .set({ ...level, coins, hp, updatedAt: now })
        .where(eq(hero.id, current.id))
        .run();
    }
    for (const row of tx.select().from(heroStats).all()) {
      if (row.points !== stats[row.statKey]) {
        repaired = true;
        tx.update(heroStats)
          .set({ points: stats[row.statKey] })
          .where(eq(heroStats.statKey, row.statKey))
          .run();
      }
    }
    return { repaired };
  });
}
