import { useEffect } from 'react';
import { AppState } from 'react-native';

import { hasHealthMissions } from '@/db/repositories/health';
import { onActionDone, runAction, useAppStore } from '@/stores/app';
import { getSession } from '@/stores/session';

import { cancelHealthReminders, syncHealthTask } from './backgroundHealth';
import { systemHealthNotifier } from './notify';
import { syncHealth } from './sync';
import { healthSource } from './system';

// Reads the health data while the app runs (design-sezioni.md 12.7): at the start, when the app
// comes back and after an action (a mission just linked shows its value at once), one reading at
// a time. The actions of the reading itself happen while it runs, so they start no other one.

export function useHealthSync(): void {
  const db = useAppStore((state) => state.db);

  useEffect(() => {
    if (db === null) {
      return undefined;
    }
    let running = false;
    let linked: boolean | null = null;

    const sync = async (): Promise<void> => {
      if (running) {
        return;
      }
      running = true;
      try {
        const nowLinked = hasHealthMissions(db);
        if (nowLinked !== linked) {
          linked = nowLinked;
          void syncHealthTask(nowLinked);
        }
        if (nowLinked) {
          const outcomes = await syncHealth(db, healthSource(), () => getSession().clock(), {
            act: runAction,
            notifier: systemHealthNotifier,
          });
          cancelHealthReminders(outcomes);
        }
      } catch {
        // The session is closed (a wipe or a restore) or the reading failed: the next one retries.
      } finally {
        running = false;
      }
    };

    void sync();
    const stopActions = onActionDone(() => void sync());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void sync();
      }
    });
    return () => {
      stopActions();
      appState.remove();
    };
  }, [db]);
}
