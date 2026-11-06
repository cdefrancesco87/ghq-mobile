/**
 * Keeps a value inside the closed range [min, max].
 * The game rules use it for bounded values such as hit points or levels.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`clamp: min (${min}) is greater than max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}
