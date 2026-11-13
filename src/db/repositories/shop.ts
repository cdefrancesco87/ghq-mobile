import { eq, sql } from 'drizzle-orm';

import { ITEM_KEYS, SHOP_ITEMS, type ItemKey, type ShopItem } from '../../content/shop';
import type { CompanionStage } from '../../rules/companion';
import { SHOP } from '../../rules/config';
import { canUsePotion } from '../../rules/shop';
import { companion, inventory } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { changeHero, loadHero, type ActionClock } from './hero';

// The shop and the inventory (analisi-funzionale.md, section 7; xp-e-monete.md, section 2).
// The shield is used by the closing of the days, never by hand.

export function owned(tx: Db, itemKey: ItemKey): number {
  return tx.select().from(inventory).where(eq(inventory.itemKey, itemKey)).get()?.quantity ?? 0;
}

/** Adds (or, with a negative quantity, takes away) some of an item, inside a transaction. */
export function addToInventory(tx: Db, itemKey: ItemKey, quantity: number): void {
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

/** An item of the shop with how many the hero owns. */
export interface ShopViewItem extends Omit<ShopItem, 'group'> {
  readonly owned: number;
}

/** What the shop and the inventory show (design-sezioni.md 7.2–7.5). */
export interface ShopView {
  readonly coins: number;
  readonly hp: number;
  /** False at full hit points: «Usa» and «Usa subito» are off (choice 18). */
  readonly canUsePotion: boolean;
  /** The helps: potion and shield. */
  readonly items: readonly ShopViewItem[];
  /** The gifts for the companion (US-COMP-04, Could). */
  readonly gifts: readonly ShopViewItem[];
  /** For «Dona a Blob»: the stored name (null = default of the theme); the egg takes no gifts. */
  readonly companion: { readonly stage: CompanionStage; readonly name: string | null };
}

function viewItems(db: Db, group: ShopItem['group']): ShopViewItem[] {
  return SHOP_ITEMS.filter((item) => item.group === group).map(({ key, price, maxOwned }) => ({
    key,
    price,
    maxOwned,
    owned: owned(db, key),
  }));
}

export function getShopView(db: Db): ShopView {
  const { coins, hp } = loadHero(db);
  const pet = db.select().from(companion).get();
  return {
    coins,
    hp,
    canUsePotion: canUsePotion(hp),
    items: viewItems(db, 'helps'),
    gifts: viewItems(db, 'gifts'),
    companion: { stage: pet?.stage ?? 'egg', name: pet?.name ?? null },
  };
}

/** A refused shop action, with a code the screens can tell apart from the other refusals. */
export class ShopRefusal extends RangeError {
  override name = 'RangeError';

  constructor(
    readonly code: 'potion_full_hp',
    message: string,
  ) {
    super(message);
  }
}

function drinkPotion(tx: Db, clock: ActionClock): { hp: number } {
  if (owned(tx, 'potion') === 0) {
    throw new RangeError('There is no potion in the inventory');
  }
  if (!canUsePotion(loadHero(tx).hp)) {
    throw new ShopRefusal('potion_full_hp', 'The hero is already at full hit points');
  }
  addToInventory(tx, 'potion', -1);
  const change = changeHero(tx, { hp: SHOP.potion.hp }, clock.now);
  appendEvent(tx, { ...eventBase(clock, 'potion'), type: 'item.used', deltas: change.deltas });
  return { hp: loadHero(tx).hp };
}

/**
 * Buys an item with the coins: refused without enough coins or beyond 2 shields (US-NEG-01).
 * With `useNow` the potion is also drunk in the same transaction («Usa subito», design 7.4), so a
 * potion that cannot be used is not bought either. Returns the hit points after a `useNow`.
 */
export function buyItem(
  db: Db,
  itemKey: ItemKey,
  clock: ActionClock,
  options: { readonly useNow?: boolean } = {},
): { hp: number } | null {
  const item = SHOP_ITEMS.find((candidate) => candidate.key === itemKey);
  if (item === undefined || !ITEM_KEYS.includes(itemKey)) {
    throw new RangeError(`Unknown item: ${itemKey}`);
  }
  if (options.useNow === true && itemKey !== 'potion') {
    throw new RangeError(`Only the potion can be used at once: ${itemKey}`);
  }
  return db.transaction((tx) => {
    if (loadHero(tx).coins < item.price) {
      throw new RangeError(`Not enough coins for ${itemKey}: ${item.price} needed`);
    }
    if (item.maxOwned !== null && owned(tx, itemKey) >= item.maxOwned) {
      throw new RangeError(`At most ${item.maxOwned} of ${itemKey}`);
    }
    if (options.useNow === true && !canUsePotion(loadHero(tx).hp)) {
      throw new ShopRefusal('potion_full_hp', 'The hero is already at full hit points');
    }
    const change = changeHero(tx, { coins: -item.price }, clock.now);
    addToInventory(tx, itemKey, 1);
    appendEvent(tx, {
      ...eventBase(clock, itemKey),
      type: 'item.bought',
      deltas: change.deltas,
      payload: { price: item.price },
    });
    return options.useNow === true ? drinkPotion(tx, clock) : null;
  });
}

/** Uses a potion: +10 hit points, never above the maximum; refused at full HP (choice 18). */
export function usePotion(db: Db, clock: ActionClock): { hp: number } {
  return db.transaction((tx) => drinkPotion(tx, clock));
}
