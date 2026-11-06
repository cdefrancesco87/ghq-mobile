import { and, asc, eq, sql } from 'drizzle-orm';

import { markStepDone } from '@/db/repositories/boss';
import {
  completeMission,
  progressMission,
  removeFromDayPlan,
  setDayPlan,
  skipMission,
  type CompletionInput,
} from '@/db/repositories/completion';
import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { deleteMission } from '@/db/repositories/missions';
import { createProfile } from '@/db/repositories/onboarding';
import {
  boss,
  bossSteps,
  companion,
  dayPlan,
  events,
  hero,
  missionDays,
  missions,
  scheduledReminders,
} from '@/db/schema';
import type { Db } from '@/db/types';

import { createTestDb, heroTotals, totalsFromLog } from '../../../test/db';

/** An instant in Rome (UTC+1 in November) on a day of November 2026. */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);
const FRIDAY = 6;

function newGame(templateKeys: string[], day = FRIDAY): Db {
  const db = createTestDb();
  createProfile(
    db,
    { name: 'Claudio', language: 'it', theme: 'minimal', templateKeys },
    { now: at(day, 9), tzOffset: 60 },
  );
  return db;
}

function missionId(db: Db, templateKey: string): string {
  const row = db
    .select({ id: missions.id })
    .from(missions)
    .where(eq(missions.templateKey, templateKey))
    .get();
  if (row === undefined) {
    throw new Error(`No mission from template ${templateKey}`);
  }
  return row.id;
}

function complete(db: Db, id: string, overrides: Partial<CompletionInput> = {}) {
  return completeMission(db, {
    missionId: id,
    source: 'app',
    now: at(FRIDAY, 10),
    tzOffset: 60,
    ...overrides,
  });
}

function typesAfterCreation(db: Db): string[] {
  const all = db.select({ type: events.type }).from(events).orderBy(asc(events.seq)).all();
  return all.map((row) => row.type).filter((type) => !CREATION.has(type));
}
const CREATION = new Set(['hero.created', 'mission.created', 'boss.created']);

/** A closed day that took hit points, written like the closing will (state and event). */
function loseHp(db: Db, points: number): void {
  appendEvent(db, {
    type: 'day.closed',
    occurredAt: at(FRIDAY, 6),
    tzOffset: 60,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: { hp: -points },
  });
  db.update(hero)
    .set({ hp: sql`${hero.hp} - ${points}` })
    .run();
}

function expectHeroMatchesLog(db: Db): void {
  expect(heroTotals(db)).toEqual(totalsFromLog(db));
}

