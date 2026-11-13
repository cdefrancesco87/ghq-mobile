import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { openAppDatabase } from '../../db/client';
import type { Db } from '../../db/types';
import { handleReminderAction, type ReminderOutcome } from './reminders';
import { syncReminders } from './scheduler';
import { notificationPermission, setUpNotifications, systemScheduler } from './system';

// The entry of the actions of the notifications. On Android, with the app closed, the action
// reaches the task defined here (expo-task-manager); on iPhone, and with the app open, it reaches
// the listener of the response. Both end in `handleReminderAction`, which counts a completion
// once, so it does not matter if both fire. This module must be imported early (root layout):
// expo-task-manager loads the bundle in the background and needs the task to be defined.

export const REMINDER_TASK = 'ghq-reminder-actions';

let backgroundDb: Promise<Db> | null = null;

/** The database for the task: opened on the first action, as the app is not running. */
function databaseForTask(): Promise<Db> {
  backgroundDb ??= openAppDatabase().catch((error: unknown) => {
    backgroundDb = null;
    throw error;
  });
  return backgroundDb;
}

/** The phone offset from UTC, in minutes east. */
function tzOffsetAt(now: number): number {
  return -new Date(now).getTimezoneOffset();
}

/**
 * Aligns the notifications of the system with the reminders of the missions (`syncReminders`),
 * only with the permission granted. It never throws: a failure waits for the next call.
 */
export async function syncSystemReminders(db: Db, now = Date.now()): Promise<void> {
  try {
    if ((await notificationPermission()) !== 'granted') {
      return;
    }
    await syncReminders(db, systemScheduler, { now, tzOffset: tzOffsetAt(now) });
  } catch {
    // Nothing to show: the reminders are aligned again at the next start or action.
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
  return handleReminderAction(db, systemScheduler, {
    actionId: response.actionIdentifier,
    notificationId: response.notification.request.identifier,
    missionId,
    now,
    tzOffset: tzOffsetAt(now),
  });
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
      return outcome.outcome === 'failed'
        ? Notifications.BackgroundNotificationTaskResult.Failed
        : Notifications.BackgroundNotificationTaskResult.NewData;
    } catch {
      return Notifications.BackgroundNotificationTaskResult.Failed;
    }
  },
);

/** Registers the task and prepares channel and categories; call it when the app starts. */
export async function registerReminderTask(): Promise<void> {
  await setUpNotifications();
  await Notifications.registerTaskAsync(REMINDER_TASK);
}
