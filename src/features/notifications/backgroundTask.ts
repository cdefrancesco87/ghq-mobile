import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { databaseForTask } from '../../db/backgroundDatabase';
import type { Db } from '../../db/types';
import { syncWidgets } from '../widgets/sync';
import { systemWidgetHost } from '../widgets/system';
import { syncEveningSummary } from './evening';
import { syncRecall } from './recall';
import { syncWeeklyRecap } from './weeklyRecap';
import { handleReminderAction, type ReminderOutcome } from './reminders';
import { syncReminders } from './scheduler';
import {
  notificationPermission,
  setUpNotifications,
  showConfirmation,
  systemRecall,
  systemScheduler,
  systemSummary,
  systemWeeklyRecap,
} from './system';
import { notificationTextsOf } from './texts';

// The entry of the actions of the notifications. On Android, with the app closed, the action
// reaches the task defined here (expo-task-manager); on iPhone, and with the app open, it reaches
// the listener of the response. Both end in `handleReminderAction`, which counts a completion
// once, so it does not matter if both fire. This module must be imported early (root layout):
// expo-task-manager loads the bundle in the background and needs the task to be defined.

export const REMINDER_TASK = 'ghq-reminder-actions';

/** The phone offset from UTC, in minutes east. */
function tzOffsetAt(now: number): number {
  return -new Date(now).getTimezoneOffset();
}

/**
 * Aligns the notifications of the system with the reminders of the missions (`syncReminders`),
 * the evening summary and the weekly recap, only with the permission granted. Channels and buttons are named
 * again first, so a new language reaches them. It never throws: a failure waits for the next
 * call.
 */
export async function syncSystemReminders(db: Db, now = Date.now()): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'granted') {
      return;
    }
    await setUpNotifications(notificationTextsOf(db));
    // The offset of each instant: the window of 7 days can cross a change of summer time.
    const input = { now, tzOffset: tzOffsetAt(now), tzOffsetAt };
    await syncReminders(db, systemScheduler, input);
    await syncEveningSummary(db, systemSummary, input);
    // The weekly recap of Statistics (design 8.7, 10.6; T81).
    await syncWeeklyRecap(db, systemWeeklyRecap, input);
  } catch {
    // Nothing to show: the reminders are aligned again at the next start or action.
  }
}

/**
 * Moves the check-in after 3 days (design 11.6) to 3 days from now, only with the permission
 * granted. Call it when the app opens or comes back to the front and after a change of the
 * settings, never from the background task: an action from a notification is not an opening.
 * It never throws.
 */
export async function syncSystemRecall(db: Db, now = Date.now()): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'granted') {
      return;
    }
    await syncRecall(db, systemRecall, { now, tzOffset: tzOffsetAt(now), tzOffsetAt });
  } catch {
    // The check-in is scheduled again at the next opening.
  }
}

/** The widgets show a completion made from a notification (design-sezioni.md 12.2). */
export async function syncSystemWidgets(db: Db): Promise<void> {
  try {
    const host = systemWidgetHost();
    if (host !== null) {
      await syncWidgets(db, host, () => {
        const now = Date.now();
        return { now, tzOffset: tzOffsetAt(now) };
      });
    }
  } catch {
    // The widgets are aligned again when the app opens.
  }
}

/** Runs the action of a notification response on the given database. */
export async function handleNotificationResponse(
  db: Db,
  response: Notifications.NotificationResponse,
  now = Date.now(),
): Promise<ReminderOutcome> {
  const missionId = response.notification.request.content.data?.missionId;
  if (typeof missionId !== 'string') {
    return { outcome: 'ignored' };
  }
  const outcome = await handleReminderAction(db, systemScheduler, {
    actionId: response.actionIdentifier,
    notificationId: response.notification.request.identifier,
    missionId,
    now,
    tzOffset: tzOffsetAt(now),
  });
  if (outcome.outcome === 'completed') {
    // «Fatto! +20 XP · +5 monete» (design 11.3); a failure leaves the completion as it is.
    await showConfirmation(notificationTextsOf(db).confirmation(outcome)).catch(() => undefined);
  }
  return outcome;
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  REMINDER_TASK,
  async ({ data, error }) => {
    if (error || !('actionIdentifier' in data)) {
      return Notifications.BackgroundNotificationTaskResult.NoData;
    }
    try {
      const db = await databaseForTask();
      const outcome = await handleNotificationResponse(db, data);
      // The app may not open for a while: the task moves the window of the reminders on.
      await syncSystemReminders(db);
      await syncSystemWidgets(db);
      return outcome.outcome === 'failed'
        ? Notifications.BackgroundNotificationTaskResult.Failed
        : Notifications.BackgroundNotificationTaskResult.NewData;
    } catch {
      return Notifications.BackgroundNotificationTaskResult.Failed;
    }
  },
);

/**
 * Prepares channels and categories (Android wants a channel before the permission is asked) and
 * registers the task of the actions; call it when the app starts.
 */
export async function registerReminderTask(db: Db): Promise<void> {
  await setUpNotifications(notificationTextsOf(db));
  await Notifications.registerTaskAsync(REMINDER_TASK);
}
