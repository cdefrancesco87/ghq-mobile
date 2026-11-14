import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { Db } from '@/db/types';
import { onActionDone, refreshAfterOutsideChange, useAppStore } from '@/stores/app';
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
 * days opens Today, the weekly recap opens Statistics (T81); a reminder and a timer also give
 * the row of their mission a short highlight (design-sezioni.md 11.3, 11.5; T79). True if it
 * opened a screen.
 */
export function openTodayFrom(response: Notifications.NotificationResponse): boolean {
  const { identifier, content } = response.notification.request;
  const kind = content.data?.kind;
  // The recap and the check-in keep one identifier: the instant tells one week from the next.
  const key = `${identifier}@${String(response.notification.date)}`;
  if (
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
    (kind !== 'reminder' &&
      kind !== 'group' &&
      kind !== 'summary' &&
      kind !== 'timer' &&
      kind !== 'recall' &&
      kind !== 'weekly') ||
    opened.has(key)
  ) {
    return false;
  }
  opened.add(key);
  const missionId = content.data?.missionId;
  if ((kind === 'reminder' || kind === 'timer') && typeof missionId === 'string') {
    useHighlightStore.getState().highlight(missionId);
  }
  try {
    // The weekly recap opens its card, at the top of the Overview of Statistics (design 8.7).
    router.navigate(kind === 'weekly' ? '/stats' : '/today');
  } catch {
    // The navigation is not ready: the app opens on Today anyway.
  }
  return true;
}

/**
 * The work after an action written outside `runAction` (badges, stores, listeners: widgets, Live
 * Activities, health, boss warnings, reminders). It never throws: with the session closed (a wipe
 * or a restore) the next start does it.
 */
function refreshQuietly(): void {
  try {
    refreshAfterOutsideChange();
  } catch {
    // The session is closed.
  }
}

/**
 * A response that reaches the app while it runs: it opens Today when touched, runs the action of
 * its button, then the same work that follows an action of the app (`runAction`). It never
 * rejects.
 */
export async function respondInApp(
  db: Db,
  response: Notifications.NotificationResponse,
): Promise<void> {
  openTodayFrom(response);
  try {
    await handleNotificationResponse(db, response);
  } catch {
    // Nothing saved, or saved before the failure: the refresh shows the real state.
  }
  refreshQuietly();
}

/**
 * The app comes back to the front: on Android the background task may have saved an action of a
 * notification on its own connection, so the stores are reloaded and the listeners run, as after
 * an action of the app (this also moves the check-in after 3 days). It never throws.
 */
export function refreshWhenActive(): void {
  refreshQuietly();
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
        // The listener of the actions above moves the check-in after 3 days.
        refreshWhenActive();
      }
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void respondInApp(db, response);
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
