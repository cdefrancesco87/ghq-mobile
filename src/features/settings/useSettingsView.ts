import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { getDaySettings, type DaySettings } from '@/db/repositories/settings';
import {
  notificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/features/notifications/system';
import { getSession } from '@/stores/session';
import { useSettingsStore, type AppSettings } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';

export interface SettingsView {
  readonly settings: AppSettings;
  readonly theme: ReturnType<typeof useThemeStore.getState>['theme'];
  /** The group Giornata: the rules of today and the changes from tomorrow. */
  readonly day: DaySettings;
}

/** The values of the Settings, read again after every action (`runAction` reloads the stores). */
export function useSettingsView(): SettingsView {
  const settings = useSettingsStore((state) => state.settings);
  const theme = useThemeStore((state) => state.theme);
  const day = useMemo(() => {
    const { db, clock } = getSession();
    return getDaySettings(db, clock());
    // `settings` is a dependency only to read the day again when a setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  return { settings, theme, day };
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
