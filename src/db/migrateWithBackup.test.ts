import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  MigrationFailedError,
  hasPendingMigrations,
  lastAppliedMigrationAt,
  migrateWithBackup,
  type DatabaseFiles,
  type MigrateWithBackupOptions,
} from '@/db/migrateWithBackup';
import * as schema from '@/db/schema';

import journal from '../../drizzle/meta/_journal.json';
import { MIGRATIONS_FOLDER } from '../../test/db';

const nodeFiles: DatabaseFiles = {
  exists: (file) => fs.existsSync(file),
  copy: (from, to) => fs.copyFileSync(from, to),
  remove: (file) => fs.rmSync(file, { force: true }),
};

function openFileDb(file: string) {
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

type FileDb = ReturnType<typeof openFileDb>;

const newestMigrationAt = Math.max(...journal.entries.map((entry) => entry.when));

describe('hasPendingMigrations', () => {
  const entries = [{ when: 100 }, { when: 200 }];

  it('is true on a new database and when the journal has newer migrations', () => {
    expect(hasPendingMigrations(entries, null)).toBe(true);
    expect(hasPendingMigrations(entries, 100)).toBe(true);
  });

  it('is false when the newest migration is applied or there are none', () => {
    expect(hasPendingMigrations(entries, 200)).toBe(false);
    expect(hasPendingMigrations([], null)).toBe(false);
  });
});

describe('migrateWithBackup', () => {
  let dir: string;
  let file: string;

  function options(
    overrides: Partial<MigrateWithBackupOptions<FileDb>> = {},
  ): MigrateWithBackupOptions<FileDb> {
    return {
      path: file,
      files: nodeFiles,
      journal: journal.entries,
      open: () => openFileDb(file),
      close: (db) => db.$client.close(),
      lastAppliedAt: (db) => lastAppliedMigrationAt(db),
      migrate: (db) => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
      ...overrides,
    };
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghq-db-'));
    file = path.join(dir, 'ghq.db');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates and migrates a new database without leaving a copy', async () => {
    const db = await migrateWithBackup(options());
    expect(lastAppliedMigrationAt(db)).toBe(newestMigrationAt);
    db.$client.close();
    expect(fs.existsSync(`${file}.backup`)).toBe(false);
  });

  it('does not migrate nor copy when no migration is missing', async () => {
    (await migrateWithBackup(options())).$client.close();
    const migrateSpy = jest.fn();
    const copySpy = jest.fn();
    const db = await migrateWithBackup(
      options({ migrate: migrateSpy, files: { ...nodeFiles, copy: copySpy } }),
    );
    expect(migrateSpy).not.toHaveBeenCalled();
    expect(copySpy).not.toHaveBeenCalled();
    db.$client.close();
  });

  it('restores the copy of the database when a migration fails', async () => {
    const first = await migrateWithBackup(options());
    first.insert(schema.badges).values({ badgeKey: 'first_step', unlockedAt: 1 }).run();
    first.$client.close();

    // A newer migration that changes the data and then fails halfway.
    const newerJournal = [...journal.entries, { when: newestMigrationAt + 1000 }];
    const failing = options({
      journal: newerJournal,
      migrate: (db) => {
        db.run(sql`CREATE TABLE broken (id INTEGER)`);
        db.run(sql`DELETE FROM badges`);
        throw new Error('broken migration');
      },
    });
    await expect(migrateWithBackup(failing)).rejects.toThrow(MigrationFailedError);

    const restored = openFileDb(file);
    expect(restored.select().from(schema.badges).all()).toEqual([
      { badgeKey: 'first_step', unlockedAt: 1 },
    ]);
    expect(restored.all(sql`SELECT name FROM sqlite_master WHERE name = 'broken'`)).toEqual([]);
    restored.$client.close();
    expect(fs.existsSync(`${file}.backup`)).toBe(false);
  });

  it('removes a new database whose first migration fails, so the next start begins again', async () => {
    const failing = options({
      migrate: () => {
        throw new Error('broken migration');
      },
    });
    await expect(migrateWithBackup(failing)).rejects.toThrow(MigrationFailedError);
    expect(fs.existsSync(file)).toBe(false);
  });
});
