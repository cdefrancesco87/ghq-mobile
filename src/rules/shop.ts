import { HP } from './config';

// The items of the shop (analisi-funzionale.md, section 7; CLAUDE.md, choice 18).

/** A potion can be used only below the maximum hit points; the screen disables it otherwise. */
export function canUsePotion(hp: number): boolean {
  if (!Number.isInteger(hp) || hp < 0 || hp > HP.max) {
    throw new RangeError(`Hit points must be an integer from 0 to ${HP.max}: ${hp}`);
  }
  return hp < HP.max;
}

/** What the shop says about an item: buyable, short of coins, or owned at its maximum (7.3). */
export interface ShopOffer {
  readonly state: 'buyable' | 'missing' | 'max';
  /** Coins still needed, 0 unless `missing`. */
  readonly missing: number;
  /** The balance after the purchase, only when it can be bought. */
  readonly balanceAfter: number | null;
}

export function shopOffer(
  item: { readonly price: number; readonly maxOwned: number | null },
  coins: number,
  owned: number,
): ShopOffer {
  if (!Number.isInteger(coins) || coins < 0 || !Number.isInteger(owned) || owned < 0) {
    throw new RangeError(`Coins and owned items must be integers from 0: ${coins}, ${owned}`);
  }
  if (item.maxOwned !== null && owned >= item.maxOwned) {
    return { state: 'max', missing: 0, balanceAfter: null };
  }
  if (coins < item.price) {
    return { state: 'missing', missing: item.price - coins, balanceAfter: null };
  }
  return { state: 'buyable', missing: 0, balanceAfter: coins - item.price };
}
