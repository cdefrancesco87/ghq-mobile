// The offset of the phone from UTC. Over a window of days it can change (summer time), so the
// rules that turn a local time into a UTC instant take the offset of each instant, as a function
// injected by the caller (no clock is read here); a single number keeps one offset for all.

const MS_PER_MINUTE = 60_000;

/** Minutes east of UTC: one value for every instant, or the value valid at a UTC instant (ms). */
export type TzOffset = number | ((instant: number) => number);

/** Minutes east of UTC at a UTC instant in milliseconds. */
export function offsetAt(tzOffset: TzOffset, instant: number): number {
  return typeof tzOffset === 'number' ? tzOffset : tzOffset(instant);
}

/** The local minute (minutes since 1970-01-01 00:00 local) of a UTC instant in milliseconds. */
export function localMinuteOf(instant: number, tzOffset: TzOffset): number {
  return Math.floor(instant / MS_PER_MINUTE) + offsetAt(tzOffset, instant);
}

/**
 * The UTC instant, in milliseconds, of a local minute (minutes since 1970-01-01 00:00 local).
 * With an offset that changes, the offset is read at a first guess of the instant and then at
 * the instant it gives; a local time skipped by the change keeps the offset before it.
 */
export function utcOfLocalMinute(local: number, tzOffset: TzOffset): number {
  if (typeof tzOffset === 'number') {
    return (local - tzOffset) * MS_PER_MINUTE;
  }
  const guess = (local - tzOffset(local * MS_PER_MINUTE)) * MS_PER_MINUTE;
  return (local - tzOffset(guess)) * MS_PER_MINUTE;
}
