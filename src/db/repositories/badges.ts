import { and, count, desc, eq, notExists } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { BADGE_LIST } from '../../content/badges';
import {
  badgeProgress,
  checkBadges,
  type BadgeDefinition,
  type BadgeMetrics,
  type BadgeProgress,
} from '../../rules/badges';
import { COMPANION_STAGES } from '../../rules/companion';
import { BADGES } from '../../rules/config';
import { statLevel } from '../../rules/stats';
import type { GameDay } from '../../rules/types';
import { badges, boss, companion, events, hero, heroStats } from '../schema';
import type { Db } from '../types';
import { appendEvent, type EventRow } from './events';
import { changeHero, type ActionClock } from './hero';
import type { WithMoments } from './moments';

// The badges (analisi-funzionale.md US-PROF-02; design-sezioni.md 9.6; modello-dati.md 3.9): the
// conditions live in src/content/badges.ts, the database keeps only the unlocked ones.

const reverts = alias(events, 'reverts');

/** Days with a bonus of the day that was not undone. */
function bonusDays(db: Db, type: 'bonus.full_day' | 'bonus.plan'): number {
  return (
    db
      .select({ value: count() })
      .from(events)
      .where(
        and(
          eq(events.type, type),
          notExists(db.select().from(reverts).where(eq(reverts.revertsId, events.id))),
        ),
      )
      .get()?.value ?? 0
  );
}

/** The numbers the badges count, read from the state tables and the log. */
export function badgeMetrics(db: Db): BadgeMetrics {
  const current = db.select().from(hero).get();
  const pet = db.select().from(companion).get();
  const bossesDefeated =
    db.select({ value: count() }).from(boss).where(eq(boss.status, 'defeated')).get()?.value ?? 0;
  const statLevels = db
    .select()
    .from(heroStats)
    .all()
    .map((row) => statLevel(row.points));
  return {
    completions: pet?.completionsTotal ?? 0,
    streakBest: current?.streakBest ?? 0,
    bossesDefeated,
    level: current?.level ?? 1,
    fullDays: bonusDays(db, 'bonus.full_day'),
    plans: bonusDays(db, 'bonus.plan'),
    companionStage: COMPANION_STAGES.indexOf(pet?.stage ?? 'egg'),
    statLevelMax: Math.max(0, ...statLevels),
  };
}

function unlockedKeys(db: Db): string[] {
  return db
    .select({ key: badges.badgeKey })
    .from(badges)
    .all()
    .map((row) => row.key);
}

/**
 * Unlocks, in one transaction, every badge whose condition is now met: the row in `badges`, the
 * coins of BADGES.coins and a `badge.unlocked` event each, whose idempotency key makes a second
 * unlock impossible. Run after every action of the app (`runAction`); without a profile it does
 * nothing. The events are the moments to show.
 */
export function unlockBadges(db: Db, clock: ActionClock): WithMoments {
  return db.transaction((tx) => {
    if (tx.select({ id: hero.id }).from(hero).get() === undefined) {
      return { moments: [] };
    }
    const keys = checkBadges(BADGE_LIST, badgeMetrics(tx), unlockedKeys(tx));
    const moments: EventRow[] = keys.map((key) => {
      tx.insert(badges).values({ badgeKey: key, unlockedAt: clock.now }).run();
      const change = changeHero(tx, { coins: BADGES.coins }, clock.now);
      return appendEvent(tx, {
        type: 'badge.unlocked',
        occurredAt: clock.now,
        tzOffset: clock.tzOffset,
        source: 'system',
        idemKey: `badge:${key}`,
        deltas: { coins: change.deltas.coins },
        payload: { badge: key },
      }).event;
    });
    return { moments };
  });
}

export interface BadgeItem {
  readonly badge: BadgeDefinition;
  readonly progress: BadgeProgress;
  /** UTC instant of the unlock; null while locked. */
  readonly unlockedAt: number | null;
  /** The game day of the unlock, for its date; null while locked. */
  readonly unlockedDay: GameDay | null;
  /** The coins received at the unlock; null while locked. */
  readonly coins: number | null;
}

export interface BadgesView {
  /** Every badge in the order of the content. */
  readonly badges: readonly BadgeItem[];
  readonly unlocked: number;
  readonly total: number;
  /** The latest unlocked, newest first, at most BADGES.profileRecent. */
  readonly recent: readonly BadgeItem[];
}

/** The badges of the Profile and of their grid (design-sezioni.md 9.6). */
export function getBadgesView(db: Db): BadgesView {
  const metrics = badgeMetrics(db);
  const rows = db
    .select()
    .from(events)
    .where(eq(events.type, 'badge.unlocked'))
    .orderBy(desc(events.seq))
    .all();
  const unlocks = new Map(
    rows.map((row) => [(row.payload as { badge?: string }).badge ?? '', row] as const),
  );
  const stored = new Map(
    db
      .select()
      .from(badges)
      .all()
      .map((row) => [row.badgeKey, row.unlockedAt]),
  );
  const items: BadgeItem[] = BADGE_LIST.map((badge) => {
    const unlockedAt = stored.get(badge.key) ?? null;
    const event = unlocks.get(badge.key);
    return {
      badge,
      progress: badgeProgress(badge, metrics),
      unlockedAt,
      unlockedDay: unlockedAt === null ? null : (event?.gameDay ?? null),
      coins: unlockedAt === null ? null : (event?.dCoins ?? 0),
    };
  });
  const order = [...unlocks.keys()];
  const recent = order
    .map((key) => items.find((item) => item.badge.key === key && item.unlockedAt !== null))
    .filter((item) => item !== undefined)
    .slice(0, BADGES.profileRecent);
  return {
    badges: items,
    unlocked: items.filter((item) => item.unlockedAt !== null).length,
    total: items.length,
    recent,
  };
}
