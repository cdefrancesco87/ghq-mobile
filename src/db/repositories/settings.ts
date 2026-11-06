import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import { addDays, isGameDay, toGameDay } from '../../rules/gameDay';
import { GAME_MODES, type GameDay } from '../../rules/types';
import { settings } from '../schema';
import type { Db } from '../types';

// The settings: a key-value table where every value is JSON validated by the Zod schema of its
// key (modello-dati.md, 3.10). Defaults come from design-sezioni.md, section 10.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time HH:MM');
/** The day can change from 00:00 to 06:00, every 30 minutes (design 10.5). */
const dayChangeTime = z
  .string()
  .regex(/^(0[0-5]:(00|30)|06:00)$/, 'Expected a time from 00:00 to 06:00, every 30 minutes');
const gameDay = z.custom<GameDay>(isGameDay, 'Expected a game day (YYYY-MM-DD)');
const weekday = z.literal([1, 2, 3, 4, 5, 6, 7]);

export const LANGUAGES = ['it', 'en', 'de', 'fr', 'es'] as const;

/**
 * The language to use at first launch (CLAUDE.md, choice 19): the device language if it is one
 * of the five supported ones, otherwise English.
 */
export function defaultLanguage(
  locales: readonly { readonly languageCode: string | null }[],
): SettingValue<'language'> {
  const code = locales[0]?.languageCode;
  return (LANGUAGES as readonly string[]).includes(code ?? '')
    ? (code as SettingValue<'language'>)
    : 'en';
}

/**
 * The themes of temi.json. `minimal` follows the light or dark mode of the phone («Automatico»);
 * the two Minimal variants fix one of them («Chiaro», «Scuro»).
 */
export const THEMES = [
  'arcade',
  'fantasy',
  'cyberpunk',
  'lovecraft',
  'minimal',
  'minimal-chiaro',
  'minimal-scuro',
] as const;

export const settingSchemas = {
  language: z.enum(LANGUAGES),
  theme: z.enum(THEMES),
  game_mode: z.enum(GAME_MODES),
  /** The time in force and, from `from_day`, the next one: a change counts from the next day. */
  day_change: z.strictObject({
    value: dayChangeTime,
    next: dayChangeTime.nullable(),
    from_day: gameDay.nullable(),
  }),
  /** 1 = Monday, 7 = Sunday. */
  week_start: z.literal([1, 7]),
  rest_days: z
    .array(weekday)
    .refine((days) => new Set(days).size === days.length, 'Each weekday only once'),
  /** «Non disturbare» intervals; an interval can cross midnight (22:00–07:00). */
  quiet_hours: z.array(z.strictObject({ start: time, end: time })),
  evening_summary: z.strictObject({ enabled: z.boolean(), time }),
  /** «Come il telefono», «Sì», «No». */
  reduce_motion: z.enum(['system', 'on', 'off']),
  colorblind: z.boolean(),
  backup: z.strictObject({ auto: z.boolean(), lastBackupAt: z.number().int().nullable() }),
  /** Created once at the first start (getDeviceId); it identifies the device in the event log. */
  device_id: z.string().min(1),
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;
export type DayChangeSetting = SettingValue<'day_change'>;

/** Keys with a fixed default: the device id is created instead (getDeviceId). */
type KeyWithDefault = Exclude<SettingKey, 'device_id'>;
/** Keys written with setSetting: the day change has its own rule (setDayChange). */
type EditableKey = Exclude<SettingKey, 'device_id' | 'day_change'>;

export const SETTING_DEFAULTS: { readonly [K in KeyWithDefault]: SettingValue<K> } = {
  language: 'en',
  theme: 'minimal',
  game_mode: 'full',
  day_change: { value: '06:00', next: null, from_day: null },
  week_start: 1,
  rest_days: [],
  quiet_hours: [],
  evening_summary: { enabled: true, time: '21:00' },
  reduce_motion: 'system',
  colorblind: false,
  backup: { auto: false, lastBackupAt: null },
};

function readValid<K extends SettingKey>(db: Db, key: K): SettingValue<K> | undefined {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .get();
  if (row === undefined) {
    return undefined;
  }
  const parsed = settingSchemas[key].safeParse(row.value);
  return parsed.success ? (parsed.data as SettingValue<K>) : undefined;
}

function write<K extends SettingKey>(db: Db, key: K, value: unknown, now: number): void {
  const valid = settingSchemas[key].parse(value);
  db.insert(settings)
    .values({ key, value: valid, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: valid, updatedAt: now } })
    .run();
}

/**
 * The value of a setting, or its default when it was never written. A stored value that is not
 * valid any more (for example after a theme is removed) also gives the default.
 */
export function getSetting<K extends KeyWithDefault>(db: Db, key: K): SettingValue<K> {
  return readValid(db, key) ?? SETTING_DEFAULTS[key];
}

/** Writes a setting after validating it with its Zod schema; a value that is not valid throws. */
export function setSetting<K extends EditableKey>(
  db: Db,
  key: K,
  value: SettingValue<K>,
  now: number,
): void {
  write(db, key, value, now);
}

/** The day change time in force on a game day. */
export function dayChangeOn(setting: DayChangeSetting, day: GameDay): string {
  return setting.next !== null && setting.from_day !== null && day >= setting.from_day
    ? setting.next
    : setting.value;
}

/**
 * The game day of an instant with the day change setting. With a pending change, the day in
 * progress still ends at the old time and the new time counts from `from_day`; the game day never
 * goes back to a day before `from_day`, even when the new time is later than the old one.
 *
 * @param tzOffsetMinutes Minutes east of UTC (local time = UTC + offset).
 */
export function gameDayOf(
  instantMs: number,
  tzOffsetMinutes: number,
  setting: DayChangeSetting,
): GameDay {
  const byCurrent = toGameDay(instantMs, tzOffsetMinutes, setting.value);
  if (setting.next === null || setting.from_day === null || byCurrent < setting.from_day) {
    return byCurrent;
  }
  const byNext = toGameDay(instantMs, tzOffsetMinutes, setting.next);
  return byNext > setting.from_day ? byNext : setting.from_day;
}

/**
 * Changes the day change time from tomorrow, so the day in progress keeps its rules
 * (design 10.5). Choosing again the time in force cancels a pending change.
 */
export function setDayChange(
  db: Db,
  newTime: string,
  { today, now }: { today: GameDay; now: number },
): void {
  const inForce = dayChangeOn(getSetting(db, 'day_change'), today);
  const setting: DayChangeSetting =
    newTime === inForce
      ? { value: inForce, next: null, from_day: null }
      : { value: inForce, next: newTime, from_day: addDays(today, 1) };
  write(db, 'day_change', setting, now);
}

/** The id of this device, created as a UUID v7 the first time and then always the same. */
export function getDeviceId(db: Db, now: number): string {
  const stored = readValid(db, 'device_id');
  if (stored !== undefined) {
    return stored;
  }
  const deviceId = uuidv7();
  write(db, 'device_id', deviceId, now);
  return deviceId;
}
