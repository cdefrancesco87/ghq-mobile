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

/** The notification of a reminder, as expo-notifications wants it. */
export function reminderRequestInput(
  request: ReminderRequest,
): Notifications.NotificationRequestInput {
  return {
    content: {
      title: request.title,
      body: 'Tocca Completa per segnarla fatta.',
      data: { missionId: request.missionId },
      categoryIdentifier:
        request.snoozeCount >= MAX_SNOOZES ? CATEGORY_REMINDER_LAST : CATEGORY_REMINDER,
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
  schedule: (request) => Notifications.scheduleNotificationAsync(reminderRequestInput(request)),
  cancel: async (osIds) => {
    for (const osId of osIds) {
      await Notifications.cancelScheduledNotificationAsync(osId);
      await Notifications.dismissNotificationAsync(osId);
    }
  },
};

/**
 * Prepares the channel (Android) and the categories with the Complete and Snooze actions, which
 * do not open the app.
 */
export async function setUpNotifications(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Promemoria',
    importance: AndroidImportance.HIGH,
  });
  const complete: Notifications.NotificationAction = {
    identifier: ACTION_COMPLETE,
    buttonTitle: COMPLETE_LABEL,
    options: { opensAppToForeground: false },
  };
  const snooze: Notifications.NotificationAction = {
    identifier: ACTION_SNOOZE,
    buttonTitle: SNOOZE_LABEL,
    options: { opensAppToForeground: false },
  };
  await Notifications.setNotificationCategoryAsync(CATEGORY_REMINDER, [complete, snooze]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_REMINDER_LAST, [complete]);
}

/** Asks for the permission to show notifications; true if it was granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  return (await Notifications.requestPermissionsAsync()).granted;
}
