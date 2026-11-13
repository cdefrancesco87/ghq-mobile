import { RECALL } from './config';
import { diffDays, toGameDay } from './gameDay';
import { isPausedDay, type PauseInterval } from './pause';
import { quietHoursEnd, type QuietInterval } from './reminders';

// The single check-in after 3 days without opening the app (design-sezioni.md 11.6; backlog T80).
// It is scheduled again at every opening, so it fires only when the app stays closed.

const MS_PER_DAY = 86_400_000;

export interface RecallAtInput {
  /** The opening: UTC instant in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
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
  let fireAt = quietHoursEnd(now + RECALL.afterDays * MS_PER_DAY, tzOffset, quietHours);
  const day = toGameDay(fireAt, tzOffset, dayChange);
  if (pause !== null && isPausedDay(day, [pause])) {
    if (pause.untilDay === null) {
      return null;
    }
    fireAt += (diffDays(day, pause.untilDay) + 1) * MS_PER_DAY;
  }
  return fireAt;
}
