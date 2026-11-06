import { eq, sql } from 'drizzle-orm';

import { ITEM_KEYS, SHOP_ITEMS, type ItemKey } from '../../content/shop';
import { SHOP } from '../../rules/config';
import { inventory } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { changeHero, loadHero, type ActionClock } from './hero';

// The shop and the inventory (analisi-funzionale.md, section 7; xp-e-monete.md, section 2).
// The shield is used by the closing of the days, never by hand.

function owned(tx: Db, itemKey: ItemKey): number {
  return tx.select().from(inventory).where(eq(inventory.itemKey, itemKey)).get()?.quantity ?? 0;
}

function addToInventory(tx: Db, itemKey: ItemKey, quantity: number): void {
  tx.insert(inventory)
    .values({ itemKey, quantity })
    .onConflictDoUpdate({
      target: inventory.itemKey,
      set: { quantity: sql`${inventory.quantity} + ${quantity}` },
    })
    .run();
}

function eventBase(clock: ActionClock, itemKey: ItemKey) {
  return {
    occurredAt: clock.now,
    tzOffset: clock.tzOffset,
    source: clock.source ?? 'app',
    itemKey,
  } as const;
}

/** Buys an item with the coins: refused without enough coins or beyond 2 shields (US-NEG-01). */
export function buyItem(db: Db, itemKey: ItemKey, clock: ActionClock): void {
  const item = SHOP_ITEMS.find((candidate) => candidate.key === itemKey);
  if (item === undefined || !ITEM_KEYS.includes(itemKey)) {
    throw new RangeError(`Unknown item: ${itemKey}`);
  }
  db.transaction((tx) => {
    if (loadHero(tx).coins < item.price) {
      throw new RangeError(`Not enough coins for ${itemKey}: ${item.price} needed`);
    }
    if (item.maxOwned !== null && owned(tx, itemKey) >= item.maxOwned) {
      throw new RangeError(`At most ${item.maxOwned} of ${itemKey}`);
    }
    const change = changeHero(tx, { coins: -item.price }, clock.now);
    addToInventory(tx, itemKey, 1);
    appendEvent(tx, {
      ...eventBase(clock, itemKey),
      type: 'item.bought',
      deltas: change.deltas,
      payload: { price: item.price },
    });
  });
}

/** Uses a potion: +10 hit points, never above the maximum (US-NEG-02). */
export function usePotion(db: Db, clock: ActionClock): { hp: number } {
  return db.transaction((tx) => {
    if (owned(tx, 'potion') === 0) {
      throw new RangeError('There is no potion in the inventory');
    }
    addToInventory(tx, 'potion', -1);
    const change = changeHero(tx, { hp: SHOP.potion.hp }, clock.now);
    appendEvent(tx, { ...eventBase(clock, 'potion'), type: 'item.used', deltas: change.deltas });
    return { hp: loadHero(tx).hp };
  });
}
