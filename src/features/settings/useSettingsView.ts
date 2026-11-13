import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { getDaySettings, type DaySettings } from '@/db/repositories/settings';
import { getTodayPause, type TodayPause } from '@/db/repositories/todayView';
import {
  notificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/features/notifications/system';
import { getSession } from '@/stores/session';
import type { PauseInterval } from '@/rules/pause';
import { useSettingsStore, type AppSettings } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';

export interface SettingsView {
  readonly settings: AppSettings;
  readonly theme: ReturnType<typeof useThemeStore.getState>['theme'];
  /** The group Giornata: the rules of today and the changes from tomorrow. */
  readonly day: DaySettings;
  /** The general pause in progress or scheduled; one already over (not closed yet) is none. */
  readonly pause: PauseInterval | null;
  /** The general pause that holds today, for «Riprendi». */
  readonly todayPause: TodayPause | null;
}

/** The values of the Settings, read again after every action (`runAction` reloads the stores). */
export function useSettingsView(): SettingsView {
  const settings = useSettingsStore((state) => state.settings);
  const theme = useThemeStore((state) => state.theme);
  const { day, todayPause } = useMemo(() => {
    const { db, clock } = getSession();
    const now = clock();
    return { day: getDaySettings(db, now), todayPause: getTodayPause(db, now) };
    // `settings` is a dependency only to read the day again when a setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  const stored = settings.general_pause;
  const pause =
    stored === null || (stored.until_day !== null && stored.until_day < day.today)
      ? null
      : { fromDay: stored.from_day, untilDay: stored.until_day };
  return { settings, theme, day, pause, todayPause };
}

/**
 * The permission of the notifications, read again when the app comes back from the settings of the
 * phone; null while it is being read. `ask` asks for it when it was never asked.
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const read = useCallback(() => notificationPermission().catch(() => null), []);

  useEffect(() => {
    let active = true;
    const refresh = () => void read().then((state) => active && setPermission(state));
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [read]);

  const ask = useCallback(async () => {
    await requestNotificationPermission().catch(() => false);
    setPermission(await read());
  }, [read]);

  return { permission, ask };
}
