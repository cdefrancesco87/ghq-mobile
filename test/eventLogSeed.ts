import type Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { createBoss } from '@/db/repositories/boss';
import { createMission } from '@/db/repositories/missions';
import { createProfile } from '@/db/repositories/onboarding';
import { boss, events, hero, heroStats, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { addDays } from '@/rules/gameDay';
import type { GameDay, StatKey } from '@/rules/types';

import { createTestDb } from './db';

// A long game for the measurements of the event log views: a profile created `days` days before
// `SEED_TODAY`, then one game day after another written straight into the log, the way the
// actions write it (completions with their boss damage, taps of measurable missions, skips,
// undos, day closes with their hit points, bonuses, purchases, steps of a boss, forgotten
// completions added later). The hero is set to the sums of the log at the end, so it still adds
// up to the log (modello-dati.md 4.3).

/** Minutes east of UTC: Rome in winter, kept all year for simplicity. */
export const SEED_TZ = 60;
/** The day the views are read on: the day after the last one written. */
export const SEED_TODAY = '2026-11-14' as GameDay;
/** Noon of SEED_TODAY in Rome. */
export const SEED_NOW = Date.UTC(2026, 10, 14, 11, 0);

const TEMPLATES = ['journal', 'no_social_evening', 'drink_water', 'read_pages', 'steps'];

/** A small deterministic random generator (mulberry32), so every run writes the same log. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The UTC instant of `hour:minute` local time on a game day. */
function instant(day: GameDay, hour: number, minute = 0): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date, hour, minute) - SEED_TZ * 60_000;
}

export interface SeededLog {
  readonly db: Db;
  readonly firstDay: GameDay;
  readonly events: number;
  readonly missionIds: Readonly<Record<string, string>>;
}

