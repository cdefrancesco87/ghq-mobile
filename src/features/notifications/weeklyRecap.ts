import { getGeneralPause } from '../../db/repositories/pause';
import { dayChangeOn, gameDayOf, getSetting } from '../../db/repositories/settings';
import type { Db } from '../../db/types';
import { addDays } from '../../rules/gameDay';
import { nextRecapAt } from '../../rules/weeklyRecap';
import { afterReminderSyncs } from './scheduler';
import { notificationTextsOf, type NotificationText } from './texts';

// The notification of the weekly recap (design-sezioni.md 8.7, 10.6; backlog T81): on the day and
// at the time of the Settings, Sunday at 19:00 by default; a touch opens the card in Statistics.
// Only the next one is scheduled, always with the same identifier, again at the start and after
// every action. Like `recall.ts` it depends on no Expo module.

/** The identifier of the recap notification in the system: one at a time. */
export const WEEKLY_RECAP_ID = 'weekly-recap';

export interface WeeklyRecapRequest extends NotificationText {
  readonly id: string;
  /** UTC instant in milliseconds. */
  readonly fireAt: number;
}

/** The notifications of the system, as the recap needs them. */
export interface WeeklyRecapScheduler {
  /** Schedules the notification with the identifier of the request, replacing one with it. */
  schedule(request: WeeklyRecapRequest): Promise<void>;
  /** Cancels the scheduled recap. */
  cancel(id: string): Promise<void>;
}

export interface WeeklyRecapInput {
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

/** The next recap notification, or null: switched off, or held by a pause without an end. */
export function plannedWeeklyRecap(
  db: Db,
  { now, tzOffset }: WeeklyRecapInput,
): WeeklyRecapRequest | null {
  const setting = getSetting(db, 'weekly_recap');
  if (!setting.enabled) {
    return null;
  }
  const dayChange = getSetting(db, 'day_change');
  const fireAt = nextRecapAt({
    now,
    today: gameDayOf(now, tzOffset, dayChange),
    tzOffset,
    dayChange: (day) => dayChangeOn(dayChange, addDays(day, -1)),
    weekday: setting.weekday,
    time: setting.time,
    quietHours: getSetting(db, 'quiet_hours'),
    pause: getGeneralPause(db),
  });
  if (fireAt === null) {
    return null;
  }
  return { id: WEEKLY_RECAP_ID, fireAt, ...notificationTextsOf(db).weeklyRecap };
}

/** Schedules the next recap notification, or cancels it when it is not wanted. */
export function syncWeeklyRecap(
  db: Db,
  scheduler: WeeklyRecapScheduler,
  input: WeeklyRecapInput,
): Promise<WeeklyRecapRequest | null> {
  return afterReminderSyncs(async () => {
    const request = plannedWeeklyRecap(db, input);
    if (request === null) {
      await scheduler.cancel(WEEKLY_RECAP_ID);
    } else {
      await scheduler.schedule(request);
    }
    return request;
  });
}
