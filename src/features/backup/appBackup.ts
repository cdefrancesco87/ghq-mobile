import {
  appSchemaVersion,
  dropPreviousAppDatabase,
  openAppDatabase,
  putBackPreviousAppDatabase,
  replaceAppDatabase,
  serializeAppDatabase,
} from '@/db/client';
import { setAutoBackup } from '@/db/repositories/backup';
import type { BackupErrorCode } from '@/db/repositories/settings';
import { afterReminderSyncs } from '@/features/notifications/scheduler';
import { cancelAllNotifications } from '@/features/notifications/system';
import { restoreAllData, runAction, useAppStore, type RestoreOutcome } from '@/stores/app';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import {
  isNewerThanApp,
  readBackupDatabase,
  readBackupSummary,
  type BackupSummary,
} from './backupFile';
import { backUpAndRecord } from './backupService';
import { syncAutoBackupTask } from './backgroundBackup';
import { createAppCloudStore } from './cloudStorage';

// The backup of the page Backup e ripristino, with the database, the cloud and the notifications
// of the phone (design-sezioni.md 10.8). From here Google may ask for the permission to its space.

let running: Promise<BackupErrorCode | null> | null = null;

/**
 * «Fai un backup ora»: null when it worked, otherwise the reason. A second call while one is
 * running waits for the same backup.
 */
export function backUpNow(): Promise<BackupErrorCode | null> {
  running ??= (async () => {
    const { db, clock } = getSession();
    const code = await backUpAndRecord(
      db,
      { cloud: createAppCloudStore({ interactive: true }), serialize: serializeAppDatabase },
      clock().now,
    );
    if (useAppStore.getState().db === db) {
      useSettingsStore.getState().load(db);
    }
    return code;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** The daily automatic backup on or off, with the task of the system. */
export function changeAutoBackup(auto: boolean): void {
  runAction((db, clock) => setAutoBackup(db, auto, clock.now));
  void syncAutoBackupTask(auto);
}

/** The summary of the backup in the cloud, or null when there is none. Throws a BackupError. */
export function findBackup(): Promise<BackupSummary | null> {
  return readBackupSummary(createAppCloudStore({ interactive: true }));
}

/** True when the backup comes from a newer app: it cannot be restored before an update. */
export function isFromNewerApp(summary: BackupSummary): boolean {
  return isNewerThanApp(summary, appSchemaVersion());
}

/**
 * «Ripristina»: downloads the backup and puts it in place of the data of the phone. Throws a
 * BackupError when the backup cannot be read (newer app, damaged, no connection).
 */
export async function restoreBackup(summary: BackupSummary): Promise<RestoreOutcome> {
  const cloud = createAppCloudStore({ interactive: true });
  const bytes = await readBackupDatabase(cloud, summary, appSchemaVersion());
  return restoreAllData({
    cancelNotifications: () => afterReminderSyncs(cancelAllNotifications),
    replaceDatabase: () => replaceAppDatabase(bytes),
    putBackPrevious: putBackPreviousAppDatabase,
    dropPrevious: dropPreviousAppDatabase,
    openDatabase: openAppDatabase,
  });
}
