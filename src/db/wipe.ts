import type { DatabaseFiles } from './migrateWithBackup';

// «Elimina tutti i dati» (US-IMP-05; modello-dati.md 4.3): the event log refuses DELETE, so the
// only way to start again from zero is to delete the whole file. Like the migrations, the file
// operations are behind `DatabaseFiles`, so the tests run them without expo-file-system.

/** The files of a database in WAL mode, with the safety copy of a migration. */
export function databaseFilesOf(path: string): readonly string[] {
  return [path, `${path}-wal`, `${path}-shm`, `${path}.backup`];
}

/** Deletes every file of the database at `path`; the connections must be closed first. */
export function deleteDatabaseFiles(path: string, files: DatabaseFiles): void {
  for (const file of databaseFilesOf(path)) {
    files.remove(file);
  }
}
