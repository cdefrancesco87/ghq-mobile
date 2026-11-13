import type { DatabaseFiles } from './migrateWithBackup';

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

/**
 * Puts `bytes` in place of the database at `path`, keeping the old file aside. The connections
 * must be closed first: closing the last one writes the WAL into the main file.
 */
export function replaceDatabaseFile(path: string, bytes: Uint8Array, files: RestoreFiles): void {
  const previous = previousCopyOf(path);
  files.remove(previous);
  if (files.exists(path)) {
    files.copy(path, previous);
  }
  for (const file of liveFilesOf(path)) {
    files.remove(file);
  }
  files.write(path, bytes);
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
