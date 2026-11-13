import { and, asc, eq } from 'drizzle-orm';

import { completeBossStep, createBoss } from '@/db/repositories/boss';
import {
  completeMission,
  progressMission,
  setDayPlan,
  skipMission,
} from '@/db/repositories/completion';
import { appendEvent, type EventType } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem } from '@/db/repositories/shop';
import { undoEvent, UndoRefusedError, type UndoRefusal } from '@/db/repositories/undo';
import {
  boss,
  bossSteps,
  companion,
  dayPlan,
  events,
  hero,
  heroStats,
  missionDays,
  missions,
} from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, expectHeroMatchesLog, missionId, newGame, TZ } from '../../../test/game';

const NOW = clockAt(6, 10);
const LATER = clockAt(6, 18);

function complete(db: Db, id: string): string {
  completeMission(db, { missionId: id, source: 'app', ...NOW });
  return lastEvent(db, 'mission.completed').id;
}

function lastEvent(db: Db, type: EventType) {
  const rows = db.select().from(events).where(eq(events.type, type)).orderBy(asc(events.seq)).all();
  const last = rows.at(-1);
  if (last === undefined) {
    throw new Error(`No ${type} event`);
  }
  return last;
}

function adjustHero(db: Db, deltas: { xp?: number; coins?: number; hp?: number }): void {
  const change = changeHero(db, deltas, at(6, 8));
  appendEvent(db, {
    type: 'bonus.plan',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

/** Why the undo was refused, which the screen tells in words. */
function refusalOf(undo: () => unknown): UndoRefusal | 'not_refused' {
  try {
    undo();
  } catch (error) {
    if (error instanceof UndoRefusedError) {
      return error.reason;
    }
    throw error;
  }
  return 'not_refused';
}

function stepsOf(db: Db, bossId: string): string[] {
  return db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all()
    .map((row) => row.id);
}

function heroRow(db: Db) {
  const { updatedAt: _updatedAt, ...rest } = db.select().from(hero).get()!;
  return rest;
}

describe('undoEvent', () => {
  it('takes back every gain of a completion and restores the mission day and streak', () => {
    const db = newGame(['journal', 'healthy_meal']);
    adjustHero(db, { hp: -10 });
    const before = heroRow(db);
    const journal = missionId(db, 'journal');
    const completed = complete(db, journal);
    const result = undoEvent(db, completed, LATER);
    expect(result.reverted).toEqual([completed]);
    expect(heroRow(db)).toEqual(before);
    expect(db.select().from(missionDays).all()).toEqual([]);
    expect(db.select().from(missions).where(eq(missions.id, journal)).get()).toMatchObject({
      streak: 0,
      streakBest: 0,
    });
    expect(db.select().from(companion).get()?.completionsTotal).toBe(0);
    expect(lastEvent(db, 'event.reverted')).toMatchObject({
      revertsId: completed,
      missionId: journal,
      gameDay: '2026-11-06',
      dXp: -10,
      dCoins: -2,
      dHp: -1,
      dStats: { wisdom: -10 },
    });
    expectHeroMatchesLog(db);
    // The mission can be completed again.
    expect(completeMission(db, { missionId: journal, source: 'app', ...LATER }).status).toBe(
      'completed',
    );
    expectHeroMatchesLog(db);
  });

  it('takes back the full-day and plan bonuses that the day loses', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    setDayPlan(db, journal, NOW);
    const completed = complete(db, journal);
    const fullDay = lastEvent(db, 'bonus.full_day').id;
    const plan = lastEvent(db, 'bonus.plan').id;
    expect(db.select().from(hero).get()).toMatchObject({ xpTotal: 35, coins: 12 });
    const result = undoEvent(db, completed, LATER);
    expect(result.reverted).toEqual([completed, fullDay, plan]);
    expect(db.select().from(hero).get()).toMatchObject({ xpTotal: 0, coins: 0, hp: 50 });
    expectHeroMatchesLog(db);
    // Completed again, the day earns its bonuses again.
    expect(completeMission(db, { missionId: journal, source: 'app', ...LATER }).bonuses).toEqual([
      'bonus.full_day',
      'bonus.plan',
    ]);
    expectHeroMatchesLog(db);
  });

  it('brings the level back down when the XP go below the threshold', () => {
    const db = newGame(['journal']);
    adjustHero(db, { xp: 195 });
    const completed = complete(db, missionId(db, 'journal'));
    expect(db.select().from(hero).get()?.level).toBe(2);
    undoEvent(db, completed, LATER);
    expect(db.select().from(hero).get()).toMatchObject({ level: 1, xpInLevel: 195 });
    expectHeroMatchesLog(db);
  });

  it('gives back the hit points of the linked boss', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', steps: ['A', 'B', 'C'], missionIds: [journal] },
      NOW,
    );
    const completed = complete(db, journal);
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(58);
    undoEvent(db, completed, LATER);
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(60);
    expectHeroMatchesLog(db);
  });

  it('undoes a boss step: the step is to do again, the hit points and the stat points go back', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', statKey: 'wisdom', steps: ['A', 'B', 'C'] },
      NOW,
    );
    const [first] = stepsOf(db, thesis.id);
    const before = heroRow(db);
    const { eventId } = completeBossStep(db, first, NOW);
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(40);

    expect(undoEvent(db, eventId, LATER).reverted).toEqual([eventId]);

    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(60);
    expect(db.select().from(bossSteps).where(eq(bossSteps.id, first)).get()?.doneAt).toBeNull();
    expect(db.select().from(heroStats).where(eq(heroStats.statKey, 'wisdom')).get()?.points).toBe(
      0,
    );
    expect(heroRow(db)).toEqual(before);
    expect(refusalOf(() => undoEvent(db, eventId, LATER))).toBe('already_undone');
    expectHeroMatchesLog(db);
  });

  it('gives back only the hit points the step really took', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', steps: ['A', 'B'], missionIds: [journal] },
      NOW,
    );
    db.update(boss).set({ hp: 21 }).where(eq(boss.id, thesis.id)).run();
    const [first] = stepsOf(db, thesis.id);
    const { eventId } = completeBossStep(db, first, NOW);
    // One step left: the floor is 10, so the step took 11 and not 20.
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(10);

    undoEvent(db, eventId, LATER);

    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(21);
  });

  it('never undoes the step that defeats a boss, and refuses a step of another day', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, { name: 'Tesi', difficulty: 'easy', steps: ['A', 'B'] }, NOW);
    const [first, last] = stepsOf(db, thesis.id);
    const step = completeBossStep(db, first, NOW);
    const victory = completeBossStep(db, last, NOW);
    expect(victory.defeated).toBe(true);

    expect(refusalOf(() => undoEvent(db, victory.eventId, LATER))).toBe('boss_not_active');
    // The boss is defeated: an earlier step cannot be undone either.
    expect(refusalOf(() => undoEvent(db, step.eventId, LATER))).toBe('boss_not_active');

    const other = newGame(['journal']);
    const quest = createBoss(other, { name: 'Tesi', difficulty: 'easy', steps: ['A', 'B'] }, NOW);
    const done = completeBossStep(other, stepsOf(other, quest.id)[0], NOW);
    expect(refusalOf(() => undoEvent(other, done.eventId, clockAt(7, 10)))).toBe('day_changed');
    expectHeroMatchesLog(db);
  });

  it('brings a measurable mission back to the value before the completion', () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    progressMission(db, { missionId: water, source: 'app', amount: 1.5, ...NOW });
    progressMission(db, { missionId: water, source: 'app', amount: 0.5, ...NOW });
    const completed = lastEvent(db, 'mission.completed').id;
    undoEvent(db, completed, LATER);
    expect(
      db
        .select({ status: missionDays.status, value: missionDays.value })
        .from(missionDays)
        .where(and(eq(missionDays.missionId, water), eq(missionDays.gameDay, '2026-11-06')))
        .get(),
    ).toEqual({ status: 'partial', value: 1.5 });
    expectHeroMatchesLog(db);
  });

  it('refuses an undo after the day change', () => {
    const db = newGame(['journal']);
    const completed = complete(db, missionId(db, 'journal'));
    const totals = heroRow(db);
    expect(() => undoEvent(db, completed, clockAt(7, 10))).toThrow(UndoRefusedError);
    expect(refusalOf(() => undoEvent(db, completed, clockAt(7, 10)))).toBe('day_changed');
    expect(heroRow(db)).toEqual(totals);
  });

  it('refuses an undo when the coins to give back were already spent', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 40 });
    const completed = complete(db, missionId(db, 'journal'));
    buyItem(db, 'potion', LATER);
    expect(db.select().from(hero).get()?.coins).toBe(2);
    expect(refusalOf(() => undoEvent(db, completed, LATER))).toBe('coins_spent');
    expect(db.select().from(hero).get()?.coins).toBe(2);
    expect(db.select().from(missionDays).all()).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('refuses an event undone twice, an unknown event and events that are not completions', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const completed = complete(db, missionId(db, 'journal'));
    undoEvent(db, completed, LATER);
    expect(refusalOf(() => undoEvent(db, completed, LATER))).toBe('already_undone');
    expect(() => undoEvent(db, 'missing', LATER)).toThrow(RangeError);
    expect(() => undoEvent(db, lastEvent(db, 'event.reverted').id, LATER)).toThrow(RangeError);
    expect(() => undoEvent(db, lastEvent(db, 'hero.created').id, LATER)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });
});

