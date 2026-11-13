import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  lastAppliedMigrationAt,
  migrateWithBackup,
  type DatabaseFiles,
  type MigrateWithBackupOptions,
} from '@/db/migrateWithBackup';
import * as schema from '@/db/schema';
import { databaseFilesOf, deleteDatabaseFiles } from '@/db/wipe';

import journal from '../../drizzle/meta/_journal.json';
import { MIGRATIONS_FOLDER } from '../../test/db';

/** A file system in memory: the set of the paths that exist. */
function fakeFiles(paths: string[]): DatabaseFiles & { readonly paths: Set<string> } {
  const set = new Set(paths);
  return {
    paths: set,
    exists: (file) => set.has(file),
    copy: (_from, to) => void set.add(to),
    remove: (file) => void set.delete(file),
  };
}

const nodeFiles: DatabaseFiles = {
  exists: (file) => fs.existsSync(file),
  copy: (from, to) => fs.copyFileSync(from, to),
  remove: (file) => fs.rmSync(file, { force: true }),
};

describe('deleteDatabaseFiles', () => {
  it('deletes the database, its WAL files and the safety copy, and nothing else', () => {
    const files = fakeFiles([...databaseFilesOf('/data/ghq.db'), '/data/other.db']);

    deleteDatabaseFiles('/data/ghq.db', files);

    expect([...files.paths]).toEqual(['/data/other.db']);
  });

  it('does not fail when some files are missing', () => {
    const files = fakeFiles(['/data/ghq.db']);
    deleteDatabaseFiles('/data/ghq.db', files);
    expect(files.paths.size).toBe(0);
  });

  describe('on a real file', () => {
    let dir: string;
    let file: string;

    const openFileDb = () => {
      const sqlite = new Database(file);
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('foreign_keys = ON');
      return drizzle(sqlite, { schema });
    };

    const options = (): MigrateWithBackupOptions<ReturnType<typeof openFileDb>> => ({
      path: file,
      files: nodeFiles,
      journal: journal.entries,
      open: openFileDb,
      close: (db) => db.$client.close(),
      lastAppliedAt: (db) => lastAppliedMigrationAt(db),
      migrate: (db) => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    });

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ghq-wipe-'));
      file = path.join(dir, 'ghq.db');
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('lets the next start create an empty database with the migrations', async () => {
      const old = await migrateWithBackup(options());
      old.insert(schema.badges).values({ badgeKey: 'first_step', unlockedAt: 1 }).run();
      old.insert(schema.settings).values({ key: 'theme', value: 'arcade', updatedAt: 1 }).run();
      old.$client.close();

      deleteDatabaseFiles(file, nodeFiles);
      expect(fs.readdirSync(dir)).toEqual([]);

      const fresh = await migrateWithBackup(options());
      expect(lastAppliedMigrationAt(fresh)).toBe(Math.max(...journal.entries.map((e) => e.when)));
      expect(fresh.select().from(schema.badges).all()).toEqual([]);
      expect(fresh.select().from(schema.settings).all()).toEqual([]);
      expect(fresh.select().from(schema.events).all()).toEqual([]);
      fresh.$client.close();
    });
  });
});
