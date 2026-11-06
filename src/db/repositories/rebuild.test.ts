import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { rebuildHeroFromEvents } from '@/db/repositories/rebuild';
import { hero, heroStats } from '@/db/schema';
import type { Db } from '@/db/types';
import { heroLevelFromXp } from '@/rules/level';

import { heroTotals } from '../../../test/db';
import { at, expectHeroMatchesLog, newGame, TZ } from '../../../test/game';

/** XP, coins and stat points given like a game action does: state and event together. */
function reward(db: Db, deltas: { xp?: number; coins?: number; stats?: Record<string, number> }) {
  const change = changeHero(db, deltas, at(6, 8));
  appendEvent(db, {
    type: 'bonus.full_day',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

/** A hero that no longer adds up to the log, as after a bug or an interrupted write. */
function corrupt(db: Db): void {
  db.update(hero).set({ level: 9, xpInLevel: 3, xpTotal: 4321, hp: 2, coins: 999 }).run();
  db.update(heroStats).set({ points: 77 }).run();
}

describe('rebuildHeroFromEvents', () => {
  it('changes nothing when the hero already adds up to the log', () => {
    const db = newGame(['journal']);
    reward(db, { xp: 120, coins: 30, stats: { wisdom: 12 } });
    const before = db.select().from(hero).get();
    expect(rebuildHeroFromEvents(db, at(6, 10))).toEqual({ repaired: false });
    expect(db.select().from(hero).get()).toEqual(before);
    expectHeroMatchesLog(db);
  });

  it('recomputes XP, level, coins, hit points and stats from the log', () => {
    const db = newGame(['journal']);
    reward(db, { xp: 500, coins: 40, stats: { wisdom: 20, charisma: 6 } });
    const expected = heroTotals(db);
    corrupt(db);
    expect(rebuildHeroFromEvents(db, at(6, 10))).toEqual({ repaired: true });
    expect(heroTotals(db)).toEqual(expected);
    const level = heroLevelFromXp(expected.xp);
    expect(db.select().from(hero).get()).toMatchObject({
      level: level.level,
      xpInLevel: level.xpInLevel,
      xpTotal: 500,
      updatedAt: at(6, 10),
    });
    expectHeroMatchesLog(db);
  });

  it('puts back to 0 the stats that the log never changed', () => {
    const db = newGame(['journal']);
    corrupt(db);
    rebuildHeroFromEvents(db, at(6, 10));
    for (const row of db.select().from(heroStats).all()) {
      expect(row.points).toBe(0);
    }
    expectHeroMatchesLog(db);
  });

  it('refuses a log that gives impossible values', () => {
    const db = newGame(['journal']);
    appendEvent(db, {
      type: 'bonus.full_day',
      occurredAt: at(6, 8),
      tzOffset: TZ,
      source: 'system',
      gameDay: '2026-11-05',
      deltas: { coins: -10 },
    });
    const before = db.select().from(hero).get();
    expect(() => rebuildHeroFromEvents(db, at(6, 10))).toThrow(RangeError);
    expect(db.select().from(hero).get()).toEqual(before);
  });

  it('refuses a database without a profile', () => {
    const db = newGame(['journal']);
    db.delete(hero).run();
    expect(() => rebuildHeroFromEvents(db, at(6, 10))).toThrow(RangeError);
  });
});
