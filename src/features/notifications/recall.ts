import { getGeneralPause } from '../../db/repositories/pause';
import { dayChangeOn, gameDayOf, getSetting } from '../../db/repositories/settings';
import type { Db } from '../../db/types';
import { RECALL } from '../../rules/config';
import { addDays } from '../../rules/gameDay';
import { recallAt } from '../../rules/recall';
import { afterReminderSyncs } from './scheduler';
import { notificationTextsOf, type NotificationText } from './texts';

// The single check-in after 3 days without opening the app (design-sezioni.md 11.6; backlog T80):
// «Cloudy ti aspetta. Bastano due minuti per ripartire». It is scheduled again at every opening
// of the app, always with the same identifier, so only one is ever waiting and none follows it
// until the app is opened again. Like `evening.ts` it depends on no Expo module.

/** The identifier of the check-in in the system: one at a time. */
export const RECALL_ID = 'recall';

export interface RecallRequest extends NotificationText {
  readonly id: string;
  /** UTC instant in milliseconds. */
  readonly fireAt: number;
}

/** The notifications of the system, as the check-in needs them. */
export interface RecallScheduler {
  /** Schedules the notification with the identifier of the request, replacing one with it. */
  schedule(request: RecallRequest): Promise<void>;
  /** Cancels the scheduled check-in. */
  cancel(id: string): Promise<void>;
}

export interface RecallInput {
  /** The opening: UTC instant in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
  /**
   * The offset of each UTC instant, for the times past a change of summer time; `tzOffset` for
   * every instant when missing.
   */
  readonly tzOffsetAt?: (instant: number) => number;
}

/** The check-in wanted after an opening at `now`, or null: switched off, or held by a pause. */
export function plannedRecall(
  db: Db,
  { now, tzOffset, tzOffsetAt }: RecallInput,
): RecallRequest | null {
  if (!getSetting(db, 'recall_enabled')) {
    return null;
  }
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(now, tzOffset, dayChange);
  const fireAt = recallAt({
    now,
    tzOffset: tzOffsetAt ?? tzOffset,
    dayChange: dayChangeOn(dayChange, addDays(today, RECALL.afterDays)),
    quietHours: getSetting(db, 'quiet_hours'),
    pause: getGeneralPause(db),
  });
  if (fireAt === null) {
    return null;
  }
  return { id: RECALL_ID, fireAt, ...notificationTextsOf(db).recall };
}

/**
 * Moves the check-in to 3 days after this opening, or cancels it when it is not wanted. Call it
 * when the app opens or comes back to the front, and after a change of the settings.
 */
export function syncRecall(
  db: Db,
  scheduler: RecallScheduler,
  input: RecallInput,
): Promise<RecallRequest | null> {
  return afterReminderSyncs(async () => {
    const request = plannedRecall(db, input);
    if (request === null) {
      await scheduler.cancel(RECALL_ID);
    } else {
      await scheduler.schedule(request);
    }
    return request;
  });
}
