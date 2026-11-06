import { sql } from 'drizzle-orm';

import type { Db } from './types';

// The migrations at start-up, with a safety copy of the database file: if a migration fails,
// the copy comes back and the app shows an error instead of starting with half-migrated data
// (modello-dati.md, section 8). The file operations are behind a small interface, so the tests
// run them with Node's fs and the app with expo-file-system.

/** The file operations needed around a migration. */
export interface DatabaseFiles {
  exists(path: string): boolean;
  /** Copies `from` to `to`, replacing `to` if it exists. */
  copy(from: string, to: string): void;
  /** Deletes the file, if it exists. */
  remove(path: string): void;
}

/** An entry of drizzle/meta/_journal.json. */
export interface JournalEntry {
  /** When drizzle-kit generated the migration, in milliseconds. */
  readonly when: number;
}

export interface MigrateWithBackupOptions<D> {
  /** Path of the database file. */
  readonly path: string;
  readonly files: DatabaseFiles;
  /** The entries of the migration journal. */
  readonly journal: readonly JournalEntry[];
  /** Opens the database file, creating it if needed, and sets its PRAGMAs. */
  open(): D;
  close(db: D): void;
  /** When the last migration applied was generated, or null on a new database. */
  lastAppliedAt(db: D): number | null;
  /** Applies the missing migrations and throws if one of them fails. */
  migrate(db: D): Promise<void> | void;
}

export class MigrationFailedError extends Error {
  constructor(cause: unknown) {
    super('A database migration failed: the previous database has been restored', { cause });
    this.name = 'MigrationFailedError';
  }
}

/** True when the journal has a migration newer than the last one applied. */
export function hasPendingMigrations(
  journal: readonly JournalEntry[],
  lastAppliedAt: number | null,
): boolean {
  if (journal.length === 0) {
    return false;
  }
  const newest = Math.max(...journal.map((entry) => entry.when));
  return lastAppliedAt === null || newest > lastAppliedAt;
}

/** When the last migration applied by Drizzle was generated, or null on a new database. */
export function lastAppliedMigrationAt(db: Db): number | null {
  const table = db.get<{ name: string } | null | undefined>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
  );
  if (!table) {
    return null;
  }
  const row = db.get<{ createdAt: number | null }>(
    sql`SELECT MAX(created_at) AS createdAt FROM __drizzle_migrations`,
  );
  return row.createdAt === null ? null : Number(row.createdAt);
}

/**
 * Opens the database and applies the missing migrations. Before migrating an existing file it
 * makes a copy; if the migration fails it puts the copy back and throws MigrationFailedError. A
 * new database whose first migration fails is deleted, so the next start begins again.
 */
export async function migrateWithBackup<D>(options: MigrateWithBackupOptions<D>): Promise<D> {
  const { path, files } = options;
  const backupPath = `${path}.backup`;
  const existed = files.exists(path);
  let db = options.open();
  if (!hasPendingMigrations(options.journal, options.lastAppliedAt(db))) {
    return db;
  }
  if (existed) {
    // Closing the last connection writes the WAL into the main file, so the copy is complete.
    options.close(db);
    files.copy(path, backupPath);
    db = options.open();
  }
  try {
    await options.migrate(db);
  } catch (error) {
    options.close(db);
    for (const file of [`${path}-wal`, `${path}-shm`, path]) {
      files.remove(file);
    }
    if (existed) {
      files.copy(backupPath, path);
      files.remove(backupPath);
    }
    throw new MigrationFailedError(error);
  }
  if (existed) {
    files.remove(backupPath);
  }
  return db;
}
