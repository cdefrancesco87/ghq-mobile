import { MISSION_ORDER } from './config';

/**
 * The `sort_order` of a row placed between two neighbours (design-sezioni.md 3.4): halfway between
 * them, one step before the first or after the last, or null when there is no room left and the
 * list must be numbered again.
 */
export function orderBetween(prev: number | null, next: number | null): number | null {
  if (prev !== null && next !== null) {
    if (prev > next) {
      throw new RangeError(`orderBetween: ${prev} comes after ${next}`);
    }
    return next - prev < MISSION_ORDER.minGap ? null : (prev + next) / 2;
  }
  if (prev !== null) {
    return prev + MISSION_ORDER.step;
  }
  if (next !== null) {
    return next - MISSION_ORDER.step;
  }
  return MISSION_ORDER.step;
}
