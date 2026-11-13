import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import {
  ACTION_COMPLETE,
  ACTION_SNOOZE,
  MAX_SNOOZES,
  type ReminderRequest,
  type ReminderScheduler,
} from './reminders';

// The notifications of the operating system for the reminders (prototype of T32). The logic of
// the actions is in `reminders.ts`; this file only talks to expo-notifications.

export const REMINDER_CHANNEL = 'reminders';
export const CATEGORY_REMINDER = 'reminder';
/** After the last snooze the notification has the Complete button only. */
export const CATEGORY_REMINDER_LAST = 'reminder_last';

// Prototype text: the translated labels come with the real reminders. Content to review.
const COMPLETE_LABEL = 'Completa';
const SNOOZE_LABEL = 'Posticipa';

/**
 * The category of a reminder. A measurable mission has its own, whose Complete button is the
 * increment, e.g. «+250 ml» (design-sezioni.md 11.3): the buttons belong to the category.
 */
export function reminderCategory(request: ReminderRequest): string {
  const base = request.snoozeCount >= MAX_SNOOZES ? CATEGORY_REMINDER_LAST : CATEGORY_REMINDER;
  return request.completeLabel === null ? base : `${base}:${request.completeLabel}`;
}

/** The notification of a reminder, as expo-notifications wants it. */
export function reminderRequestInput(
  request: ReminderRequest,
): Notifications.NotificationRequestInput {
  return {
    content: {
      title: request.title,
      body: 'Tocca Completa per segnarla fatta.',
      data: { missionId: request.missionId },
      categoryIdentifier: reminderCategory(request),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: request.fireAt,
      channelId: REMINDER_CHANNEL,
    },
  };
}

/** `ReminderScheduler` on top of expo-notifications. */
export const systemScheduler: ReminderScheduler = {
  schedule: async (request) => {
    await ensureCategory(request);
    return Notifications.scheduleNotificationAsync(reminderRequestInput(request));
  },
  cancel: async (osIds) => {
    for (const osId of osIds) {
      await Notifications.cancelScheduledNotificationAsync(osId);
      await Notifications.dismissNotificationAsync(osId);
    }
  },
};

/** Cancels every scheduled notification of the app and clears those shown («Elimina tutti i dati»). */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

/**
 * Prepares the channel (Android) and the categories with the Complete and Snooze actions, which
 * do not open the app.
 */
export async function setUpNotifications(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Promemoria',
    importance: AndroidImportance.HIGH,
  });
  await Notifications.setNotificationCategoryAsync(
    CATEGORY_REMINDER,
    actions(COMPLETE_LABEL, true),
  );
  await Notifications.setNotificationCategoryAsync(
    CATEGORY_REMINDER_LAST,
    actions(COMPLETE_LABEL, false),
  );
}

function actions(completeLabel: string, withSnooze: boolean): Notifications.NotificationAction[] {
  const complete: Notifications.NotificationAction = {
    identifier: ACTION_COMPLETE,
    buttonTitle: completeLabel,
    options: { opensAppToForeground: false },
  };
  const snooze: Notifications.NotificationAction = {
    identifier: ACTION_SNOOZE,
    buttonTitle: SNOOZE_LABEL,
    options: { opensAppToForeground: false },
  };
  return withSnooze ? [complete, snooze] : [complete];
}

// The categories of the increments already set up while the app runs.
const incrementCategories = new Set<string>();

/** Sets up the category of a measurable mission the first time one of its reminders is scheduled. */
async function ensureCategory(request: ReminderRequest): Promise<void> {
  const category = reminderCategory(request);
  if (request.completeLabel === null || incrementCategories.has(category)) {
    return;
  }
  await Notifications.setNotificationCategoryAsync(
    category,
    actions(request.completeLabel, request.snoozeCount < MAX_SNOOZES),
  );
  incrementCategories.add(category);
}

/** `undetermined`: never asked yet, so the app can still ask (design-sezioni.md 4.8). */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** The permission to show notifications, without asking for it. */
export async function notificationPermission(): Promise<NotificationPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return 'granted';
  }
  return current.status === 'denied' ? 'denied' : 'undetermined';
}

/** Asks for the permission to show notifications; true if it was granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}
