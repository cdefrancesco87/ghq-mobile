import { create } from 'zustand';

import {
  SETTING_DEFAULTS,
  getSetting,
  setSetting,
  type SettingValue,
} from '../db/repositories/settings';
import type { Db } from '../db/types';
import { getSession } from './session';

// The `theme` setting. The tokens come from `ThemeProvider`, which resolves «Minimal» with the
// light or dark mode of the phone.

export interface ThemeState {
  readonly theme: SettingValue<'theme'>;
  readonly load: (db: Db) => void;
  /** Saves the theme, then updates the store. */
  readonly setTheme: (theme: SettingValue<'theme'>) => void;
  readonly reset: () => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: SETTING_DEFAULTS.theme,
  load: (db) => set({ theme: getSetting(db, 'theme') }),
  setTheme: (theme) => {
    const { db, clock } = getSession();
    setSetting(db, 'theme', theme, clock().now);
    set({ theme: getSetting(db, 'theme') });
  },
  reset: () => set({ theme: SETTING_DEFAULTS.theme }),
}));
