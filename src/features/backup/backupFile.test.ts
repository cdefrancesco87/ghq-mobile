import { gzipSync, strToU8 } from 'fflate';

import { getBackupCounts } from '@/db/repositories/backup';
import { completeMission } from '@/db/repositories/completion';
import { lastAppliedMigrationAt } from '@/db/migrateWithBackup';
import { events, hero, heroStats, missions } from '@/db/schema';
import {
  BACKUP_DATA_FILE,
  BACKUP_SUMMARY_FILE,
  isNewerThanApp,
  readBackupDatabase,
  readBackupSummary,
  writeBackup,
} from '@/features/backup/backupFile';
import { BackupError, backupErrorCode, createMemoryCloudStore } from '@/features/backup/cloudStore';

import { openTestDbFrom, serializeTestDb } from '../../../test/db';
import { clockAt, missionId, newGame } from '../../../test/game';

const NOW = Date.UTC(2026, 10, 9, 5, 12);

function playedGame() {
  const db = newGame(['drink_water', 'healthy_meal', 'run']);
  completeMission(db, {
    missionId: missionId(db, 'drink_water'),
    source: 'app',
    ...clockAt(6, 10),
  });
  completeMission(db, { missionId: missionId(db, 'run'), source: 'app', ...clockAt(6, 11) });
  return db;
}

async function backUp(db = playedGame(), cloud = createMemoryCloudStore()) {
  const summary = await writeBackup({
    cloud,
    database: serializeTestDb(db),
    schemaVersion: lastAppliedMigrationAt(db),
    counts: getBackupCounts(db),
    now: NOW,
  });
  return { db, cloud, summary };
}

const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => backupErrorCode(error),
  );

describe('backup and restore', () => {
  it('give back the same hero, stats, missions and event log', async () => {
    const { db, cloud, summary } = await backUp();
    const version = lastAppliedMigrationAt(db);

    const read = await readBackupSummary(cloud);
    expect(read).toEqual(summary);
    const restored = openTestDbFrom(await readBackupDatabase(cloud, read!, version));

    expect(restored.select().from(hero).all()).toEqual(db.select().from(hero).all());
    expect(restored.select().from(heroStats).all()).toEqual(db.select().from(heroStats).all());
    expect(restored.select().from(missions).all()).toEqual(db.select().from(missions).all());
    expect(restored.select().from(events).all()).toEqual(db.select().from(events).all());
    expect(restored.select().from(events).all().length).toBeGreaterThan(2);
  });

  it('keep one backup, replaced by the next one', async () => {
    const { cloud } = await backUp();
    const other = newGame(['drink_water']);
    await backUp(other, cloud);

    expect([...cloud.files.keys()].sort()).toEqual([BACKUP_SUMMARY_FILE, BACKUP_DATA_FILE].sort());
    expect((await readBackupSummary(cloud))?.missions).toBe(1);
  });

  it('write a summary with date, missions, level and schema version', async () => {
    const { db, summary } = await backUp();
    expect(summary).toEqual({
      format: 1,
      createdAt: NOW,
      schemaVersion: lastAppliedMigrationAt(db),
      missions: 3,
      level: db.select().from(hero).get()!.level,
      size: expect.any(Number),
    });
  });
});

describe('readBackupSummary', () => {
  it('gives null when there is no backup', async () => {
    expect(await readBackupSummary(createMemoryCloudStore())).toBeNull();
  });

  it('refuses a summary that is not valid', async () => {
    const cloud = createMemoryCloudStore();
    cloud.files.set(BACKUP_SUMMARY_FILE, strToU8('{"format": 1}'));
    expect(await failure(readBackupSummary(cloud))).toBe('corrupt');
    cloud.files.set(BACKUP_SUMMARY_FILE, strToU8('not json'));
    expect(await failure(readBackupSummary(cloud))).toBe('corrupt');
  });

  it('passes on the failure of the cloud', async () => {
    const cloud = createMemoryCloudStore();
    cloud.failNext = 'offline';
    expect(await failure(readBackupSummary(cloud))).toBe('offline');
  });
});

describe('readBackupDatabase', () => {
  it('refuses a backup of a newer app', async () => {
    const { cloud, summary } = await backUp();
    expect(await failure(readBackupDatabase(cloud, summary, summary.schemaVersion! - 1))).toBe(
      'newer',
    );
  });

  it('accepts a backup of an older app, migrated when the database opens', async () => {
    const { cloud, summary } = await backUp();
    const bytes = await readBackupDatabase(cloud, summary, summary.schemaVersion! + 1);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('refuses a missing or damaged database', async () => {
    const { cloud, summary } = await backUp();
    const version = summary.schemaVersion;
    const data = cloud.files.get(BACKUP_DATA_FILE)!;

    cloud.files.set(BACKUP_DATA_FILE, data.slice(0, 10));
    expect(await failure(readBackupDatabase(cloud, summary, version))).toBe('corrupt');

    const notSqlite = gzipSync(strToU8('hello'));
    cloud.files.set(BACKUP_DATA_FILE, notSqlite);
    expect(
      await failure(readBackupDatabase(cloud, { ...summary, size: notSqlite.length }, version)),
    ).toBe('corrupt');

    const notGzip = strToU8('x'.repeat(summary.size));
    cloud.files.set(BACKUP_DATA_FILE, notGzip);
    expect(await failure(readBackupDatabase(cloud, summary, version))).toBe('corrupt');

    cloud.files.delete(BACKUP_DATA_FILE);
    expect(await failure(readBackupDatabase(cloud, summary, version))).toBe('missing');
  });
});

describe('isNewerThanApp', () => {
  const summary = {
    format: 1 as const,
    createdAt: NOW,
    schemaVersion: 20,
    missions: 0,
    level: 1,
    size: 0,
  };

  it('compares the schema of the backup with the one of the app', () => {
    expect(isNewerThanApp(summary, 19)).toBe(true);
    expect(isNewerThanApp(summary, 20)).toBe(false);
    expect(isNewerThanApp(summary, 21)).toBe(false);
    expect(isNewerThanApp({ ...summary, schemaVersion: null }, 20)).toBe(false);
  });
});

describe('backupErrorCode', () => {
  it('gives the reason of a BackupError and unknown for anything else', () => {
    expect(backupErrorCode(new BackupError('no_space'))).toBe('no_space');
    expect(backupErrorCode(new Error('boom'))).toBe('unknown');
  });
});
