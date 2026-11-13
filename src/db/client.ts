import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { File } from 'expo-file-system';
import { defaultDatabaseDirectory, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import migrations from '../../drizzle/migrations';
import { lastAppliedMigrationAt, migrateWithBackup, type DatabaseFiles } from './migrateWithBackup';
import * as schema from './schema';
import type { Db } from './types';
import { deleteDatabaseFiles } from './wipe';

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

const databasePath = () => `${defaultDatabaseDirectory}/${DATABASE_NAME}`;

/** The connections open on the file: the app's and the one of the notification task. */
const connections = new Set<AppDatabase>();

function open(): AppDatabase {
  // The change listener lets Drizzle's useLiveQuery refresh the lists by itself.
  const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const opened = { sqlite, db: drizzle(sqlite, { schema }) };
  connections.add(opened);
  return opened;
}

function close(opened: AppDatabase): void {
  connections.delete(opened);
  opened.sqlite.closeSync();
}

/**
 * Opens the database of the app and applies the missing migrations, with a safety copy of the
 * file that comes back if a migration fails (MigrationFailedError).
 */
export async function openAppDatabase(): Promise<Db> {
  const { db } = await migrateWithBackup<AppDatabase>({
    path: databasePath(),
    files: appFiles,
    journal: migrations.journal.entries,
    open,
    close,
    lastAppliedAt: (opened) => lastAppliedMigrationAt(opened.db),
    migrate: (opened) => migrate(opened.db, migrations),
  });
  return db;
}

/** False once «Elimina tutti i dati» has closed the connection of `db`. */
export function isAppDatabaseOpen(db: Db): boolean {
  return [...connections].some((opened) => opened.db === db);
}

/**
 * Closes every connection to the database and deletes its files («Elimina tutti i dati»). The
 * next `openAppDatabase` creates a new empty database with the migrations.
 */
export function deleteAppDatabase(): void {
  for (const opened of [...connections]) {
    close(opened);
  }
  deleteDatabaseFiles(databasePath(), appFiles);
}
