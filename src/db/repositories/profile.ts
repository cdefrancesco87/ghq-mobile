import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  ne,
  notExists,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { HERO_LEVELS, PROFILE, STATS } from '../../rules/config';
import { addDays, diffDays } from '../../rules/gameDay';
import { xpToNext } from '../../rules/level';
import { formArrow, statProgress, type FormArrow, type StatProgress } from '../../rules/stats';
import { STAT_KEYS, type GameDay, type StatKey } from '../../rules/types';
import { boss, events, hero, heroStats, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { getCompanionView, type CompanionView } from './companion';
import { appendEvent, notDeleted } from './events';
import { loadHero, type ActionClock, type Hero } from './hero';
import { gameDayOf, getSetting } from './settings';

// The Profile (analisi-funzionale.md section 9, US-PROF-01, 03, 04; design-sezioni.md 9.2–9.5,
// 9.7): who the hero is, the character sheet with the six stats and the detail of a stat.

export interface StatRow {
  readonly stat: StatKey;
  /** All the points gained, also above the cap. */
  readonly points: number;
  readonly progress: StatProgress;
  /**
   * The form arrow (US-PROF-05, design-sezioni.md 9.4): points of the last 30 days against the
   * 30 before; null when the change is small or in the first 30 days of use.
   */
  readonly form: FormArrow | null;
}

export interface ProfileView {
  readonly hero: Hero;
  /** XP of the whole level, to reach the next one; null at the highest level. */
  readonly xpToNext: number | null;
  /** Missions completed in all, on every day, without the deleted missions. */
  readonly completionsTotal: number;
  /** Bosses defeated, the starter quest included: also the trophies of the Hall. */
  readonly bossesDefeated: number;
  /** The six stats in the order of the data model. */
  readonly stats: readonly StatRow[];
  /** For the row of the companion among the links (9.7). */
  readonly companion: CompanionView;
}

/** A gain of points of a stat, from the log: «+20 Corsa, ieri» (design-sezioni.md 9.5). */
export interface StatGain {
  readonly id: string;
  readonly gameDay: GameDay;
  readonly points: number;
  /** The mission or, for a step, the boss that gave the points. */
  readonly name: string;
}

export interface StatDetail extends StatRow {
  readonly today: GameDay;
  /** The latest gains, newest first, without the undone ones. */
  readonly gains: readonly StatGain[];
  /** The missions that feed the stat, as primary or secondary stat, not archived. */
  readonly missions: readonly { readonly id: string; readonly name: string }[];
}

function statRows(db: Db): Map<StatKey, number> {
  return new Map(
    db
      .select()
      .from(heroStats)
      .all()
      .map((row) => [row.statKey, row.points]),
  );
}

function rowOf(stat: StatKey, points: number, form: FormArrow | null = null): StatRow {
  return { stat, points, progress: statProgress(points), form };
}

/** Net points of a stat gained between two game days, inclusive; undos count as negative. */
function pointsBetween(db: Db, stat: StatKey, from: GameDay, to: GameDay): number {
  const gained = sql<number>`coalesce(sum(json_extract(${events.dStats}, ${`$.${stat}`})), 0)`;
  const total = db
    .select({ value: gained })
    .from(events)
    .where(between(events.gameDay, from, to))
    .get()?.value;
  return Math.max(0, total ?? 0);
}

/**
 * The form arrow of every stat on `today`: the window is STATS.formWindowDays long and ends
 * today; the days of use start from the game day of the hero's creation.
 */
function formArrows(db: Db, heroDay: GameDay, today: GameDay): Map<StatKey, FormArrow | null> {
  const window = STATS.formWindowDays;
  const daysOfUse = Math.max(1, diffDays(heroDay, today) + 1);
  const lastFrom = addDays(today, -(window - 1));
  const prevTo = addDays(lastFrom, -1);
  const prevFrom = addDays(prevTo, -(window - 1));
  return new Map(
    STAT_KEYS.map((stat) => [
      stat,
      daysOfUse <= STATS.formHiddenFirstDays
        ? null
        : formArrow(
            pointsBetween(db, stat, lastFrom, today),
            pointsBetween(db, stat, prevFrom, prevTo),
            daysOfUse,
          ),
    ]),
  );
}

/** Everything the Profile shows, on the game day of `clock`. */
export function getProfileView(db: Db, clock: { now: number; tzOffset: number }): ProfileView {
  const current = loadHero(db);
  const completionsTotal =
    db
      .select({ value: count() })
      .from(missionDays)
      .innerJoin(missions, eq(missions.id, missionDays.missionId))
      .where(and(eq(missionDays.status, 'done'), notDeleted(missions)))
      .get()?.value ?? 0;
  const bossesDefeated =
    db.select({ value: count() }).from(boss).where(eq(boss.status, 'defeated')).get()?.value ?? 0;
  const points = statRows(db);
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(clock.now, clock.tzOffset, dayChange);
  const forms = formArrows(db, gameDayOf(current.createdAt, clock.tzOffset, dayChange), today);
  return {
    hero: current,
    xpToNext: current.level === HERO_LEVELS.max ? null : xpToNext(current.level),
    completionsTotal,
    bossesDefeated,
    stats: STAT_KEYS.map((stat) => rowOf(stat, points.get(stat) ?? 0, forms.get(stat) ?? null)),
    companion: getCompanionView(db, clock),
  };
}

const reverts = alias(events, 'reverts');

/** The detail of a stat (design-sezioni.md 9.5; mockup D33A). */
export function getStatDetail(
  db: Db,
  stat: StatKey,
  clock: { now: number; tzOffset: number },
): StatDetail {
  const gained = sql<number>`json_extract(${events.dStats}, ${`$.${stat}`})`;
  const gains = db
    .select({
      id: events.id,
      gameDay: events.gameDay,
      points: gained,
      missionName: missions.name,
      bossName: boss.name,
    })
    .from(events)
    .leftJoin(missions, eq(missions.id, events.missionId))
    .leftJoin(boss, eq(boss.id, events.bossId))
    .where(
      and(
        ne(events.type, 'event.reverted'),
        sql`${gained} > 0`,
        notExists(db.select().from(reverts).where(eq(reverts.revertsId, events.id))),
        // A mission gain stays while the mission does, even when its boss was deleted.
        or(
          and(isNotNull(events.missionId), notDeleted(missions)),
          and(sql`${events.missionId} IS NULL`, ne(boss.status, 'deleted')),
        ),
      ),
    )
    .orderBy(desc(events.seq))
    .limit(PROFILE.recentGainsMax)
    .all();
  const feeding = db
    .select({ id: missions.id, name: missions.name })
    .from(missions)
    .where(
      and(
        notDeleted(missions),
        inArray(missions.status, ['active', 'paused']),
        or(eq(missions.statPrimary, stat), eq(missions.statSecondary, stat)),
      ),
    )
    .orderBy(asc(missions.sortOrder))
    .all();
  return {
    ...rowOf(stat, statRows(db).get(stat) ?? 0),
    today: gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change')),
    gains: gains.map((row) => ({
      id: row.id,
      gameDay: row.gameDay,
      points: row.points,
      name: row.missionName ?? row.bossName ?? '',
    })),
    missions: feeding,
  };
}

/**
 * Renames the hero (US-PROF-03) with the `hero.renamed` event. Nothing is written when the name
 * does not change.
 *
 * @returns The stored name, without the spaces around it.
 * @throws RangeError when the name is empty or longer than PROFILE.nameMaxLength.
 */
export function renameHero(db: Db, typed: string, clock: ActionClock): string {
  const name = typed.trim();
  if (name === '') {
    throw new RangeError('The hero needs a name');
  }
  if (name.length > PROFILE.nameMaxLength) {
    throw new RangeError(`The hero name is longer than ${PROFILE.nameMaxLength}: ${name}`);
  }
  return db.transaction((tx) => {
    const before = loadHero(tx).name;
    if (before === name) {
      return name;
    }
    tx.update(hero).set({ name, updatedAt: clock.now }).where(eq(hero.id, 'hero')).run();
    appendEvent(tx, {
      type: 'hero.renamed',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      payload: { from: before, to: name },
    });
    return name;
  });
}
