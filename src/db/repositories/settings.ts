import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import { MAX_TEMPLATES, MISSION_TEMPLATES } from '../../content/templates';
import { addDays, isGameDay, toGameDay } from '../../rules/gameDay';
import { FALLBACK_LANGUAGE, HERO_NAME_MAX_LENGTH } from '../../rules/config';
import { pickLanguage } from '../../rules/language';
import { GAME_MODES, LANGUAGES, type GameDay } from '../../rules/types';
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
const weekStart = z.literal([1, 7]);
const restDays = z
  .array(weekday)
  .refine((days) => new Set(days).size === days.length, 'Each weekday only once');

export { LANGUAGES };

/**
 * Why a backup or a restore did not work (design 10.8): no iCloud or Google account, cloud full,
 * no connection, no backup to restore, a backup of a newer app, a damaged file, anything else.
 */
export const BACKUP_ERRORS = [
  'unavailable',
  'no_space',
  'offline',
  'missing',
  'newer',
  'corrupt',
  'unknown',
] as const;
export type BackupErrorCode = (typeof BACKUP_ERRORS)[number];

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
  week_start: weekStart,
  rest_days: restDays,
  /**
   * A change of `week_start` and `rest_days` waiting for `from_day`: like the day change, it
   * counts from the next day (design 10.5). Missing when there is none.
   */
  week_rules_next: z.strictObject({
    week_start: weekStart,
    rest_days: restDays,
    from_day: gameDay,
  }),
  /** The general switch of the reminders in the Settings (design 10.6). */
  reminders_enabled: z.boolean(),
  /** «Non disturbare» intervals; an interval can cross midnight (22:00–07:00). */
  quiet_hours: z.array(z.strictObject({ start: time, end: time })),
  evening_summary: z.strictObject({ enabled: z.boolean(), time }),
  /** «Come il telefono», «Sì», «No». */
  reduce_motion: z.enum(['system', 'on', 'off']),
  colorblind: z.boolean(),
  /**
   * The backup in the cloud (design 10.8): the daily automatic backup, when the last one was made
   * and why the last attempt failed, cleared by the next backup that works.
   */
  backup: z.strictObject({
    auto: z.boolean(),
    lastBackupAt: z.number().int().nullable(),
    lastError: z
      .strictObject({ at: z.number().int(), code: z.enum(BACKUP_ERRORS) })
      .nullable()
      .default(null),
  }),
  /** Created once at the first start (getDeviceId); it identifies the device in the event log. */
  device_id: z.string().min(1),
  /** The choices of a first launch in progress: it resumes from here, then it is removed. */
  onboarding_draft: z.strictObject({
    step: z.literal([1, 2, 3, 4, 5]),
    name: z.string().max(HERO_NAME_MAX_LENGTH),
    theme: z.enum(THEMES),
    templateKeys: z
      .array(z.string())
      .max(MAX_TEMPLATES)
      .refine((keys) => new Set(keys).size === keys.length, 'Each template only once')
      .refine(
        (keys) => keys.every((key) => MISSION_TEMPLATES.some((item) => item.key === key)),
        'Unknown template',
      ),
  }),
};

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;
export type DayChangeSetting = SettingValue<'day_change'>;
export type OnboardingDraft = SettingValue<'onboarding_draft'>;
export type WeekRulesChange = SettingValue<'week_rules_next'>;

/**
 * Keys without a fixed default: the device id is created, the draft and the change of the week
 * rules exist only for a while.
 */
type KeyWithDefault = Exclude<SettingKey, 'device_id' | 'onboarding_draft' | 'week_rules_next'>;
/** Keys written with setSetting: the day change has its own rule (setDayChange). */
type EditableKey = Exclude<KeyWithDefault, 'day_change'>;

