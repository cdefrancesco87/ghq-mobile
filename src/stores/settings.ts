import { create } from 'zustand';

import {
  SETTING_DEFAULTS,
  getLanguage,
  getSetting,
  setSetting,
  type SettingKey,
  type SettingValue,
} from '../db/repositories/settings';
import type { Db } from '../db/types';
import { deviceLanguage, deviceLocaleTags } from '../i18n';
import { getSession } from './session';

// The settings read on every screen. The theme has its own store (theme.ts); `device_id` is an
// internal value of the event log, `onboarding_draft` of the first launch and `week_rules_next` of
// the Settings (read with `weekRulesOn` for a day), `mission_timers` of Today (timers.ts): they
// stay out.

type StoredKey = Exclude<
  SettingKey,
  'device_id' | 'onboarding_draft' | 'theme' | 'week_rules_next' | 'mission_timers'
>;
/**
 * The keys written with `update`: the day change has its own rule (setDayChange), the general pause
 * its actions (src/db/repositories/pause.ts).
 */
type EditableKey = Exclude<StoredKey, 'day_change' | 'general_pause'>;

export type AppSettings = { readonly [K in StoredKey]: SettingValue<K> };

const KEYS: readonly StoredKey[] = [
  'language',
  'game_mode',
  'day_change',
  'week_start',
  'rest_days',
  'general_pause',
  'quiet_hours',
  'evening_summary',
  'reduce_motion',
  'vibrations',
  'colorblind',
  'backup',
  'reminders_enabled',
];

function readAll(read: <K extends StoredKey>(key: K) => SettingValue<K>): AppSettings {
  return Object.fromEntries(KEYS.map((key) => [key, read(key)])) as AppSettings;
}

/** The settings of a database: the language follows the phone until one is saved (choice 19). */
function readFrom(db: Db): AppSettings {
  return {
    ...readAll((key) => getSetting(db, key)),
    language: getLanguage(db, deviceLocaleTags()),
  };
}

const DEFAULTS: AppSettings = {
  ...readAll((key) => SETTING_DEFAULTS[key]),
  language: deviceLanguage(),
};

export interface SettingsState {
  readonly settings: AppSettings;
  readonly load: (db: Db) => void;
  /** Saves a setting, then updates the store. A value that is not valid throws. */
  readonly update: <K extends EditableKey>(key: K, value: SettingValue<K>) => void;
  readonly reset: () => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: DEFAULTS,
  load: (db) => set({ settings: readFrom(db) }),
  update: (key, value) => {
    const { db, clock } = getSession();
    setSetting(db, key, value, clock().now);
    set({ settings: readFrom(db) });
  },
  reset: () => set({ settings: DEFAULTS }),
}));
