import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import {
  archiveBoss,
  checkBossDeadlines,
  completeBossStep,
  createBoss,
} from '@/db/repositories/boss';
import { closePendingDays } from '@/db/repositories/closing';
import {
  completeMission,
  progressMission,
  setDayPlan,
  skipMission,
  SKIP_REASONS,
} from '@/db/repositories/completion';
import { createMission, listTodayMissions, type NewMission } from '@/db/repositories/missions';
import { rebuildHeroFromEvents } from '@/db/repositories/rebuild';
import { gameDayOf, getSetting, setSetting } from '@/db/repositories/settings';
import { buyItem, usePotion } from '@/db/repositories/shop';
import { undoEvent } from '@/db/repositories/undo';
import { boss, bossSteps, events, hero, inventory, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { HERO_LEVELS, HP, SHOP } from '@/rules/config';
import type { Frequency } from '@/rules/frequency';
import { addDays, weekday } from '@/rules/gameDay';
import { DIFFICULTIES, STAT_KEYS, type GameDay } from '@/rules/types';

import { heroTotals, totalsFromLog } from './db';
import { clockAt, FRIDAY, newGame } from './game';

// A simulated game of 90 days (modello-dati.md, 4.3 and 11): missions and bosses are created,
// completed, undone and skipped, items bought and used, days closed, with a pseudo-random
// generator on a fixed seed so every run plays the same game. After every day the invariants of
// the hero must hold and the hero must add up to the event log.

const DAYS = 90;
/** Every completion runs many queries: a few missions keep the three games under 30 seconds. */
const MAX_MISSIONS = 7;

/** Mulberry32: a small pseudo-random generator, the same sequence for the same seed. */
function generator(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    chance: (probability: number) => next() < probability,
    integer: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

type Random = ReturnType<typeof generator>;

/** Runs an action that the game may refuse; any error other than a refusal fails the test. */
function attempt(action: () => unknown): boolean {
  try {
    action();
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

function owned(db: Db, itemKey: string): number {
  return db.select().from(inventory).where(eq(inventory.itemKey, itemKey)).get()?.quantity ?? 0;
}

function randomMission(random: Random, day: GameDay, count: number): NewMission {
  const statPrimary = random.pick(STAT_KEYS);
  const base = {
    name: `Missione ${count}`,
    difficulty: random.pick(DIFFICULTIES),
    statPrimary,
    statSecondary: random.chance(0.5)
      ? random.pick(STAT_KEYS.filter((stat) => stat !== statPrimary))
      : null,
  };
  if (random.chance(0.25)) {
    return { ...base, kind: 'task', dueDay: addDays(day, random.integer(0, 5)) };
  }
  const frequency = random.pick<Frequency>([
    { type: 'daily' },
    { type: 'weekdays', days: [1, 3, 5] },
    { type: 'times_per_week', times: random.integer(1, 4) },
    { type: 'every_n_days', n: random.integer(2, 3), from: day },
  ]);
  const goal = random.chance(0.3)
    ? ({ type: 'quantity', target: 4, unit: 'glass', increment: 1 } as const)
    : ({ type: 'none' } as const);
  return { ...base, frequency, goal };
}

interface Counts {
  completed: number;
  undone: number;
  skipped: number;
  bought: number;
  potions: number;
  bossSteps: number;
  closed: number;
  /** «N volte a settimana» missions created after the first day of the week (choice 16). */
  weeklyMidWeek: number;
  /** Skips of «N volte a settimana» missions (choice 17). */
  weeklySkips: number;
  /** Potions refused at full hit points (choice 18). */
  fullHpRefusals: number;
}

const isWeekly = (frequency: Frequency | null) => frequency?.type === 'times_per_week';

/** The actions of one game day, at random hours between 08:00 and 22:00. */
function playDay(db: Db, random: Random, date: number, counts: Counts): void {
  const clock = (hour: number) => clockAt(date, hour);
  const today = gameDayOf(clock(8).now, clock(8).tzOffset, getSetting(db, 'day_change'));

  const missionCount = db.select().from(missions).where(isNull(missions.deletedAt)).all().length;
  if (missionCount < MAX_MISSIONS && random.chance(0.15)) {
    const created = createMission(db, randomMission(random, today, missionCount), clock(8));
    if (isWeekly(created.frequency) && weekday(today) !== getSetting(db, 'week_start')) {
      counts.weeklyMidWeek++;
    }
  }

  if (random.chance(0.05)) {
    const habits = db.select().from(missions).where(eq(missions.kind, 'habit')).all();
    attempt(() =>
      createBoss(
        db,
        {
          name: `Boss ${today}`,
          difficulty: random.pick(DIFFICULTIES),
          statKey: random.chance(0.5) ? random.pick(STAT_KEYS) : null,
          deadlineDay: random.chance(0.7) ? addDays(today, random.integer(3, 20)) : null,
          steps: Array.from({ length: random.integer(2, 6) }, (_, index) => `Passo ${index + 1}`),
          missionIds: habits.length > 0 && random.chance(0.5) ? [random.pick(habits).id] : [],
        },
        clock(9),
      ),
    );
  }

  const due = listTodayMissions(db, today);
  for (const mission of due.slice(0, random.integer(0, 2))) {
    attempt(() => setDayPlan(db, mission.id, clock(9)));
  }
  for (const mission of due) {
    const hour = random.integer(10, 21);
    // The «N volte a settimana» missions are skipped more often, to lower their number (choice 17).
    if (random.chance(isWeekly(mission.frequency) ? 0.15 : 0.05)) {
      if (
        attempt(() =>
          skipMission(db, {
            ...clock(hour),
            missionId: mission.id,
            reason: random.pick(SKIP_REASONS),
          }),
        )
      ) {
        counts.skipped++;
        if (isWeekly(mission.frequency)) {
          counts.weeklySkips++;
        }
      }
    } else if (random.chance(0.65)) {
      // A measurable mission gets one or two taps, or is completed at its target in one go.
      const input = { ...clock(hour), missionId: mission.id, source: 'app' } as const;
      const taps = mission.goalType === 'none' || random.chance(0.5) ? 0 : random.integer(1, 2);
      const results =
        taps === 0
          ? [completeMission(db, input)]
          : Array.from({ length: taps }, () => progressMission(db, { ...input, amount: 2 }));
      counts.completed += results.filter((result) => result.status === 'completed').length;
    }
  }

  if (random.chance(0.2)) {
    const completions = db
      .select()
      .from(events)
      .where(and(eq(events.type, 'mission.completed'), eq(events.gameDay, today)))
      .all();
    const reverted = new Set(
      db
        .select({ id: events.revertsId })
        .from(events)
        .where(isNotNull(events.revertsId))
        .all()
        .map((row) => row.id),
    );
    const undoable = completions.filter((event) => !reverted.has(event.id));
    if (undoable.length > 0 && attempt(() => undoEvent(db, random.pick(undoable).id, clock(22)))) {
      counts.undone++;
    }
  }

  const active = db.select().from(boss).where(eq(boss.status, 'active')).all();
  for (const target of active) {
    if (random.chance(0.3)) {
      const step = db
        .select()
        .from(bossSteps)
        .where(and(eq(bossSteps.bossId, target.id), isNull(bossSteps.doneAt)))
        .get();
      if (step !== undefined && attempt(() => completeBossStep(db, step.id, clock(20)))) {
        counts.bossSteps++;
      }
    } else if (target.kind === 'normal' && random.chance(0.02)) {
      archiveBoss(db, target.id, clock(20));
    }
  }

  if (random.chance(0.25)) {
    if (attempt(() => buyItem(db, random.pick(['potion', 'shield'] as const), clock(21)))) {
      counts.bought++;
    }
  }
  const atFullHp = db.select().from(hero).get()!.hp === HP.max;
  if (atFullHp && owned(db, 'potion') === 0) {
    attempt(() => buyItem(db, 'potion', clock(21)));
  }
  const before = db.select().from(hero).get()!;
  if (before.hp === HP.max && owned(db, 'potion') > 0) {
    // At full hit points the potion is refused and nothing changes (choice 18).
    const potions = owned(db, 'potion');
    const logged = db.select().from(events).all().length;
    expect(attempt(() => usePotion(db, clock(21)))).toBe(false);
    expect(db.select().from(hero).get()).toEqual(before);
    expect(owned(db, 'potion')).toBe(potions);
    expect(db.select().from(events).all()).toHaveLength(logged);
    counts.fullHpRefusals++;
  } else if (before.hp < 30 && owned(db, 'potion') > 0 && random.chance(0.6)) {
    if (attempt(() => usePotion(db, clock(21)))) {
      counts.potions++;
    }
  }
}

/** The quest of the first launch gives at most the 200 XP to level 2 and 50 coins (choice 12). */
function expectStarterReward(db: Db): void {
  const starter = db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
  expect(starter.status).toBe('defeated');
  const victory = db
    .select()
    .from(events)
    .where(and(eq(events.type, 'boss.defeated'), eq(events.bossId, starter.id)))
    .get()!;
  expect(victory.dCoins).toBe(50);
  expect(victory.dXp).toBeGreaterThanOrEqual(0);
  expect(victory.dXp).toBeLessThanOrEqual(200);
}

function expectInvariants(db: Db): void {
  const current = db.select().from(hero).get()!;
  expect(current.coins).toBeGreaterThanOrEqual(0);
  expect(current.hp).toBeGreaterThanOrEqual(0);
  expect(current.hp).toBeLessThanOrEqual(HP.max);
  expect(current.level).toBeGreaterThanOrEqual(1);
  expect(current.level).toBeLessThanOrEqual(HERO_LEVELS.max);
  expect(owned(db, 'shield')).toBeLessThanOrEqual(SHOP.shield.maxOwned);
  expect(heroTotals(db)).toEqual(totalsFromLog(db));
}

function simulate(seed: number): Counts {
  const random = generator(seed);
  const db = newGame(['drink_water', 'run', 'journal']);
  // Sunday, the last day of the week from Monday, is a rest day (choice 15).
  setSetting(db, 'rest_days', [7], clockAt(FRIDAY, 9).now);
  // Friday is in the middle of the week: its first week is partial (choice 16).
  createMission(
    db,
    { name: 'Palestra', frequency: { type: 'times_per_week', times: 3 } },
    clockAt(FRIDAY, 9),
  );
  const counts: Counts = {
    completed: 0,
    undone: 0,
    skipped: 0,
    bought: 0,
    potions: 0,
    bossSteps: 0,
    closed: 0,
    weeklyMidWeek: 1,
    weeklySkips: 0,
    fullHpRefusals: 0,
  };
  for (let date = FRIDAY; date < FRIDAY + DAYS; date++) {
    // Some days the app is not opened at all: the next opening closes them together.
    if (date > FRIDAY && random.chance(0.1)) {
      continue;
    }
    const opening = clockAt(date, 7);
    counts.closed += closePendingDays(db, opening).length;
    // Closing again changes nothing.
    expect(closePendingDays(db, opening)).toEqual([]);
    checkBossDeadlines(db, opening);
    expectInvariants(db);
    playDay(db, random, date, counts);
    expectInvariants(db);
  }
  counts.closed += closePendingDays(db, clockAt(FRIDAY + DAYS, 7)).length;
  expectInvariants(db);
  expect(rebuildHeroFromEvents(db, clockAt(FRIDAY + DAYS, 8).now)).toEqual({ repaired: false });
  expectStarterReward(db);
  return counts;
}

describe('a simulated game of 90 days', () => {
  it.each([1, 42, 2026])('keeps the hero equal to the event log with seed %i', (seed) => {
    const counts = simulate(seed);
    expect(counts.closed).toBe(DAYS);
    for (const [name, count] of Object.entries(counts)) {
      expect({ name, played: count > 0 }).toEqual({ name, played: true });
    }
  });
});
