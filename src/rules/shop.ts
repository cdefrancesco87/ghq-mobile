import { HP } from './config';

// The items of the shop (analisi-funzionale.md, section 7; CLAUDE.md, choice 18).

/** A potion can be used only below the maximum hit points; the screen disables it otherwise. */
export function canUsePotion(hp: number): boolean {
  if (!Number.isInteger(hp) || hp < 0 || hp > HP.max) {
    throw new RangeError(`Hit points must be an integer from 0 to ${HP.max}: ${hp}`);
  }
  return hp < HP.max;
}
