import type { CompletionResult } from '../../db/repositories/completion';
import { healthMissionsToRead, recordHealthValue } from '../../db/repositories/health';
import type { ActionClock } from '../../db/repositories/hero';
import { hasProfile } from '../../db/repositories/onboarding';
import { getSetting } from '../../db/repositories/settings';
import type { Db } from '../../db/types';
import { healthAmount, healthValue, healthWindow } from '../../rules/health';
import { quietHoursEnd } from '../../rules/reminders';
import { notificationTextsOf, type NotificationText } from '../notifications/texts';
import type { HealthSource } from './source';

// Reads the health data of the linked missions and moves them (design-sezioni.md 12.7): when the
// app opens or comes back, and in the background task. A mission that reaches its goal completes
// by itself and a notification says so, after «Non disturbare».

/** The notification «Obiettivo raggiunto», or a fake one in the tests. */
export interface HealthNotifier {
  /** Shows the text at `fireAt` (UTC milliseconds), at once when it is not after `now`. */
  notify(text: NotificationText, fireAt: number, now: number): Promise<void>;
}

export interface HealthSyncOptions {
  /** Runs the action: `runAction` in the app, so stores and widgets follow; a plain call else. */
  readonly act?: <T>(action: (db: Db, clock: ActionClock) => T) => T;
  readonly notifier?: HealthNotifier | null;
}

export interface HealthOutcome {
  readonly missionId: string;
  readonly result: CompletionResult;
}

/** Never throws for one mission: a reading that fails waits for the next sync. */
export async function syncHealth(
  db: Db,
  source: HealthSource,
  clock: () => ActionClock,
  options: HealthSyncOptions = {},
): Promise<HealthOutcome[]> {
  if (source.platform === null || !hasProfile(db)) {
    return [];
  }
  const act = options.act ?? ((action) => action(db, clock()));
  const outcomes: HealthOutcome[] = [];
  for (const item of healthMissionsToRead(db, clock())) {
    const { now, tzOffset } = clock();
    const reading = await source.read(
      item.metric,
      healthWindow({
        metric: item.metric,
        day: item.day,
        dayChange: item.dayChange,
        tzOffset,
        now,
      }),
    );
    if (reading === null) {
      continue;
    }
    const value = healthValue(item.metric, reading);
    // Nothing new: no action, so the stores are not refreshed for nothing.
    if (healthAmount(item.value, value) <= 0) {
      continue;
    }
    let result: CompletionResult | null;
    try {
      result = act((actionDb, actionClock) =>
        recordHealthValue(actionDb, {
          missionId: item.missionId,
          value,
          day: item.day,
          now: actionClock.now,
          tzOffset: actionClock.tzOffset,
        }),
      );
    } catch {
      // The mission changed meanwhile (deleted, paused): the next sync sees it as it is.
      continue;
    }
    if (result === null) {
      continue;
    }
    outcomes.push({ missionId: item.missionId, result });
    if (result.status === 'completed' && options.notifier) {
      const at = clock();
      const text = notificationTextsOf(db).healthGoal({
        name: item.name,
        target: item.target,
        unit: item.unit,
        xp: result.completion?.xp ?? 0,
      });
      const fireAt = quietHoursEnd(at.now, at.tzOffset, getSetting(db, 'quiet_hours'));
      await options.notifier.notify(text, fireAt, at.now).catch(() => undefined);
    }
  }
  return outcomes;
}
