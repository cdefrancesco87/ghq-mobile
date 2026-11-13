import { deleteAppDatabase, openAppDatabase } from '@/db/client';
import { afterReminderSyncs } from '@/features/notifications/scheduler';
import { cancelAllNotifications } from '@/features/notifications/system';
import { wipeAllData } from '@/stores/app';

/**
 * «Elimina tutti i dati» with the database file and the notifications of the phone. The
 * notifications are cancelled after a sync in progress, which could schedule them again.
 */
export function wipeAppData(): Promise<boolean> {
  return wipeAllData({
    cancelNotifications: () => afterReminderSyncs(cancelAllNotifications),
    deleteDatabase: deleteAppDatabase,
    openDatabase: openAppDatabase,
  });
}
