import { RECALL } from './config';
import { diffDays, toGameDay } from './gameDay';
import { isPausedDay, type PauseInterval } from './pause';
import { quietHoursEnd, type QuietInterval } from './reminders';
import { localMinuteOf, offsetAt, utcOfLocalMinute, type TzOffset } from './timeZone';

// The single check-in after 3 days without opening the app (design-sezioni.md 11.6; backlog T80).
// It is scheduled again at every opening, so it fires only when the app stays closed.

const MINUTES_PER_DAY = 24 * 60;

export interface RecallAtInput {
  /** The opening: UTC instant in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC, or the offset of each instant (summer time). */
  readonly tzOffset: TzOffset;
  /** The day change valid on the day of the check-in (HH:MM). */
  readonly dayChange: string;
  readonly quietHours: readonly QuietInterval[];
  /** The general pause in progress or scheduled (CLAUDE.md, choice 23), or null. */
  readonly pause: PauseInterval | null;
}

/**
 * UTC instant of the check-in: `RECALL.afterDays` days after the opening, after the end of «Non
 * disturbare». A game day of general pause sends no notification (choice 23): the check-in moves
 * to the same time of the first day after the pause, and none is scheduled while a pause without
 * an end holds its day.
 */
export function recallAt({
  now,
  tzOffset,
  dayChange,
  quietHours,
  pause,
}: RecallAtInput): number | null {
  // The same local time `RECALL.afterDays` days on, even across a change of summer time.
  const later = (instant: number, days: number) =>
    utcOfLocalMinute(localMinuteOf(instant, tzOffset) + days * MINUTES_PER_DAY, tzOffset);
  const fireAt = quietHoursEnd(later(now, RECALL.afterDays), tzOffset, quietHours);
  const day = toGameDay(fireAt, offsetAt(tzOffset, fireAt), dayChange);
  if (pause !== null && isPausedDay(day, [pause])) {
    if (pause.untilDay === null) {
      return null;
    }
    return later(fireAt, diffDays(day, pause.untilDay) + 1);
  }
  return fireAt;
}