describe('completeMission', () => {
  it('gives the rewards, marks the day and grows the mission streak', () => {
    const db = newGame(['journal', 'healthy_meal']);
    loseHp(db, 10);
    const journal = missionId(db, 'journal');
    const result = complete(db, journal);
    expect(result.status).toBe('completed');
    expect(db.select().from(hero).get()).toMatchObject({ xpTotal: 10, coins: 2, hp: 41 });
    expect(heroTotals(db).stats).toEqual({ wisdom: 10 });
    expect(db.select().from(missionDays).all()).toEqual([
      {
        missionId: journal,
        gameDay: '2026-11-06',
        status: 'done',
        value: null,
        skipReason: null,
        doneAt: at(FRIDAY, 10),
        source: 'app',
        updatedAt: at(FRIDAY, 10),
      },
    ]);
    expect(db.select().from(missions).where(eq(missions.id, journal)).get()).toMatchObject({
      streak: 1,
      streakBest: 1,
    });
    expectHeroMatchesLog(db);
  });

  it('counts the same completion once, from the notification and from the app', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    const fromNotification = complete(db, journal, {
      source: 'notification',
      idemKey: 'notif:abc123',
    });
    expect(fromNotification.status).toBe('completed');
    const totals = heroTotals(db);
    expect(complete(db, journal, { source: 'app', idemKey: 'app:1' }).status).toBe('already_done');
    expect(complete(db, journal, { source: 'notification', idemKey: 'notif:abc123' }).status).toBe(
      'already_recorded',
    );
    expect(heroTotals(db)).toEqual(totals);
    expect(typesAfterCreation(db).filter((type) => type === 'mission.completed')).toHaveLength(1);
    expect(db.select().from(missionDays).get()?.source).toBe('notification');
    expectHeroMatchesLog(db);
  });

  it('applies the hero streak multiplier and halves the XP on the exhausted day', () => {
    const xpOf = (streak: number, exhausted: boolean) => {
      const db = newGame(['read_pages', 'journal']);
      db.update(hero)
        .set({ streak, exhaustedDay: exhausted ? '2026-11-06' : null })
        .run();
      complete(db, missionId(db, 'read_pages'));
      expectHeroMatchesLog(db);
      return db.select().from(hero).get()?.xpTotal;
    };
    expect(xpOf(0, false)).toBe(25);
    expect(xpOf(7, false)).toBe(28);
    expect(xpOf(0, true)).toBe(13);
    expect(xpOf(7, true)).toBe(14);
  });

  it('completes a measurable mission at its target', () => {
    const db = newGame(['drink_water', 'journal']);
    complete(db, missionId(db, 'drink_water'));
    expect(db.select().from(missionDays).get()).toMatchObject({ status: 'done', value: 2 });
    expectHeroMatchesLog(db);
  });

  it('hatches the egg at the first completion', () => {
    const db = newGame(['journal', 'healthy_meal']);
    complete(db, missionId(db, 'journal'));
    expect(db.select().from(companion).get()).toMatchObject({
      stage: 'baby',
      completionsTotal: 1,
      hatchedAt: at(FRIDAY, 10),
    });
    complete(db, missionId(db, 'healthy_meal'));
    expect(db.select().from(companion).get()?.completionsTotal).toBe(2);
    expect(typesAfterCreation(db).filter((type) => type === 'companion.stage_up')).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('marks the second step of the quest of the first launch at the first completion', () => {
    const db = newGame(['journal', 'healthy_meal']);
    complete(db, missionId(db, 'journal'));
    complete(db, missionId(db, 'healthy_meal'));
    const steps = db.select().from(bossSteps).orderBy(asc(bossSteps.position)).all();
    expect(steps.map((step) => step.doneAt)).toEqual([at(FRIDAY, 9), at(FRIDAY, 10), null]);
    expect(db.select().from(boss).get()).toMatchObject({ hp: 20, status: 'active' });
    expect(typesAfterCreation(db).filter((type) => type === 'boss.step_done')).toHaveLength(2);
    expectHeroMatchesLog(db);
  });

  it('damages the linked boss, and only its last step defeats it', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const now = at(FRIDAY, 9);
    db.insert(boss)
      .values({
        id: 'marathon',
        name: 'Maratona',
        difficulty: 'medium',
        statKey: 'strength',
        hpMax: 40,
        hp: 40,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(bossSteps)
      .values([
        { id: 'step-1', bossId: 'marathon', position: 0, title: 'Corri 10 km' },
        { id: 'step-2', bossId: 'marathon', position: 1, title: 'Corri 21 km' },
      ])
      .run();
    const journal = missionId(db, 'journal');
    db.update(missions).set({ bossId: 'marathon' }).where(eq(missions.id, journal)).run();

    complete(db, journal);
    const marathon = () => db.select().from(boss).where(eq(boss.id, 'marathon')).get();
    expect(marathon()).toMatchObject({ hp: 38, status: 'active' });

    const context = { now: at(FRIDAY, 11), tzOffset: 60 };
    db.transaction((tx) => markStepDone(tx, 'step-1', context));
    expect(marathon()).toMatchObject({ hp: 18, status: 'active' });
    expect(heroTotals(db).stats).toMatchObject({ strength: 10 });

    db.transaction((tx) => markStepDone(tx, 'step-2', context));
    expect(marathon()).toMatchObject({ hp: 0, status: 'defeated', defeatedAt: at(FRIDAY, 11) });
    // 2 steps × 10 XP × 1.5 for a medium boss, and a fifth of it in coins.
    const victory = db.select().from(events).where(eq(events.type, 'boss.defeated')).get();
    expect(victory).toMatchObject({ dXp: 30, dCoins: 6, bossId: 'marathon' });
    expectHeroMatchesLog(db);
  });

  it('gives the full-day bonus with the last mission of the day', () => {
    const db = newGame(['journal', 'healthy_meal']);
    loseHp(db, 10);
    expect(complete(db, missionId(db, 'journal')).bonuses).toEqual([]);
    expect(complete(db, missionId(db, 'healthy_meal')).bonuses).toEqual(['bonus.full_day']);
    expect(db.select().from(hero).get()).toMatchObject({ coins: 14, hp: 47 });
    const bonus = db.select().from(events).where(eq(events.type, 'bonus.full_day')).get();
    expect(bonus).toMatchObject({ dCoins: 10, dHp: 5, gameDay: '2026-11-06' });
    expectHeroMatchesLog(db);
  });

  it('does not count a skipped mission against the full day', () => {
    const db = newGame(['journal', 'healthy_meal', 'track_expenses']);
    skipMission(db, {
      missionId: missionId(db, 'track_expenses'),
      reason: 'travel',
      now: at(FRIDAY, 10),
      tzOffset: 60,
    });
    complete(db, missionId(db, 'journal'));
    expect(complete(db, missionId(db, 'healthy_meal')).bonuses).toEqual(['bonus.full_day']);
    expectHeroMatchesLog(db);
  });

  it('gives the plan bonus when every priority is done', () => {
    const db = newGame(['journal', 'healthy_meal', 'track_expenses']);
    const context = { now: at(FRIDAY, 9, 30), tzOffset: 60 };
    setDayPlan(db, missionId(db, 'journal'), context);
    setDayPlan(db, missionId(db, 'healthy_meal'), context);
    complete(db, missionId(db, 'journal'));
    expect(complete(db, missionId(db, 'healthy_meal')).bonuses).toEqual(['bonus.plan']);
    expect(db.select().from(hero).get()?.xpTotal).toBe(45);
    expectHeroMatchesLog(db);
  });

  it('cancels the reminders of the mission for today only', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    db.insert(scheduledReminders)
      .values([
        { osId: 'os-today', missionId: journal, gameDay: '2026-11-06', fireAt: at(FRIDAY, 20) },
        { osId: 'os-tomorrow', missionId: journal, gameDay: '2026-11-07', fireAt: at(7, 20) },
      ])
      .run();
    expect(complete(db, journal).cancelledNotificationIds).toEqual(['os-today']);
    expect(db.select({ osId: scheduledReminders.osId }).from(scheduledReminders).all()).toEqual([
      { osId: 'os-tomorrow' },
    ]);
    expectHeroMatchesLog(db);
  });

  it('refuses missions that are not due today, deleted or unknown', () => {
    const db = newGame(['family_dinner', 'journal']);
    expect(() => complete(db, missionId(db, 'family_dinner'))).toThrow(RangeError);
    expect(() => complete(db, 'missing')).toThrow(RangeError);
    const journal = missionId(db, 'journal');
    deleteMission(db, journal, { now: at(FRIDAY, 9, 30), tzOffset: 60 });
    expect(() => complete(db, journal)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });
});

describe('progressMission', () => {
  it('stays partial until the target, rewards once, and gives nothing beyond', () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    const progress = (minute: number) =>
      progressMission(db, {
        missionId: water,
        source: 'app',
        now: at(FRIDAY, 10, minute),
        tzOffset: 60,
      });
    for (let tap = 1; tap <= 7; tap++) {
      expect(progress(tap).status).toBe('progressed');
    }
    expect(db.select().from(missionDays).get()).toMatchObject({ status: 'partial', value: 1.75 });
    expect(heroTotals(db)).toMatchObject({ xp: 0, coins: 0 });

    expect(progress(8).status).toBe('completed');
    expect(db.select().from(missionDays).get()).toMatchObject({ status: 'done', value: 2 });
    expect(heroTotals(db)).toMatchObject({ xp: 10, coins: 2 });

    expect(progress(9).status).toBe('progressed');
    expect(db.select().from(missionDays).get()).toMatchObject({ status: 'done', value: 2.25 });
    expect(heroTotals(db)).toMatchObject({ xp: 10, coins: 2 });
    expect(typesAfterCreation(db).filter((type) => type === 'mission.progressed')).toHaveLength(8);
    expectHeroMatchesLog(db);
  });

  it('refuses a mission without a goal', () => {
    const db = newGame(['journal']);
    expect(() =>
      progressMission(db, {
        missionId: missionId(db, 'journal'),
        source: 'app',
        now: at(FRIDAY, 10),
        tzOffset: 60,
      }),
    ).toThrow(RangeError);
  });
});

describe('skipMission', () => {
  const MONDAY = 2;

  it('records the skip with its reason, without rewards', () => {
    const db = newGame(['journal'], MONDAY);
    const journal = missionId(db, 'journal');
    const totals = heroTotals(db);
    skipMission(db, { missionId: journal, reason: 'illness', now: at(MONDAY, 10), tzOffset: 60 });
    expect(db.select().from(missionDays).get()).toMatchObject({
      status: 'skipped',
      skipReason: 'illness',
    });
    expect(heroTotals(db)).toEqual(totals);
    expect(() => complete(db, journal, { now: at(MONDAY, 11) })).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });

  it('refuses a fourth skip of the same mission in a week', () => {
    const db = newGame(['journal'], MONDAY);
    const journal = missionId(db, 'journal');
    const skipOn = (day: number) =>
      skipMission(db, { missionId: journal, reason: 'other', now: at(day, 10), tzOffset: 60 });
    skipOn(2);
    skipOn(3);
    skipOn(4);
    expect(() => skipOn(5)).toThrow(RangeError);
    // A new week starts on Monday 9 November.
    expect(() => skipOn(9)).not.toThrow();
    expectHeroMatchesLog(db);
  });
});

describe('day plan', () => {
  it('accepts 3 priorities, refuses a fourth and frees a slot when one is removed', () => {
    const db = newGame(['journal', 'healthy_meal', 'track_expenses', 'no_social_evening']);
    const context = { now: at(FRIDAY, 9, 30), tzOffset: 60 };
    for (const key of ['journal', 'healthy_meal', 'track_expenses']) {
      setDayPlan(db, missionId(db, key), context);
    }
    expect(() => setDayPlan(db, missionId(db, 'no_social_evening'), context)).toThrow(RangeError);
    removeFromDayPlan(db, missionId(db, 'healthy_meal'), context);
    setDayPlan(db, missionId(db, 'no_social_evening'), context);
    const plan = db
      .select({ missionId: dayPlan.missionId, position: dayPlan.position })
      .from(dayPlan)
      .where(and(eq(dayPlan.gameDay, '2026-11-06')))
      .orderBy(asc(dayPlan.position))
      .all();
    expect(plan).toEqual([
      { missionId: missionId(db, 'journal'), position: 0 },
      { missionId: missionId(db, 'no_social_evening'), position: 1 },
      { missionId: missionId(db, 'track_expenses'), position: 2 },
    ]);
  });

  it('refuses a mission that is not due today or is already a priority', () => {
    const db = newGame(['journal', 'family_dinner']);
    const context = { now: at(FRIDAY, 9, 30), tzOffset: 60 };
    expect(() => setDayPlan(db, missionId(db, 'family_dinner'), context)).toThrow(RangeError);
    setDayPlan(db, missionId(db, 'journal'), context);
    expect(() => setDayPlan(db, missionId(db, 'journal'), context)).toThrow(RangeError);
    expect(() => removeFromDayPlan(db, missionId(db, 'family_dinner'), context)).toThrow(
      RangeError,
    );
  });
});

describe('level up and refusals', () => {
  it('writes the level-up event when a completion takes the hero to the next level', () => {
    const db = newGame(['journal', 'healthy_meal']);
    // 190 XP from an earlier backfilled completion, written like the action will write it.
    db.transaction((tx) => {
      const change = changeHero(tx, { xp: 190 }, at(FRIDAY, 9));
      appendEvent(tx, {
        type: 'mission.backfilled',
        occurredAt: at(FRIDAY, 9),
        tzOffset: 60,
        source: 'backfill',
        deltas: change.deltas,
      });
    });
    complete(db, missionId(db, 'journal'));
    expect(db.select().from(hero).get()).toMatchObject({ level: 2, xpInLevel: 0, xpTotal: 200 });
    const levelUp = db.select().from(events).where(eq(events.type, 'hero.level_up')).get();
    expect(levelUp).toMatchObject({ dXp: 0, payload: { from: 1, to: 2 } });
    expectHeroMatchesLog(db);
  });

  it('refuses to skip a mission already done or with an unknown reason', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    const skip = (reason: string) =>
      skipMission(db, {
        missionId: journal,
        reason: reason as never,
        now: at(FRIDAY, 11),
        tzOffset: 60,
      });
    expect(() => skip('boredom')).toThrow(RangeError);
    complete(db, journal);
    expect(() => skip('illness')).toThrow(RangeError);
  });

  it('refuses to progress a mission skipped today', () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    skipMission(db, { missionId: water, reason: 'rest', now: at(FRIDAY, 10), tzOffset: 60 });
    expect(() =>
      progressMission(db, { missionId: water, source: 'app', now: at(FRIDAY, 11), tzOffset: 60 }),
    ).toThrow(RangeError);
  });
});
