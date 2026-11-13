import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { onActionDone, useAppStore } from '@/stores/app';
import { useHighlightStore } from '@/stores/highlight';

import {
  handleNotificationResponse,
  registerReminderTask,
  syncSystemRecall,
  syncSystemReminders,
} from './backgroundTask';

// The responses already opened: the one that started the app is also read at the start.
const opened = new Set<string>();

/**
 * A touch on a reminder, a group, the evening summary, the end of a timer or the check-in after 3
 * days opens Today; a reminder and a timer also give the row of their mission a short highlight
 * (design-sezioni.md 11.3, 11.5; T79). True if it opened Today.
 */
export function openTodayFrom(response: Notifications.NotificationResponse): boolean {
  const { identifier, content } = response.notification.request;
  const kind = content.data?.kind;
  if (
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
    (kind !== 'reminder' &&
      kind !== 'group' &&
      kind !== 'summary' &&
      kind !== 'timer' &&
      kind !== 'recall') ||
    opened.has(identifier)
  ) {
    return false;
  }
  opened.add(identifier);
  const missionId = content.data?.missionId;
  if ((kind === 'reminder' || kind === 'timer') && typeof missionId === 'string') {
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
 * app: a change of a mission or of the settings, a completion, an undo. The check-in after 3 days
 * moves at every opening: at the start, when the app comes back to the front and after an action.
 */
export function useReminderActions(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return;
    }
    void registerReminderTask(db)
      .catch(() => undefined)
      .then(() => syncSystemReminders(db))
      .then(() => syncSystemRecall(db));
    const stopListening = onActionDone((actionDb) => {
      void syncSystemReminders(actionDb);
      void syncSystemRecall(actionDb);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncSystemRecall(db);
      }
    });
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
      appState.remove();
      subscription.remove();
    };
  }, [db]);
}