describe('undoEvent on a skip', () => {
  function skip(db: Db, id: string): string {
    skipMission(db, { missionId: id, reason: 'rest', ...NOW });
    return lastEvent(db, 'mission.skipped').id;
  }

  it('makes the mission to do again and gives the skip back', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    const skipped = skip(db, journal);
    expect(undoEvent(db, skipped, LATER)).toEqual({ reverted: [skipped] });
    expect(db.select().from(missionDays).all()).toEqual([]);
    expect(lastEvent(db, 'event.reverted')).toMatchObject({ revertsId: skipped, dXp: 0 });
    // The skip no longer counts in the week: 3 are possible again.
    skip(db, journal);
    expect(refusalOf(() => undoEvent(db, skipped, LATER))).toBe('already_undone');
    expectHeroMatchesLog(db);
  });

  it('keeps the value reached by a measurable mission before the skip', () => {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    progressMission(db, { missionId: water, source: 'app', ...NOW });
    undoEvent(db, skip(db, water), LATER);
    expect(db.select().from(missionDays).get()).toMatchObject({
      status: 'partial',
      value: 0.25,
      skipReason: null,
    });
    expectHeroMatchesLog(db);
  });

  it('takes back the full-day bonus that the skip gave', () => {
    const db = newGame(['journal', 'healthy_meal']);
    complete(db, missionId(db, 'journal'));
    const skipped = skip(db, missionId(db, 'healthy_meal'));
    const bonus = lastEvent(db, 'bonus.full_day').id;
    expect(undoEvent(db, skipped, LATER)).toEqual({ reverted: [skipped, bonus] });
    expect(db.select().from(hero).get()?.coins).toBe(2);
    expectHeroMatchesLog(db);
  });

  it('puts a skipped priority back in its place and takes back the plan bonus', () => {
    const db = newGame(['journal', 'healthy_meal', 'track_expenses']);
    const journal = missionId(db, 'journal');
    const meal = missionId(db, 'healthy_meal');
    setDayPlan(db, journal, NOW);
    setDayPlan(db, meal, NOW);
    const skipped = skip(db, journal);
    expect(db.select().from(dayPlan).all()).toMatchObject([{ missionId: meal, position: 1 }]);
    // The plan is now the meal alone: done, it gives the bonus.
    complete(db, meal);
    const bonus = lastEvent(db, 'bonus.plan').id;
    expect(undoEvent(db, skipped, LATER)).toEqual({ reverted: [skipped, bonus] });
    expect(db.select().from(dayPlan).orderBy(asc(dayPlan.position)).all()).toMatchObject([
      { missionId: journal, position: 0 },
      { missionId: meal, position: 1 },
    ]);
    expectHeroMatchesLog(db);
  });

  it('does not put a priority back in a plan filled in the meantime', () => {
    const db = newGame(['journal', 'healthy_meal', 'track_expenses', 'no_social_evening']);
    const keys = ['journal', 'healthy_meal', 'track_expenses'];
    for (const key of keys) {
      setDayPlan(db, missionId(db, key), NOW);
    }
    const skipped = skip(db, missionId(db, 'journal'));
    setDayPlan(db, missionId(db, 'no_social_evening'), NOW);
    undoEvent(db, skipped, LATER);
    expect(db.select({ missionId: dayPlan.missionId }).from(dayPlan).all()).not.toContainEqual({
      missionId: missionId(db, 'journal'),
    });
    expect(db.select().from(dayPlan).all()).toHaveLength(3);
  });

  it('is refused after the day change', () => {
    const db = newGame(['journal']);
    const skipped = skip(db, missionId(db, 'journal'));
    expect(refusalOf(() => undoEvent(db, skipped, clockAt(7, 10)))).toBe('day_changed');
    expect(db.select().from(missionDays).get()?.status).toBe('skipped');
  });
});