export const SETTING_DEFAULTS: { readonly [K in KeyWithDefault]: SettingValue<K> } = {
  /** Only a fallback: the first launch uses the language of the phone (getLanguage). */
  language: FALLBACK_LANGUAGE,
  theme: 'minimal',
  game_mode: 'full',
  day_change: { value: '06:00', next: null, from_day: null },
  week_start: 1,
  rest_days: [],
  quiet_hours: [],
  evening_summary: { enabled: true, time: '21:00' },
  reduce_motion: 'system',
  colorblind: false,
  backup: { auto: false, lastBackupAt: null, lastError: null },
  reminders_enabled: true,
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

/**
 * The saved language, or the language of the phone while none was saved (choice 19).
 *
 * @param localeTags The device locales in order of preference, e.g. `['pt-BR', 'fr-FR']`.
 */
export function getLanguage(db: Db, localeTags: readonly string[]): SettingValue<'language'> {
  return readValid(db, 'language') ?? pickLanguage(localeTags);
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

export interface WeekRules {
  readonly weekStart: SettingValue<'week_start'>;
  readonly restDays: SettingValue<'rest_days'>;
}

/** The change of the week rules waiting for its day; null when there is none. */
export function pendingWeekRules(db: Db): WeekRulesChange | null {
  return readValid(db, 'week_rules_next') ?? null;
}

/** The first day of the week and the rest days in force on a game day. */
export function weekRulesOn(db: Db, day: GameDay): WeekRules {
  const pending = pendingWeekRules(db);
  if (pending !== null && day >= pending.from_day) {
    return { weekStart: pending.week_start, restDays: pending.rest_days };
  }
  return { weekStart: getSetting(db, 'week_start'), restDays: getSetting(db, 'rest_days') };
}

/**
 * Puts in force the change of the week rules once its day has come: from then on `week_start`
 * and `rest_days` hold it. The day closing calls it between the days before and after the change.
 */
export function promoteWeekRules(db: Db, day: GameDay, now: number): void {
  const pending = pendingWeekRules(db);
  if (pending === null || day < pending.from_day) {
    return;
  }
  write(db, 'week_start', pending.week_start, now);
  write(db, 'rest_days', pending.rest_days, now);
  db.delete(settings).where(eq(settings.key, 'week_rules_next')).run();
}

/**
 * Changes the first day of the week or the rest days from tomorrow, so the day in progress keeps
 * its rules (design 10.5). Choosing again the rules in force cancels a pending change.
 */
export function setWeekRules(
  db: Db,
  change: Partial<WeekRules>,
  { today, now }: { today: GameDay; now: number },
): void {
  promoteWeekRules(db, today, now);
  const inForce = weekRulesOn(db, today);
  const pending = pendingWeekRules(db);
  const weekStart = change.weekStart ?? pending?.week_start ?? inForce.weekStart;
  const days = [...(change.restDays ?? pending?.rest_days ?? inForce.restDays)].sort(
    (a, b) => a - b,
  );
  const same =
    weekStart === inForce.weekStart &&
    days.length === inForce.restDays.length &&
    days.every((day) => inForce.restDays.includes(day));
  if (same) {
    db.delete(settings).where(eq(settings.key, 'week_rules_next')).run();
    return;
  }
  write(
    db,
    'week_rules_next',
    { week_start: weekStart, rest_days: days, from_day: addDays(today, 1) },
    now,
  );
}

export interface DaySettings {
  readonly today: GameDay;
  /** The day change time in force today. */
  readonly dayChange: string;
  readonly weekRules: WeekRules;
  /** The changes that count from a later day, as the Settings show them («Dal …»). */
  readonly next: {
    readonly dayChange: { readonly value: string; readonly fromDay: GameDay } | null;
    readonly weekRules: (WeekRules & { readonly fromDay: GameDay }) | null;
  };
}

/** The group Giornata of the Settings: the rules of today and the changes from tomorrow. */
export function getDaySettings(
  db: Db,
  { now, tzOffset }: { now: number; tzOffset: number },
): DaySettings {
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(now, tzOffset, dayChange);
  const pending = pendingWeekRules(db);
  return {
    today,
    dayChange: dayChangeOn(dayChange, today),
    weekRules: weekRulesOn(db, today),
    next: {
      dayChange:
        dayChange.next !== null && dayChange.from_day !== null && dayChange.from_day > today
          ? { value: dayChange.next, fromDay: dayChange.from_day }
          : null,
      weekRules:
        pending !== null && pending.from_day > today
          ? {
              weekStart: pending.week_start,
              restDays: pending.rest_days,
              fromDay: pending.from_day,
            }
          : null,
    },
  };
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

/** The draft of the first launch; null when there is none or it is not valid any more. */
export function getOnboardingDraft(db: Db): OnboardingDraft | null {
  return readValid(db, 'onboarding_draft') ?? null;
}

export function setOnboardingDraft(db: Db, draft: OnboardingDraft, now: number): void {
  write(db, 'onboarding_draft', draft, now);
}

export function clearOnboardingDraft(db: Db): void {
  db.delete(settings).where(eq(settings.key, 'onboarding_draft')).run();
}
