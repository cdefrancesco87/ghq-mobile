import { eq } from 'drizzle-orm';

import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem, getShopView, usePotion } from '@/db/repositories/shop';
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

  it('refuses at full hit points (choice 18)', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 50 }); // hp stays at 50 (max)
    buyItem(db, 'potion', NOW);
    const before = db.select().from(hero).get();
    const count = db.select().from(events).all().length;
    expect(() => usePotion(db, NOW)).toThrow(
      expect.objectContaining({ name: 'RangeError', code: 'potion_full_hp' }),
    );
    expect(db.select().from(hero).get()).toEqual(before);
    expect(db.select().from(events).all()).toHaveLength(count);
    expect(owned(db, 'potion')).toBe(1); // potion not consumed
    expectHeroMatchesLog(db);
  });

  it('heals up to the maximum from 3 below it, for the 50 coins of the potion', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 50, hp: -3 });
    buyItem(db, 'potion', NOW);
    expect(usePotion(db, NOW)).toEqual({ hp: 50 });
    expect(db.select().from(hero).get()).toMatchObject({ hp: 50, coins: 0 });
    expect(owned(db, 'potion')).toBe(0);
    expectHeroMatchesLog(db);
  });
});

describe('buyItem with «Usa subito»', () => {
  it('buys and drinks the potion in one action, with both events', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 60, hp: -20 });
    expect(buyItem(db, 'potion', NOW, { useNow: true })).toEqual({ hp: 40 });
    expect(db.select().from(hero).get()).toMatchObject({ hp: 40, coins: 10 });
    expect(owned(db, 'potion')).toBe(0);
    const types = db
      .select()
      .from(events)
      .all()
      .map((event) => event.type);
    expect(types.slice(-2)).toEqual(['item.bought', 'item.used']);
    expectHeroMatchesLog(db);
  });

  it('buys nothing at full hit points', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 60 });
    expect(() => buyItem(db, 'potion', NOW, { useNow: true })).toThrow(
      expect.objectContaining({ code: 'potion_full_hp' }),
    );
    expect(db.select().from(hero).get()?.coins).toBe(60);
    expect(owned(db, 'potion')).toBe(0);
    expectHeroMatchesLog(db);
  });

  it('is only for the potion', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 300, hp: -20 });
    expect(() => buyItem(db, 'shield', NOW, { useNow: true })).toThrow(RangeError);
    expect(owned(db, 'shield')).toBe(0);
  });
});

describe('getShopView', () => {
  it('reads the balance, the hit points and every item with the number owned', () => {
    const db = newGame(['journal']);
    adjustHero(db, { coins: 245, hp: -12 });
    buyItem(db, 'shield', NOW);
    expect(getShopView(db)).toEqual({
      coins: 145,
      hp: 38,
      canUsePotion: true,
      items: [
        { key: 'potion', price: 50, maxOwned: null, owned: 0 },
        { key: 'shield', price: 100, maxOwned: 2, owned: 1 },
      ],
    });
  });

  it('says when a potion cannot be used, at full hit points', () => {
    const db = newGame(['journal']);
    expect(getShopView(db)).toMatchObject({ hp: 50, canUsePotion: false });
  });
});
