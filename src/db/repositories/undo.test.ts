import { and, asc, eq } from 'drizzle-orm';

import { createBoss } from '@/db/repositories/boss';
import {
  completeMission,
  progressMission,
  setDayPlan,
  skipMission,
} from '@/db/repositories/completion';
import { appendEvent, type EventType } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem } from '@/db/repositories/shop';
import { undoEvent } from '@/db/repositories/undo';
import { boss, companion, events, hero, missionDays, missions } from '@/db/schema';
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
    expect(() => undoEvent(db, completed, clockAt(7, 10))).toThrow(RangeError);
    expect(heroRow(db)).toEqual(totals);
  });

  it('refuses an undo when the coins to give back were already spent', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 40 });
    const completed = complete(db, missionId(db, 'journal'));
    buyItem(db, 'potion', LATER);
    expect(db.select().from(hero).get()?.coins).toBe(2);
    expect(() => undoEvent(db, completed, LATER)).toThrow(RangeError);
    expect(db.select().from(hero).get()?.coins).toBe(2);
    expect(db.select().from(missionDays).all()).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('refuses an event undone twice, an unknown event and events that are not completions', () => {
    const db = newGame(['journal', 'healthy_meal']);
    const completed = complete(db, missionId(db, 'journal'));
    undoEvent(db, completed, LATER);
    expect(() => undoEvent(db, completed, LATER)).toThrow(RangeError);
    expect(() => undoEvent(db, 'missing', LATER)).toThrow(RangeError);
    skipMission(db, { missionId: missionId(db, 'healthy_meal'), reason: 'rest', ...NOW });
    expect(() => undoEvent(db, lastEvent(db, 'mission.skipped').id, LATER)).toThrow(RangeError);
    expect(() => undoEvent(db, lastEvent(db, 'event.reverted').id, LATER)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });
});
