import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useAppStore } from '@/stores/app';

import { handleNotificationResponse, registerReminderTask } from './backgroundTask';

/**
 * Registers the task of the reminders and listens to the responses while the app runs (iPhone
 * actions and Android with the app open). The response that started the app is handled too.
 */
export function useReminderActions(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return;
    }
    void registerReminderTask();
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(db, response);
    });
    return () => subscription.remove();
  }, [db]);
}
