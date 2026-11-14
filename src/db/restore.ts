import { hasPendingMigrations, type DatabaseFiles, type JournalEntry } from './migrateWithBackup';

// The file side of a restore (US-IMP-03; modello-dati.md section 8): the database of the backup
// takes the place of the one on the phone, which is kept aside until the restored one has opened
// and migrated. If that fails, the old one comes back. Like the migrations, the file operations
// are behind an interface, so the tests run them with Node's fs.

/** The file operations of a restore: those of a migration, plus writing the bytes of a file. */
export interface RestoreFiles extends DatabaseFiles {
  /** Writes `bytes` to `path`, replacing the file if it exists. */
  write(path: string, bytes: Uint8Array): void;
}

/** Where the database of the phone waits while the restored one opens. */
export const previousCopyOf = (path: string) => `${path}.previous`;

const liveFilesOf = (path: string) => [`${path}-wal`, `${path}-shm`, path];

/** How to look into a database file: the same operations as a migration at the start. */
export interface DatabaseCheck<D> {
  readonly journal: readonly JournalEntry[];
  open(): D;
  close(db: D): void;
  lastAppliedAt(db: D): number | null;
}

/**
 * True when the database file opens and has every migration of the app: a restore that got this
 * far is complete. A file that does not open, or a backup not migrated yet, is not.
 */
export function isMigratedDatabase<D>(check: DatabaseCheck<D>): boolean {
  let db: D;
  try {
    db = check.open();
  } catch {
    return false;
  }
  try {
    return !hasPendingMigrations(check.journal, check.lastAppliedAt(db));
  } catch {
    return false;
  } finally {
    try {
      check.close(db);
    } catch {
      // A file that is not a database may refuse to close cleanly: it is not valid anyway.
    }
  }
}

/**
 * Puts `bytes` in place of the database at `path`, keeping the old file aside. The connections
 * must be closed first: closing the last one writes the WAL into the main file. A copy already
 * aside, left by a restore cut short, is the real data while the live file is not valid: it is
 * kept, never replaced by that file.
 */
export function replaceDatabaseFile(
  path: string,
  bytes: Uint8Array,
  files: RestoreFiles,
  liveIsValid: () => boolean,
): void {
  const previous = previousCopyOf(path);
  const keepPrevious = files.exists(previous) && !(files.exists(path) && liveIsValid());
  if (!keepPrevious) {
    files.remove(previous);
    if (files.exists(path)) {
      files.copy(path, previous);
    }
  }
  for (const file of liveFilesOf(path)) {
    files.remove(file);
  }
  files.write(path, bytes);
}

/** What the start did with a restore cut short. */
export type InterruptedRestore = 'none' | 'kept_restored' | 'put_back';

/**
 * At the start, before opening the database: a copy aside means a restore stopped half way (the
 * app was killed). If the live database is there, opens and is migrated, the restore was complete
 * and the copy goes; otherwise the database of the phone comes back. The connections must be
 * closed.
 */
export function recoverInterruptedRestore(
  path: string,
  files: RestoreFiles,
  liveIsValid: () => boolean,
): InterruptedRestore {
  if (!files.exists(previousCopyOf(path))) {
    return 'none';
  }
  if (files.exists(path) && liveIsValid()) {
    dropPreviousDatabase(path, files);
    return 'kept_restored';
  }
  putBackPreviousDatabase(path, files);
  return 'put_back';
}

/**
 * Brings back the database the phone had before `replaceDatabaseFile`, when the restored one did
 * not open. The connections must be closed first.
 */
export function putBackPreviousDatabase(path: string, files: RestoreFiles): void {
  const previous = previousCopyOf(path);
  for (const file of liveFilesOf(path)) {
    files.remove(file);
  }
  if (files.exists(previous)) {
    files.copy(previous, path);
    files.remove(previous);
  }
}

/** Deletes the old database once the restored one is open. */
export function dropPreviousDatabase(path: string, files: RestoreFiles): void {
  files.remove(previousCopyOf(path));
}
