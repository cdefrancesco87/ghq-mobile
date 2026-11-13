import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { NOTIFICATIONS } from '../../rules/config';
import { BOSS_WARNING_PREFIX, type BossWarningScheduler } from './bossWarnings';
import type { SummaryScheduler } from './evening';
import {
  ACTION_COMPLETE,
  ACTION_SNOOZE,
  MAX_SNOOZES,
  groupOf,
  type ReminderGroupRequest,
  type ReminderRequest,
  type ReminderScheduler,
} from './reminders';
import type { Channel, NotificationText, NotificationTexts } from './texts';

// The notifications of the operating system: reminders, groups, evening summary, boss warnings
// and the confirmation after Complete. The logic is in the other files of this folder; this one
// only talks to expo-notifications.

export const REMINDER_CHANNEL = 'reminders';
/** Android channel of the evening summary (design-sezioni.md 11.1). */
export const SUMMARY_CHANNEL = 'summaries';
/** Android channel of the deadline warnings of the bosses (design-sezioni.md 11.1). */
export const BOSS_CHANNEL = 'boss';
/** Android channel of the check-in after 3 days (design 11.6, T80): created now with the others. */
export const RECALL_CHANNEL = 'recall';
/** A quiet channel for the confirmation after Complete: no sound right after a tap. */
export const CONFIRMATION_CHANNEL = 'confirmations';
export const CATEGORY_REMINDER = 'reminder';
/** After the last snooze the notification has the Complete button only. */
export const CATEGORY_REMINDER_LAST = 'reminder_last';

/** What a touch on a notification of this app opens: `kind` in its data. */
export type NotificationKind = 'reminder' | 'group' | 'summary';

// The labels of the buttons, in the language of the last set-up of the categories.
let labels = { complete: 'Complete', snooze: 'In 10 min' };
// The categories of the increments already set up while the app runs.
const incrementCategories = new Set<string>();

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
      body: request.body,
      data: { missionId: request.missionId, kind: 'reminder' },
      categoryIdentifier: reminderCategory(request),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: request.fireAt,
      channelId: REMINDER_CHANNEL,
    },
  };
}

/** The notification of a group of reminders: no buttons, a touch opens Today. */
export function groupRequestInput(
  request: ReminderGroupRequest,
): Notifications.NotificationRequestInput {
  return {
    content: {
      title: request.title,
      body: request.body,
      data: { missionIds: [...request.missionIds], kind: 'group' },
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
  scheduleGroup: (request) => Notifications.scheduleNotificationAsync(groupRequestInput(request)),
  cancel: async (osIds) => {
    const groups = new Set<string>();
    for (const osId of osIds) {
      const group = groupOf(osId);
      if (group === null) {
        await Notifications.cancelScheduledNotificationAsync(osId);
        await Notifications.dismissNotificationAsync(osId);
      } else if (!groups.has(group.groupId)) {
        // A group already shown stays: it still names the other missions.
        groups.add(group.groupId);
        await Notifications.cancelScheduledNotificationAsync(group.groupId);
      }
    }
  },
};

/** `SummaryScheduler` on top of expo-notifications: the summary keeps its own identifier. */
export const systemSummary: SummaryScheduler = {
  schedule: async (request) => {
    await Notifications.scheduleNotificationAsync({
      identifier: request.id,
      content: { title: request.title, body: request.body, data: { kind: 'summary' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.fireAt,
        channelId: SUMMARY_CHANNEL,
      },
    });
  },
  cancel: (id) => Notifications.cancelScheduledNotificationAsync(id),
};

/**
 * The short confirmation after Complete, «Fatto! +20 XP · +5 monete» (design 11.3): shown at
 * once and taken away after a few seconds, if the app is still running then.
 */
export async function showConfirmation(text: NotificationText): Promise<void> {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: text.title, body: text.body === '' ? null : text.body },
    trigger: { channelId: CONFIRMATION_CHANNEL },
  });
  setTimeout(() => {
    void Notifications.dismissNotificationAsync(id).catch(() => undefined);
  }, NOTIFICATIONS.confirmationMs);
}

/** `BossWarningScheduler` on top of expo-notifications: the warning keeps its own identifier. */
export const systemBossWarnings: BossWarningScheduler = {
  scheduled: async () =>
    (await Notifications.getAllScheduledNotificationsAsync())
      .filter((request) => request.identifier.startsWith(BOSS_WARNING_PREFIX))
      .map((request) => ({
        id: request.identifier,
        title: request.content.title ?? '',
        body: request.content.body ?? '',
      })),
  schedule: async (request) => {
    await Notifications.scheduleNotificationAsync({
      identifier: request.id,
      content: { title: request.title, body: request.body, data: { bossId: request.bossId } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.fireAt,
        channelId: BOSS_CHANNEL,
      },
    });
  },
  cancel: async (ids) => {
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
  },
};

/** Cancels every scheduled notification of the app and clears those shown («Elimina tutti i dati»). */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

const IMPORTANCE: Readonly<Record<Channel, AndroidImportance>> = {
  reminders: AndroidImportance.HIGH,
  summaries: AndroidImportance.DEFAULT,
  boss: AndroidImportance.DEFAULT,
  recall: AndroidImportance.DEFAULT,
  confirmations: AndroidImportance.LOW,
};

/**
 * Prepares the channels of Android (design 11.1: Promemoria, Riepiloghi, Boss, Richiamo), named in
 * the language of the app, and the categories with the Complete and Snooze actions, which do not
 * open the app. Called at every start, so a new language renames them.
 */
export async function setUpNotifications(texts: NotificationTexts): Promise<void> {
  for (const [channel, importance] of Object.entries(IMPORTANCE) as [
    Channel,
    AndroidImportance,
  ][]) {
    await Notifications.setNotificationChannelAsync(channel, {
      name: texts.channels[channel],
      importance,
    });
  }
  if (labels.complete !== texts.completeLabel || labels.snooze !== texts.snoozeLabel) {
    // The categories of the increments are set up again with the new labels.
    incrementCategories.clear();
  }
  labels = { complete: texts.completeLabel, snooze: texts.snoozeLabel };
  await Notifications.setNotificationCategoryAsync(
    CATEGORY_REMINDER,
    actions(labels.complete, true),
  );
  await Notifications.setNotificationCategoryAsync(
    CATEGORY_REMINDER_LAST,
    actions(labels.complete, false),
  );
}

function actions(
  completeLabel: string,
  withSnooze: boolean,
  snoozeLabel: string = labels.snooze,
): Notifications.NotificationAction[] {
  const complete: Notifications.NotificationAction = {
    identifier: ACTION_COMPLETE,
    buttonTitle: completeLabel,
    options: { opensAppToForeground: false },
  };
  const snooze: Notifications.NotificationAction = {
    identifier: ACTION_SNOOZE,
    buttonTitle: snoozeLabel,
    options: { opensAppToForeground: false },
  };
  return withSnooze ? [complete, snooze] : [complete];
}

/** Sets up the category of a measurable mission the first time one of its reminders is scheduled. */
async function ensureCategory(request: ReminderRequest): Promise<void> {
  const category = reminderCategory(request);
  if (request.completeLabel === null || incrementCategories.has(category)) {
    return;
  }
  await Notifications.setNotificationCategoryAsync(
    category,
    actions(request.completeLabel, request.snoozeCount < MAX_SNOOZES, request.snoozeLabel),
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
