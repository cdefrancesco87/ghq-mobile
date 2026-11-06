import { eq } from 'drizzle-orm';

import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem, usePotion } from '@/db/repositories/shop';
import { events, hero, inventory } from '@/db/schema';
import type { Db } from '@/db/types';

import { clockAt, expectHeroMatchesLog, newGame, TZ, at } from '../../../test/game';

const NOW = clockAt(6, 10);

/** Coins and hit points changed like a game action does: state and event together. */
function adjustHero(db: Db, deltas: { coins?: number; hp?: number }): void {
  const change = changeHero(db, deltas, at(6, 8));
  appendEvent(db, {
    type: 'day.closed',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

function owned(db: Db, itemKey: string): number {
  return db.select().from(inventory).where(eq(inventory.itemKey, itemKey)).get()?.quantity ?? 0;
}

describe('buyItem', () => {
  it('spends the coins and adds the item to the inventory', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 180 });
    buyItem(db, 'potion', NOW);
    buyItem(db, 'shield', NOW);
    expect(db.select().from(hero).get()?.coins).toBe(30);
    expect(owned(db, 'potion')).toBe(1);
    expect(owned(db, 'shield')).toBe(1);
    const bought = db.select().from(events).where(eq(events.type, 'item.bought')).all();
    expect(bought.map((event) => [event.itemKey, event.dCoins])).toEqual([
      ['potion', -50],
      ['shield', -100],
    ]);
    expectHeroMatchesLog(db);
  });

  it('refuses a purchase without enough coins', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 49 });
    expect(() => buyItem(db, 'potion', NOW)).toThrow(RangeError);
    expect(owned(db, 'potion')).toBe(0);
    expect(db.select().from(hero).get()?.coins).toBe(49);
    expectHeroMatchesLog(db);
  });

  it('refuses a third shield', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 300 });
    buyItem(db, 'shield', NOW);
    buyItem(db, 'shield', NOW);
    expect(() => buyItem(db, 'shield', NOW)).toThrow(RangeError);
    expect(owned(db, 'shield')).toBe(2);
    expect(db.select().from(hero).get()?.coins).toBe(100);
    expectHeroMatchesLog(db);
  });

  it('refuses an unknown item', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 300 });
    expect(() => buyItem(db, 'sword' as 'potion', NOW)).toThrow(RangeError);
  });
});

describe('usePotion', () => {
  it('gives back 10 hit points and uses one potion', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 100, hp: -25 });
    buyItem(db, 'potion', NOW);
    buyItem(db, 'potion', NOW);
    expect(usePotion(db, NOW)).toEqual({ hp: 35 });
    expect(owned(db, 'potion')).toBe(1);
    const used = db.select().from(events).where(eq(events.type, 'item.used')).get();
    expect(used).toMatchObject({ itemKey: 'potion', dHp: 10 });
    expectHeroMatchesLog(db);
  });

  it('never goes above 50 hit points, and records only what it gave', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 50, hp: -4 });
    buyItem(db, 'potion', NOW);
    expect(usePotion(db, NOW)).toEqual({ hp: 50 });
    expect(db.select().from(events).where(eq(events.type, 'item.used')).get()?.dHp).toBe(4);
    expectHeroMatchesLog(db);
  });

  it('refuses without a potion', () => {
    const db = newGame(['journal']);
    adjustHero(db, { hp: -20 });
    expect(() => usePotion(db, NOW)).toThrow(RangeError);
    expect(db.select().from(hero).get()?.hp).toBe(30);
  });
});
