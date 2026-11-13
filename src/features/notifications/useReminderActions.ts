import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { onActionDone, useAppStore } from '@/stores/app';
import { useHighlightStore } from '@/stores/highlight';

import {
  handleNotificationResponse,
  registerReminderTask,
  syncSystemReminders,
} from './backgroundTask';

// The responses already opened: the one that started the app is also read at the start.
const opened = new Set<string>();

/**
 * A touch on a reminder, a group or the evening summary opens Today; a reminder also gives the
 * row of its mission a short highlight (design-sezioni.md 11.3, 11.5). True if it opened Today.
 */
export function openTodayFrom(response: Notifications.NotificationResponse): boolean {
  const { identifier, content } = response.notification.request;
  const kind = content.data?.kind;
  if (
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
    (kind !== 'reminder' && kind !== 'group' && kind !== 'summary') ||
    opened.has(identifier)
  ) {
    return false;
  }
  opened.add(identifier);
  const missionId = content.data?.missionId;
  if (kind === 'reminder' && typeof missionId === 'string') {
    useHighlightStore.getState().highlight(missionId);
  }
  try {
    router.navigate('/today');
  } catch {
    // The navigation is not ready: the app opens on Today anyway.
  }
  return true;
}

/**
 * Registers the task of the reminders and listens to the responses while the app runs (iPhone
 * actions and Android with the app open). The response that started the app is handled too. It
 * schedules the reminders and the evening summary at the start and after every action of the
 * app: a change of a mission or of the settings, a completion, an undo.
 */
export function useReminderActions(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return;
    }
    void registerReminderTask(db)
      .catch(() => undefined)
      .then(() => syncSystemReminders(db));
    const stopListening = onActionDone((actionDb) => void syncSystemReminders(actionDb));
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openTodayFrom(response);
      void handleNotificationResponse(db, response).then(() => syncSystemReminders(db));
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response !== null) {
          openTodayFrom(response);
        }
      })
      .catch(() => undefined);
    return () => {
      stopListening();
      subscription.remove();
    };
  }, [db]);
}
