import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  lastAppliedMigrationAt,
  migrateWithBackup,
  type MigrateWithBackupOptions,
} from '@/db/migrateWithBackup';
import {
  dropPreviousDatabase,
  previousCopyOf,
  putBackPreviousDatabase,
  replaceDatabaseFile,
  type RestoreFiles,
} from '@/db/restore';
import * as schema from '@/db/schema';

import journal from '../../drizzle/meta/_journal.json';
import { MIGRATIONS_FOLDER, serializeTestDb } from '../../test/db';

// A restore on real files: the database of the backup takes the place of the one of the phone,
// is migrated if it is older, and the old one comes back if the new one does not open.

const nodeFiles: RestoreFiles = {
  exists: (file) => fs.existsSync(file),
  copy: (from, to) => fs.copyFileSync(from, to),
  remove: (file) => fs.rmSync(file, { force: true }),
  write: (file, bytes) => fs.writeFileSync(file, bytes),
};

const NEWEST = Math.max(...journal.entries.map((entry) => entry.when));

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghq-restore-'));
  file = path.join(dir, 'ghq.db');
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const openFileDb = () => {
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
};
type FileDb = ReturnType<typeof openFileDb>;

const options = (): MigrateWithBackupOptions<FileDb> => ({
  path: file,
  files: nodeFiles,
  journal: journal.entries,
  open: openFileDb,
  close: (db) => db.$client.close(),
  lastAppliedAt: (db) => lastAppliedMigrationAt(db),
  migrate: (db) => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
});

/** A database in memory with only the first migration: a backup of an older app. */
function olderBackup(): Uint8Array {
  const folder = path.join(dir, 'old-migrations');
  fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
  const first = journal.entries[0];
  fs.copyFileSync(
    path.join(MIGRATIONS_FOLDER, `${first.tag}.sql`),
    path.join(folder, `${first.tag}.sql`),
  );
  fs.writeFileSync(
    path.join(folder, 'meta', '_journal.json'),
    JSON.stringify({ ...journal, entries: [first] }),
  );
  const db = drizzle(new Database(':memory:'), { schema });
  migrate(db, { migrationsFolder: folder });
  db.insert(schema.settings).values({ key: 'theme', value: 'arcade', updatedAt: 1 }).run();
  return serializeTestDb(db);
}

async function phoneDatabase(theme: string): Promise<void> {
  const db = await migrateWithBackup(options());
  db.insert(schema.settings).values({ key: 'theme', value: theme, updatedAt: 1 }).run();
  db.$client.close();
}

const themeOf = (db: FileDb) =>
  db
    .select()
    .from(schema.settings)
    .all()
    .find((row) => row.key === 'theme')?.value;

describe('replaceDatabaseFile', () => {
  it('puts an older backup in place, which the start of the database migrates', async () => {
    await phoneDatabase('fantasy');
    const backup = olderBackup();

    replaceDatabaseFile(file, backup, nodeFiles);
    const restored = await migrateWithBackup(options());

    expect(lastAppliedMigrationAt(restored)).toBe(NEWEST);
    expect(themeOf(restored)).toBe('arcade');
    expect(fs.existsSync(previousCopyOf(file))).toBe(true);
    restored.$client.close();

    dropPreviousDatabase(file, nodeFiles);
    expect(fs.readdirSync(dir).filter((name) => name.startsWith('ghq.db'))).toEqual(['ghq.db']);
  });

  it('works on a phone without a database yet', async () => {
    replaceDatabaseFile(file, olderBackup(), nodeFiles);
    const restored = await migrateWithBackup(options());
    expect(themeOf(restored)).toBe('arcade');
    restored.$client.close();
  });
});

describe('putBackPreviousDatabase', () => {
  it('brings back the database of the phone when the restored one does not open', async () => {
    await phoneDatabase('fantasy');
    replaceDatabaseFile(file, new Uint8Array([1, 2, 3]), nodeFiles);
    await expect(migrateWithBackup(options())).rejects.toThrow();

    putBackPreviousDatabase(file, nodeFiles);
    const back = await migrateWithBackup(options());

    expect(themeOf(back)).toBe('fantasy');
    expect(fs.existsSync(previousCopyOf(file))).toBe(false);
    back.$client.close();
  });
});
