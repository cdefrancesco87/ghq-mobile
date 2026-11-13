import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { onActionDone, useAppStore } from '@/stores/app';

import {
  handleNotificationResponse,
  registerReminderTask,
  syncSystemReminders,
} from './backgroundTask';

/**
 * Registers the task of the reminders and listens to the responses while the app runs (iPhone
 * actions and Android with the app open). The response that started the app is handled too. It
 * schedules the reminders at the start and after every action of the app: a change of a mission
 * or of the settings, a completion, an undo.
 */
export function useReminderActions(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return;
    }
    void registerReminderTask()
      .catch(() => undefined)
      .then(() => syncSystemReminders(db));
    const stopListening = onActionDone((actionDb) => void syncSystemReminders(actionDb));
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(db, response).then(() => syncSystemReminders(db));
    });
    return () => {
      stopListening();
      subscription.remove();
    };
  }, [db]);
}
