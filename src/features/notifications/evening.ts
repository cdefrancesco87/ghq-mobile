import { recordSummary } from '../../db/repositories/appNotifications';
import { dayChangeOn, gameDayOf, getSetting } from '../../db/repositories/settings';
import { getTodayView } from '../../db/repositories/todayView';
import type { Db } from '../../db/types';
import { addDays } from '../../rules/gameDay';
import { eveningSummary, eveningSummaryAt } from '../../rules/notifications';
import { afterReminderSyncs } from './scheduler';
import { notificationTextsOf, type NotificationText } from './texts';

// The evening summary (design-sezioni.md 11.5): at the time of the Settings, the missions of today
// still to do (at most 3 by name, then «e altre 2») or a compliment when all are done. Only the
// summary of today is scheduled, with what is known now: it is scheduled again after every
// action (a completion too) and at the start, so it is right when it fires. Like `scheduler.ts`
// it depends on no Expo module: the system sits behind `SummaryScheduler`.

/** The identifier of the summary of a game day in the system. */
export const EVENING_SUMMARY_PREFIX = 'evening-summary:';

export interface SummaryRequest extends NotificationText {
  readonly id: string;
  /** UTC instant in milliseconds. */
  readonly fireAt: number;
}

/** The notifications of the system, as the summary needs them. */
export interface SummaryScheduler {
  /** Schedules the notification with the identifier of the request, replacing one with it. */
  schedule(request: SummaryRequest): Promise<void>;
  /** Cancels a scheduled summary; one already shown stays. */
  cancel(id: string): Promise<void>;
}

export interface SummaryInput {
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

/** The summary of today still to fire, or null: switched off, already fired, nothing expected. */
export function plannedEveningSummary(
  db: Db,
  { now, tzOffset }: SummaryInput,
): SummaryRequest | null {
  const setting = getSetting(db, 'evening_summary');
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(now, tzOffset, dayChange);
  const fireAt = eveningSummaryAt({
    day: today,
    time: setting.time,
    dayChange: dayChangeOn(dayChange, addDays(today, -1)),
    tzOffset,
  });
  if (!setting.enabled || fireAt <= now) {
    return null;
  }
  const view = getTodayView(db, { now, tzOffset });
  const summary = eveningSummary(
    view.missions
      .filter((item) => item.state !== 'skipped')
      .map((item) => ({ name: item.mission.name, done: item.state === 'done' })),
  );
  if (summary === null) {
    return null;
  }
  return {
    id: `${EVENING_SUMMARY_PREFIX}${today}`,
    fireAt,
    ...notificationTextsOf(db).evening(summary),
  };
}

/**
 * Aligns the evening summary of today with the missions and the Settings: it is scheduled again
 * with the texts of now, or cancelled when it is not wanted any more. One already shown is left.
 */
export function syncEveningSummary(
  db: Db,
  scheduler: SummaryScheduler,
  input: SummaryInput,
): Promise<SummaryRequest | null> {
  return afterReminderSyncs(async () => {
    const dayChange = getSetting(db, 'day_change');
    const day = gameDayOf(input.now, input.tzOffset, dayChange);
    const id = `${EVENING_SUMMARY_PREFIX}${day}`;
    const request = plannedEveningSummary(db, input);
    if (request === null) {
      await scheduler.cancel(id);
    } else {
      await scheduler.schedule(request);
    }
    // The recent notifications get the summary for its time, or lose one no longer scheduled.
    recordSummary(
      db,
      {
        day,
        fireAt: request?.fireAt ?? Number.POSITIVE_INFINITY,
        text: request === null ? null : { title: request.title, body: request.body },
      },
      input.now,
    );
    return request;
  });
}
