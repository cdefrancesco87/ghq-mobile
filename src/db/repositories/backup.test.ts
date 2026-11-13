import {
  getBackupCounts,
  getPhoneSettings,
  keepPhoneSettings,
  recordBackupDone,
  recordBackupFailed,
  setAutoBackup,
} from '@/db/repositories/backup';
import { archiveMission, deleteMission } from '@/db/repositories/missions';
import { getDeviceId, getSetting } from '@/db/repositories/settings';
import { hero, settings } from '@/db/schema';

import { createTestDb } from '../../../test/db';
import { clockAt, missionId, newGame } from '../../../test/game';

const NOW = Date.UTC(2026, 10, 9, 5, 12);

describe('getBackupCounts', () => {
  it('counts the missions that are not archived or deleted and gives the level', () => {
    const db = newGame(['drink_water', 'healthy_meal', 'bed_by_eleven', 'run']);
    archiveMission(db, missionId(db, 'run'), clockAt(7, 9));
    deleteMission(db, missionId(db, 'bed_by_eleven'), clockAt(7, 9));
    db.update(hero).set({ level: 7 }).run();

    expect(getBackupCounts(db)).toEqual({ missions: 2, level: 7 });
  });

  it('gives no missions and level 1 before the first launch', () => {
    expect(getBackupCounts(createTestDb())).toEqual({ missions: 0, level: 1 });
  });
});

describe('the backup setting', () => {
  it('turns the automatic backup on and off, keeping the rest', () => {
    const db = createTestDb();
    recordBackupDone(db, NOW);
    setAutoBackup(db, true, NOW);
    expect(getSetting(db, 'backup')).toEqual({ auto: true, lastBackupAt: NOW, lastError: null });
    setAutoBackup(db, false, NOW);
    expect(getSetting(db, 'backup').auto).toBe(false);
  });

  it('keeps the last backup when an attempt fails, and clears the error with the next one', () => {
    const db = createTestDb();
    recordBackupDone(db, NOW);
    recordBackupFailed(db, 'no_space', NOW + 1000);
    expect(getSetting(db, 'backup')).toEqual({
      auto: false,
      lastBackupAt: NOW,
      lastError: { at: NOW + 1000, code: 'no_space' },
    });

    recordBackupDone(db, NOW + 2000);
    expect(getSetting(db, 'backup')).toEqual({
      auto: false,
      lastBackupAt: NOW + 2000,
      lastError: null,
    });
  });

  it('reads a setting saved before the error was kept', () => {
    const db = createTestDb();
    db.insert(settings)
      .values({ key: 'backup', value: { auto: true, lastBackupAt: NOW }, updatedAt: NOW })
      .run();
    expect(getSetting(db, 'backup')).toEqual({ auto: true, lastBackupAt: NOW, lastError: null });
  });
});

describe('the settings of the phone across a restore', () => {
  it('writes the backup state and the device id of this phone into the restored data', () => {
    const phone = createTestDb();
    const deviceId = getDeviceId(phone, NOW);
    setAutoBackup(phone, true, NOW);
    recordBackupDone(phone, NOW);
    const restored = createTestDb();
    getDeviceId(restored, NOW - 1000);

    keepPhoneSettings(restored, getPhoneSettings(phone), NOW + 1000);

    expect(getSetting(restored, 'backup')).toEqual({
      auto: true,
      lastBackupAt: NOW,
      lastError: null,
    });
    expect(getDeviceId(restored, NOW)).toBe(deviceId);
  });

  it('keeps the device id of the backup when this phone has none yet', () => {
    const restored = createTestDb();
    const deviceId = getDeviceId(restored, NOW);

    keepPhoneSettings(restored, getPhoneSettings(createTestDb()), NOW + 1000);

    expect(getDeviceId(restored, NOW)).toBe(deviceId);
  });
});
