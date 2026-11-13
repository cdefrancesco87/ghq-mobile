import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { databaseForTask } from '../../db/backgroundDatabase';
import type { Db } from '../../db/types';
import { HEALTH } from '../../rules/config';
import { syncSystemReminders, syncSystemWidgets } from '../notifications/backgroundTask';
import { systemScheduler } from '../notifications/system';
import { systemHealthNotifier } from './notify';
import { syncHealth, type HealthOutcome } from './sync';
import { healthSource } from './system';

// The reading of the health data in the background (stack-tecnologico.md, point 7) with
// expo-background-task: registered while a mission is linked. This module must be imported early
// (root layout), so the task is defined when the system starts the bundle in the background.

export const HEALTH_TASK = 'ghq-health-sync';

/** The phone offset from UTC, in minutes east. */
function tzOffsetAt(now: number): number {
  return -new Date(now).getTimezoneOffset();
}

/** A reminder left for a mission completed by the health data is only a nuisance. */
export function cancelHealthReminders(outcomes: readonly HealthOutcome[]): void {
  const ids = outcomes.flatMap((outcome) => outcome.result.cancelledNotificationIds);
  if (ids.length > 0) {
    void systemScheduler.cancel(ids).catch(() => undefined);
  }
}

/** Reads the health data with the clock of the phone, then aligns reminders and widgets. */
async function syncInBackground(db: Db): Promise<void> {
  const outcomes = await syncHealth(
    db,
    healthSource(),
    () => {
      const now = Date.now();
      return { now, tzOffset: tzOffsetAt(now), source: 'health' as const };
    },
    { notifier: systemHealthNotifier },
  );
  cancelHealthReminders(outcomes);
  if (outcomes.length > 0) {
    await syncSystemReminders(db);
    await syncSystemWidgets(db);
  }
}

TaskManager.defineTask(HEALTH_TASK, async () => {
  try {
    await syncInBackground(await databaseForTask());
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the task while a mission is linked, and removes it when none is. */
export async function syncHealthTask(linked: boolean): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(HEALTH_TASK);
    if (linked && !registered) {
      await BackgroundTask.registerTaskAsync(HEALTH_TASK, {
        minimumInterval: HEALTH.backgroundIntervalMinutes,
      });
    } else if (!linked && registered) {
      await BackgroundTask.unregisterTaskAsync(HEALTH_TASK);
    }
  } catch {
    // Background tasks not available: the data are still read when the app opens.
  }
}
