import { useEffect } from 'react';
import { AppState } from 'react-native';

import { hasProfile } from '@/db/repositories/onboarding';
import { getSetting } from '@/db/repositories/settings';
import { getTodayView } from '@/db/repositories/todayView';
import type { Db } from '@/db/types';
import { systemScheduler, systemTimers } from '@/features/notifications/system';
import { notificationTextsOf, translator } from '@/features/notifications/texts';
import { onActionDone, runAction, useAppStore } from '@/stores/app';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';

import { onWidgetTouch, systemTimerActivityHost } from './system';
import {
  createTimerActivities,
  decodeActivityTarget,
  handleTimerActivityTarget,
  timerActivityLookOf,
  timerMissionsOf,
  type TimerActivityHost,
  type TimerActivityOutcome,
} from './timerActivity';

// Keeps the Live Activities of the timers in line while the app runs (design-sezioni.md 12.5;
// backlog T87): after every action (the play, the pause and the end in Today, a completion from a
// notification or a widget), when the app comes back, when theme or language change and every
// minute for the day change; a touch on Pausa, Riprendi or Completa that reaches the app is
// saved at once.

const CHECK_MS = 60_000;

/** The notification of the end follows the timer, as in Today (T79). */
function followUp(db: Db, outcome: TimerActivityOutcome): void {
  const { missionId } = outcome;
  if (missionId === null) {
    return;
  }
  const cancelled = outcome.result?.cancelledNotificationIds ?? [];
  if (cancelled.length > 0) {
    void systemScheduler.cancel(cancelled).catch(() => undefined);
  }
  if (outcome.outcome === 'paused' || outcome.outcome === 'completed') {
    void systemTimers.cancel(missionId).catch(() => undefined);
  }
  if (outcome.outcome === 'resumed' && outcome.endsAt !== null) {
    const mission = getTodayView(db, getSession().clock()).missions.find(
      (item) => item.mission.id === missionId,
    );
    const t = translator(getSetting(db, 'language'));
    void systemTimers
      .schedule({
        missionId,
        title: t('today.timer.notificationTitle', { name: mission?.mission.name ?? '' }),
        body: notificationTextsOf(db).sign(t('today.timer.notificationBody')),
        fireAt: outcome.endsAt,
      })
      .catch(() => undefined);
  }
}

/** Starts the sync of the activities and the listeners; gives the function that stops them. */
export function watchTimerActivities(db: Db, host: TimerActivityHost): () => void {
  const activities = createTimerActivities(host);
  let running = false;
  let again = false;

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
          if (!hasProfile(db)) {
            return;
          }
          const clock = getSession().clock();
          const view = getTodayView(db, clock);
          await activities.sync({
            day: view.day,
            now: clock.now,
            missions: timerMissionsOf(view, clock.now),
            look: timerActivityLookOf(db),
            // iPhone refuses a start in the background; a refusal is caught.
            canStart: AppState.currentState !== 'background',
          });
        } catch {
          // The session is closed (a wipe or a restore): the next action syncs again.
        }
      } while (again);
    } finally {
      running = false;
    }
  };

  void sync();
  const stopActions = onActionDone(() => void sync());
  const stopTheme = useThemeStore.subscribe(() => void sync());
  const stopSettings = useSettingsStore.subscribe(() => void sync());
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void sync();
    }
  });
  const check = setInterval(() => void sync(), CHECK_MS);
  const stopTouches = onWidgetTouch((target) => {
    if (decodeActivityTarget(target) === null) {
      return;
    }
    try {
      // `runAction` refreshes the stores and syncs the activities through `onActionDone`.
      const outcome = runAction((actionDb, clock) =>
        handleTimerActivityTarget(actionDb, target, clock),
      );
      followUp(db, outcome);
    } catch {
      // The session is closed: the touch is lost, the next sync shows the real state.
    }
  });
  return () => {
    stopActions();
    stopTheme();
    stopSettings();
    appState.remove();
    clearInterval(check);
    stopTouches();
  };
}

export function useTimerActivities(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return undefined;
    }
    const host = systemTimerActivityHost();
    return host === null ? undefined : watchTimerActivities(db, host);
  }, [db]);
}
