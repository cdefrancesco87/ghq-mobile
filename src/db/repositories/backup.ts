import { and, count, eq, ne } from 'drizzle-orm';

import { hero, missions, settings } from '../schema';
import type { Db } from '../types';
import { notDeleted } from './events';
import { getSetting, setSetting, type BackupErrorCode, type SettingValue } from './settings';

// The data of the backup in the cloud (US-IMP-03; design-sezioni.md 10.8): the summary shown
// before a restore and the state of the last attempt, kept in the setting `backup`.

/** What the preview of a restore shows next to the date (US-IMP-03). */
export interface BackupCounts {
  /**
   * The missions of the hero: not deleted and not archived, as «N attive» in Abitudini.
   * PROVISIONAL (backlog T57): the documents say only «numero di missioni».
   */
  readonly missions: number;
  /** The level of the hero; 1 before the first launch. */
  readonly level: number;
}

export function getBackupCounts(db: Db): BackupCounts {
  const row = db
    .select({ total: count() })
    .from(missions)
    .where(and(notDeleted(missions), ne(missions.status, 'archived')))
    .get();
  const level = db.select({ level: hero.level }).from(hero).get()?.level ?? 1;
  return { missions: row?.total ?? 0, level };
}

/** The daily automatic backup on or off; it stays off until the user turns it on. */
export function setAutoBackup(db: Db, auto: boolean, now: number): void {
  setSetting(db, 'backup', { ...getSetting(db, 'backup'), auto }, now);
}

/** A backup that worked: it becomes the last one and clears the error of an earlier attempt. */
export function recordBackupDone(db: Db, now: number): void {
  setSetting(
    db,
    'backup',
    { ...getSetting(db, 'backup'), lastBackupAt: now, lastError: null },
    now,
  );
}

/** A backup that failed: the page explains it in one line with «Riprova». */
export function recordBackupFailed(db: Db, code: BackupErrorCode, now: number): void {
  setSetting(db, 'backup', { ...getSetting(db, 'backup'), lastError: { at: now, code } }, now);
}

/**
 * The settings that belong to this phone and not to the data: a restore keeps them. The backup
 * state speaks of this phone's cloud, the device id marks the events written here.
 * PROVISIONAL (backlog T57): the documents do not say what a restore keeps.
 */
export interface PhoneSettings {
  readonly backup: SettingValue<'backup'>;
  readonly deviceId: string | null;
}

export function getPhoneSettings(db: Db): PhoneSettings {
  const device = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, 'device_id'))
    .get();
  return {
    backup: getSetting(db, 'backup'),
    deviceId: typeof device?.value === 'string' && device.value !== '' ? device.value : null,
  };
}

/** Writes the settings of this phone into a database just restored. */
export function keepPhoneSettings(db: Db, phone: PhoneSettings, now: number): void {
  db.transaction((tx) => {
    setSetting(tx, 'backup', phone.backup, now);
    if (phone.deviceId !== null) {
      tx.insert(settings)
        .values({ key: 'device_id', value: phone.deviceId, updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: phone.deviceId, updatedAt: now },
        })
        .run();
    }
  });
}
