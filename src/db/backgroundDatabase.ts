import { isAppDatabaseOpen, openAppDatabase } from './client';
import type { Db } from './types';

// The database of the tasks that run in the background (notification actions, daily backup),
// when the app may not be running: opened once, and again after «Elimina tutti i dati» or a
// restore has closed it.

let backgroundDb: Promise<Db> | null = null;

/** The open database for a background task. */
export function databaseForTask(): Promise<Db> {
  backgroundDb ??= openAppDatabase().catch((error: unknown) => {
    backgroundDb = null;
    throw error;
  });
  return backgroundDb.then((db) => {
    if (isAppDatabaseOpen(db)) {
      return db;
    }
    backgroundDb = null;
    return databaseForTask();
  });
}