/** A game of `days` days of play, ending the day before SEED_TODAY. */
export function seedEventLog(days: number): SeededLog {
  const db = createTestDb();
  const firstDay = addDays(SEED_TODAY, -days - 1);
  const created = instant(firstDay, 9);
  createProfile(
    db,
    { name: 'Claudio', language: 'it', theme: 'minimal', templateKeys: TEMPLATES },
    { now: created, tzOffset: SEED_TZ },
  );
  const ids: Record<string, string> = {};
  for (const row of db.select().from(missions).all()) {
    ids[row.templateKey ?? row.id] = row.id;
  }
  const own = { now: created, tzOffset: SEED_TZ };
  ids.run = createMission(
    db,
    { name: 'Corsa', frequency: { type: 'times_per_week', times: 3 } },
    own,
  ).id;
  ids.meditation = createMission(db, { name: 'Meditazione' }, own).id;
  ids.tidy_desk = createMission(db, { name: 'Scrivania' }, own).id;
  const mainBoss = createBoss(
    db,
    {
      name: 'Il drago',
      difficulty: 'hard',
      steps: ['Uno', 'Due', 'Tre', 'Quattro', 'Cinque', 'Sei'],
      missionIds: [ids.journal],
    },
    { now: created + 60_000, tzOffset: SEED_TZ },
  );
  const goneBoss = createBoss(
    db,
    { name: 'Il troll', difficulty: 'easy', steps: ['Uno', 'Due'] },
    { now: created + 120_000, tzOffset: SEED_TZ },
  );
  // A deleted boss and a deleted mission: their events stay in the log but never show.
  db.update(boss).set({ status: 'deleted' }).where(eq(boss.id, goneBoss.id)).run();
  db.update(missions)
    .set({ deletedAt: created + 180_000 })
    .where(eq(missions.id, ids.tidy_desk))
    .run();

  const client = (db as unknown as { $client: Database.Database }).$client;
  const deviceId = db.select({ deviceId: events.deviceId }).from(events).get()!.deviceId;
  const insert = client.prepare(
    `INSERT INTO events (id, type, occurred_at, tz_offset, game_day, source, device_id,
       mission_id, boss_id, item_key, reverts_id, d_xp, d_coins, d_hp, d_stats, payload)
     VALUES (@id, @type, @occurredAt, ${SEED_TZ}, @gameDay, 'app', '${deviceId}',
       @missionId, @bossId, @itemKey, @revertsId, @dXp, @dCoins, @dHp, @dStats, @payload)`,
  );
  const next = random(42);
  const chance = (p: number) => next() < p;
  const between = (low: number, high: number) => low + Math.floor(next() * (high - low + 1));

  interface Row {
    type: string;
    occurredAt: number;
    gameDay: GameDay;
    missionId?: string | null;
    bossId?: string | null;
    itemKey?: string | null;
    revertsId?: string | null;
    dXp?: number;
    dCoins?: number;
    dHp?: number;
    dStats?: Partial<Record<StatKey, number>> | null;
    payload?: Record<string, unknown>;
  }
  const write = (row: Row): string => {
    const id = uuidv7();
    insert.run({
      id,
      type: row.type,
      occurredAt: row.occurredAt,
      gameDay: row.gameDay,
      missionId: row.missionId ?? null,
      bossId: row.bossId ?? null,
      itemKey: row.itemKey ?? null,
      revertsId: row.revertsId ?? null,
      dXp: row.dXp ?? 0,
      dCoins: row.dCoins ?? 0,
      dHp: row.dHp ?? 0,
      dStats: row.dStats == null ? null : JSON.stringify(row.dStats),
      payload: JSON.stringify(row.payload ?? {}),
    });
    return id;
  };

  let hp = db.select({ hp: hero.hp }).from(hero).get()!.hp;
  let heroStreak = 0;
  const streaks: Record<string, { streak: number; best: number }> = {};
  const streakOf = (key: string) => (streaks[key] ??= { streak: 0, best: 0 });
  let level = 1;
  let xp = 0;

  const complete = (key: string, day: GameDay, hour: number, stat: StatKey, gain: number) => {
    const before = { ...streakOf(key) };
    const occurredAt = instant(day, hour, between(0, 59));
    const linked = key === 'journal';
    const id = write({
      type: 'mission.completed',
      occurredAt,
      gameDay: day,
      missionId: ids[key],
      bossId: linked ? mainBoss.id : null,
      dXp: gain,
      dCoins: 2,
      dStats: { [stat]: Math.floor(gain * 0.3) },
      payload: { streakBefore: before },
    });
    if (linked) {
      write({
        type: 'boss.damaged',
        occurredAt,
        gameDay: day,
        bossId: mainBoss.id,
        payload: { damage: 10, dealt: chance(0.8) ? 10 : 0, completionId: id },
      });
    }
    // One completion in twenty is undone a few minutes later.
    if (chance(0.05)) {
      write({
        type: 'event.reverted',
        occurredAt: occurredAt + 5 * 60_000,
        gameDay: day,
        missionId: ids[key],
        revertsId: id,
        dXp: -gain,
        dCoins: -2,
        dStats: { [stat]: -Math.floor(gain * 0.3) },
      });
      return false;
    }
    const current = streakOf(key);
    current.streak += 1;
    current.best = Math.max(current.best, current.streak);
    xp += gain;
    return true;
  };

  const taps = (key: string, day: GameDay, target: number, step: number) => {
    let value = 0;
    const count = between(2, 6);
    for (let tap = 0; tap < count; tap++) {
      value += step;
      write({
        type: 'mission.progressed',
        occurredAt: instant(day, 9 + tap * 2, between(0, 59)),
        gameDay: day,
        missionId: ids[key],
        payload: { value },
      });
    }
    return value >= target;
  };

  client.transaction(() => {
    for (let back = days; back >= 1; back--) {
      const day = addDays(SEED_TODAY, -back);
      const yesterday = addDays(day, -1);
      // The close of yesterday, at the start of the day.
      const lost = chance(0.15) ? -between(1, Math.min(10, hp - 1)) : 0;
      hp += lost;
      heroStreak = lost === 0 ? heroStreak + 1 : 0;
      write({
        type: 'day.closed',
        occurredAt: instant(day, 6, 30),
        gameDay: yesterday,
        dHp: lost,
        payload: { heroStreak, missed: lost === 0 ? 0 : 1 },
      });

      let done = 0;
      if (chance(0.85)) done += Number(complete('journal', day, 8, 'wisdom', 15));
      if (chance(0.1)) {
        write({
          type: 'mission.skipped',
          occurredAt: instant(day, 12),
          gameDay: day,
          missionId: ids.no_social_evening,
          payload: { reason: 'illness' },
        });
      } else if (chance(0.75)) {
        done += Number(complete('no_social_evening', day, 22, 'discipline', 12));
      }
      if (taps('drink_water', day, 1, 0.25) || chance(0.4)) {
        done += Number(complete('drink_water', day, 21, 'constitution', 10));
      }
      if (taps('read_pages', day, 20, 5)) {
        done += Number(complete('read_pages', day, 22, 'intelligence', 12));
      }
      if (taps('steps', day, 10000, 2000)) {
        done += Number(complete('steps', day, 20, 'strength', 14));
      }
      if (chance(0.45)) done += Number(complete('run', day, 18, 'strength', 20));
      if (chance(0.6)) done += Number(complete('meditation', day, 7, 'wisdom', 10));
      if (chance(0.3)) complete('tidy_desk', day, 19, 'discipline', 8);
      if (done >= 5) {
        const heal = Math.min(5, 100 - hp);
        hp += heal;
        write({
          type: 'bonus.full_day',
          occurredAt: instant(day, 22, 30),
          gameDay: day,
          dCoins: 10,
          dHp: heal,
        });
      }
      if (chance(0.03)) {
        write({
          type: 'mission.backfilled',
          occurredAt: instant(day, 13),
          gameDay: addDays(day, -2),
          missionId: ids.meditation,
          dXp: 5,
          dStats: { wisdom: 1 },
        });
        xp += 5;
      }
      if (chance(0.05)) {
        write({
          type: 'boss.step_done',
          occurredAt: instant(day, 17),
          gameDay: day,
          bossId: chance(0.8) ? mainBoss.id : goneBoss.id,
          dXp: 20,
          dStats: { discipline: 6 },
          payload: { dealt: 20 },
        });
        xp += 20;
      }
      if (back % 10 === 0) {
        write({
          type: 'item.bought',
          occurredAt: instant(day, 15),
          gameDay: day,
          itemKey: 'potion',
          dCoins: -50,
        });
      }
      if (back % 25 === 0) {
        write({ type: 'item.used', occurredAt: instant(day, 16), gameDay: day, itemKey: 'potion' });
      }
      if (xp > level * level * 100) {
        level += 1;
        write({
          type: 'hero.level_up',
          occurredAt: instant(day, 23),
          gameDay: day,
          payload: { from: level - 1, to: level },
        });
      }
      if (back % 90 === 0) {
        write({
          type: 'badge.unlocked',
          occurredAt: instant(day, 23, 10),
          gameDay: day,
          dCoins: 20,
          payload: { badge: 'first_week' },
        });
      }
    }
  })();

  // The hero adds up to the log.
  const totals = db
    .select({
      xp: sql<number>`sum(${events.dXp})`,
      coins: sql<number>`sum(${events.dCoins})`,
      hp: sql<number>`sum(${events.dHp})`,
    })
    .from(events)
    .get()!;
  db.update(hero)
    .set({ xpTotal: totals.xp, coins: totals.coins, hp: totals.hp, streak: heroStreak })
    .run();
  const points: Record<string, number> = {};
  for (const row of db.select({ stats: events.dStats }).from(events).all()) {
    for (const [stat, value] of Object.entries(row.stats ?? {})) {
      points[stat] = (points[stat] ?? 0) + (value ?? 0);
    }
  }
  for (const [statKey, value] of Object.entries(points)) {
    db.insert(heroStats)
      .values({ statKey: statKey as StatKey, points: value })
      .onConflictDoUpdate({ target: heroStats.statKey, set: { points: value } })
      .run();
  }
  const count = client.prepare('SELECT count(*) AS n FROM events').get() as { n: number };
  return { db, firstDay, events: count.n, missionIds: ids };
}
