import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { lastAppliedMigrationAt, migrateWithBackup, type DatabaseFiles } from './migrateWithBackup';
import * as schema from './schema';
import type { Db } from './types';

export const DATABASE_NAME = 'ghq.db';

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/** The file operations of the app, with expo-file-system. */
const appFiles: DatabaseFiles = {
  exists: (path) => new File(fileUri(path)).exists,
  copy: (from, to) => new File(fileUri(from)).copySync(new File(fileUri(to)), { overwrite: true }),
  remove: (path) => {
    const file = new File(fileUri(path));
    if (file.exists) {
      file.delete();
    }
  },
};

interface AppDatabase {
  readonly sqlite: SQLiteDatabase;
  readonly db: ExpoSQLiteDatabase<typeof schema>;
}

function open(): AppDatabase {
  // The change listener lets Drizzle's useLiveQuery refresh the lists by itself.
  const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

/**
 * Opens the database of the app and applies the missing migrations, with a safety copy of the
 * file that comes back if a migration fails (MigrationFailedError).
 */
export async function openAppDatabase(): Promise<Db> {
  const { db } = await migrateWithBackup<AppDatabase>({
    path: `${defaultDatabaseDirectory}/${DATABASE_NAME}`,
    files: appFiles,
    journal: migrations.journal.entries,
    open,
    close: ({ sqlite }) => sqlite.closeSync(),
    lastAppliedAt: (opened) => lastAppliedMigrationAt(opened.db),
    migrate: (opened) => migrate(opened.db, migrations),
  });
  return db;
}
