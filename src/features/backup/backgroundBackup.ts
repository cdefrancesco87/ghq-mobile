import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';

import { databaseForTask } from '@/db/backgroundDatabase';
import { serializeAppDatabase } from '@/db/client';
import { getSetting } from '@/db/repositories/settings';
import { isAutoBackupDue } from '@/rules/backup';
import { BACKUP } from '@/rules/config';
import { useAppStore } from '@/stores/app';
import { useSettingsStore } from '@/stores/settings';
import { backUpAndRecord } from './backupService';
import { createAppCloudStore } from './cloudStorage';

// The daily automatic backup (stack-tecnologico.md, point 4) with expo-background-task: the
// system runs the task about once a day while the switch of the page Backup is on. This module
// must be imported early (root layout), so the task is defined when the system starts the bundle
// in the background.

export const BACKUP_TASK = 'ghq-daily-backup';

TaskManager.defineTask(BACKUP_TASK, async () => {
  try {
    const db = await databaseForTask();
    const now = Date.now();
    if (isAutoBackupDue(getSetting(db, 'backup'), now)) {
      // In the background Google never asks for the permission: without it the attempt fails
      // with «unavailable» and the page shows it.
      await backUpAndRecord(
        db,
        { cloud: createAppCloudStore({ interactive: false }), serialize: serializeAppDatabase },
        now,
      );
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the task with the system when the automatic backup is on, and removes it when off. */
export async function syncAutoBackupTask(auto: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
    if (auto && !registered) {
      await BackgroundTask.registerTaskAsync(BACKUP_TASK, {
        minimumInterval: BACKUP.autoIntervalMinutes,
      });
    } else if (!auto && registered) {
      await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
    }
  } catch {
    // Background tasks not available (a simulator, a restricted phone): the backup by hand works.
  }
}

/**
 * Keeps the task registered as the setting says: at the start, after a restore or a wipe. Before
 * the data are loaded the store holds the default (off), which must not remove the task.
 */
export function useAutoBackupTask(): void {
  const ready = useAppStore((state) => state.status === 'ready');
  const auto = useSettingsStore((state) => state.settings.backup.auto);
  useEffect(() => {
    if (ready) {
      void syncAutoBackupTask(auto);
    }
  }, [ready, auto]);
}
