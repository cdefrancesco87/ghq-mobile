import { create } from 'zustand';

import {
  SETTING_DEFAULTS,
  getSetting,
  setSetting,
  type SettingKey,
  type SettingValue,
} from '../db/repositories/settings';
import type { Db } from '../db/types';
import { getSession } from './session';

// The settings read on every screen. The theme has its own store (theme.ts); `device_id` is an
// internal value of the event log and stays out.

type StoredKey = Exclude<SettingKey, 'device_id' | 'theme'>;
/** The keys written with `update`: the day change has its own rule (setDayChange). */
type EditableKey = Exclude<StoredKey, 'day_change'>;

export type AppSettings = { readonly [K in StoredKey]: SettingValue<K> };

const KEYS: readonly StoredKey[] = [
  'language',
  'game_mode',
  'day_change',
  'week_start',
  'rest_days',
  'quiet_hours',
  'evening_summary',
  'reduce_motion',
  'colorblind',
  'backup',
];

function readAll(read: <K extends StoredKey>(key: K) => SettingValue<K>): AppSettings {
  return Object.fromEntries(KEYS.map((key) => [key, read(key)])) as AppSettings;
}

const DEFAULTS = readAll((key) => SETTING_DEFAULTS[key]);

export interface SettingsState {
  readonly settings: AppSettings;
  readonly load: (db: Db) => void;
  /** Saves a setting, then updates the store. A value that is not valid throws. */
  readonly update: <K extends EditableKey>(key: K, value: SettingValue<K>) => void;
  readonly reset: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: DEFAULTS,
  load: (db) => set({ settings: readAll((key) => getSetting(db, key)) }),
  update: (key, value) => {
    const { db, clock } = getSession();
    setSetting(db, key, value, clock().now);
    set({ settings: readAll((other) => getSetting(db, other)) });
  },
  reset: () => set({ settings: DEFAULTS }),
}));
