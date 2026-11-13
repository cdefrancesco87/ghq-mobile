import { and, desc, eq, inArray } from 'drizzle-orm';

import { daysTaken } from '../../rules/boss';
import type { GameDay } from '../../rules/types';
import { boss, events } from '../schema';
import type { Db } from '../types';
import { withSteps, type Boss, type BossProgress } from './boss';
import { gameDayOf, getSetting } from './settings';

// The Hall of trophies (analisi-funzionale.md US-BOSS-04; design-sezioni.md 5.7): the defeated
// bosses, the quest of the first launch included, from the most recent. It only reads.

export interface TrophyInfo {
  /** The game day the boss was created. */
  readonly startDay: GameDay;
  /** The game day of the victory. */
  readonly defeatedDay: GameDay;
  /** «Giorni impiegati»: from the creation to the victory, at least 1. */
  readonly daysTaken: number;
  /** XP and coins of the victory, as the log recorded them. */
  readonly xp: number;
  readonly coins: number;
}

export interface Trophy extends BossProgress, TrophyInfo {}

type Clock = { readonly now: number; readonly tzOffset: number };

function rewardsOf(db: Db, bossIds: readonly string[]): Map<string, { xp: number; coins: number }> {
  if (bossIds.length === 0) {
    return new Map();
  }
  const rows = db
    .select({ bossId: events.bossId, dXp: events.dXp, dCoins: events.dCoins })
    .from(events)
    .where(and(eq(events.type, 'boss.defeated'), inArray(events.bossId, [...bossIds])))
    .all();
  return new Map(rows.map((row) => [row.bossId ?? '', { xp: row.dXp, coins: row.dCoins }]));
}

function infoOf(
  target: Boss,
  reward: { xp: number; coins: number } | undefined,
  clock: Clock,
  dayChange: ReturnType<typeof getSetting<'day_change'>>,
): TrophyInfo {
  // Like the steps, the days are read in the time zone of today.
  const startDay = gameDayOf(target.createdAt, clock.tzOffset, dayChange);
  const defeatedDay = gameDayOf(target.defeatedAt ?? target.updatedAt, clock.tzOffset, dayChange);
  return {
    startDay,
    defeatedDay,
    daysTaken: daysTaken(startDay, defeatedDay),
    xp: reward?.xp ?? 0,
    coins: reward?.coins ?? 0,
  };
}

/** The trophies, from the most recent victory. */
export function listTrophies(db: Db, clock: Clock): Trophy[] {
  const dayChange = getSetting(db, 'day_change');
  const defeated = db
    .select()
    .from(boss)
    .where(eq(boss.status, 'defeated'))
    .orderBy(desc(boss.defeatedAt), desc(boss.createdAt))
    .all();
  const rewards = rewardsOf(
    db,
    defeated.map((item) => item.id),
  );
  return withSteps(db, defeated).map((item) => ({
    ...item,
    ...infoOf(item.boss, rewards.get(item.boss.id), clock, dayChange),
  }));
}

/** The trophy of a boss: null while it is not defeated. */
export function getTrophy(db: Db, bossId: string, clock: Clock): TrophyInfo | null {
  const target = db.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'defeated') {
    return null;
  }
  return infoOf(target, rewardsOf(db, [bossId]).get(bossId), clock, getSetting(db, 'day_change'));
}
