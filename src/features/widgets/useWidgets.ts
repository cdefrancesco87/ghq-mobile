import { useEffect } from 'react';
import { AppState, PixelRatio } from 'react-native';

import { gameDayOf, getSetting } from '@/db/repositories/settings';
import type { Db } from '@/db/types';
import { systemScheduler } from '@/features/notifications/system';
import { onActionDone, runAction, useAppStore } from '@/stores/app';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { LARGE_TEXT_SCALE } from '@/theme/textScale';

import { handleWidgetTarget, type WidgetOutcome } from './actions';
import { syncWidgets, type WidgetHost } from './sync';
import { decodeActivityTarget } from './timerActivity';
import { onWidgetTouch, systemWidgetHost } from './system';

// Keeps the widgets of the phone in line while the app runs (design-sezioni.md 12.2, 12.3): at
// the start, after every action, when the app comes back, when theme or settings change and at
// the day change; a touch on a widget that reaches the app is completed at once.

const DAY_CHECK_MS = 60_000;

/** A reminder left on the phone is only a nuisance: the completion is already saved. */
function cancelReminders(outcomes: readonly WidgetOutcome[]): void {
  const ids = outcomes.flatMap((outcome) => outcome.cancelledNotificationIds);
  if (ids.length > 0) {
    void systemScheduler.cancel(ids).catch(() => undefined);
  }
}

function todayOf(db: Db): string {
  const { now, tzOffset } = getSession().clock();
  return gameDayOf(now, tzOffset, getSetting(db, 'day_change'));
}

/** One sync at a time: a request during a sync runs once more after it. */
function serializedSync(db: Db, host: WidgetHost) {
  let running = false;
  let again = false;
  let lastDay: string | null = null;

  const sync = async (): Promise<void> => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        try {
          const result = await syncWidgets(db, host, () => getSession().clock(), {
            largeText: PixelRatio.getFontScale() >= LARGE_TEXT_SCALE,
            act: runAction,
          });
          cancelReminders(result.outcomes);
          lastDay = result.snapshot?.day ?? lastDay;
        } catch {
          // The widgets keep the last snapshot until the next sync.
        }
      } while (again);
    } finally {
      running = false;
    }
  };

  const syncIfNewDay = () => {
    try {
      if (lastDay !== null && todayOf(db) !== lastDay) {
        void sync();
      }
    } catch {
      // The session is closed (a wipe or a restore): the next start syncs again.
    }
  };

  return { sync, syncIfNewDay };
}

export function useWidgets(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return undefined;
    }
    const host = systemWidgetHost();
    if (host === null) {
      return undefined;
    }
    const { sync, syncIfNewDay } = serializedSync(db, host);
    void sync();
    const stopActions = onActionDone(() => void sync());
    const stopTheme = useThemeStore.subscribe(() => void sync());
    const stopSettings = useSettingsStore.subscribe(() => void sync());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void sync();
      }
    });
    const dayCheck = setInterval(syncIfNewDay, DAY_CHECK_MS);
    const stopTouches = onWidgetTouch((target) => {
      if (decodeActivityTarget(target) !== null) {
        // A button of the Live Activity of a timer (`useTimerActivities`).
        return;
      }
      try {
        // `runAction` refreshes the stores and starts a sync through `onActionDone`.
        const outcome = runAction((actionDb, clock) => handleWidgetTarget(actionDb, target, clock));
        cancelReminders([outcome]);
      } catch {
        // The session is closed: the touch is lost, the next sync shows the real state.
      }
    });
    return () => {
      stopActions();
      stopTheme();
      stopSettings();
      appState.remove();
      clearInterval(dayCheck);
      stopTouches();
    };
  }, [db]);
}
