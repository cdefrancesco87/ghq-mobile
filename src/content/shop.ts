import { GIFTS, SHOP } from '../rules/config';

// The items of the shop (design-sezioni.md, section 7). Prices and effects live in
// src/rules/config.ts; names and descriptions are in the language files. Personal rewards are
// created by the user (`rewards` table).

/** Keys of the gifts for the companion (US-COMP-04, design-sezioni.md 6.8; Could, task T86). */
export const GIFT_KEYS = ['cookie', 'candy', 'ball'] as const;
export type GiftKey = (typeof GIFT_KEYS)[number];

/** Keys of the items, as stored in `inventory.item_key` (the schema limits `shield` to 2). */
export const ITEM_KEYS = ['potion', 'shield', ...GIFT_KEYS] as const;
export type ItemKey = (typeof ITEM_KEYS)[number];

export function isGiftKey(key: string): key is GiftKey {
  return (GIFT_KEYS as readonly string[]).includes(key);
}

export interface ShopItem {
  readonly key: ItemKey;
  /** Group of the shop: «Aiuti» or «Regali per il compagno». */
  readonly group: 'helps' | 'gifts';
  readonly price: number;
  /** Highest number owned, if limited. */
  readonly maxOwned: number | null;
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  { key: 'potion', group: 'helps', price: SHOP.potion.price, maxOwned: null },
  { key: 'shield', group: 'helps', price: SHOP.shield.price, maxOwned: SHOP.shield.maxOwned },
  ...GIFT_KEYS.map((key) => ({
    key,
    group: 'gifts' as const,
    price: GIFTS.prices[key],
    maxOwned: null,
  })),
];
