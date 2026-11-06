import { SHOP } from '../rules/config';

// The items of the shop (design-sezioni.md, section 7). Prices and effects live in
// src/rules/config.ts; names and descriptions are in the language files. Gifts for the companion
// and personal rewards (Could) come in a later version.

/** Keys of the items, as stored in `inventory.item_key` (the schema limits `shield` to 2). */
export const ITEM_KEYS = ['potion', 'shield'] as const;
export type ItemKey = (typeof ITEM_KEYS)[number];

export interface ShopItem {
  readonly key: ItemKey;
  /** Group of the shop: «Aiuti». */
  readonly group: 'helps';
  readonly price: number;
  /** Highest number owned, if limited. */
  readonly maxOwned: number | null;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { key: 'potion', group: 'helps', price: SHOP.potion.price, maxOwned: null },
  { key: 'shield', group: 'helps', price: SHOP.shield.price, maxOwned: SHOP.shield.maxOwned },
];
