import { lastAppliedMigrationAt } from '@/db/migrateWithBackup';
import { getBackupCounts, recordBackupDone, recordBackupFailed } from '@/db/repositories/backup';
import type { BackupErrorCode } from '@/db/repositories/settings';
import type { Db } from '@/db/types';
import { writeBackup } from './backupFile';
import { backupErrorCode, type CloudStore } from './cloudStore';

// A backup from start to end, the same from the page Backup and from the daily task: the bytes of
// the database with its summary into the cloud, then the result in the setting `backup`.

export interface BackupDeps {
  readonly cloud: CloudStore;
  /** The bytes of the open database: `serializeAppDatabase` in the app. */
  readonly serialize: (db: Db) => Uint8Array;
}

/**
 * Makes the backup of `db` and records how it went: null when it worked, otherwise the reason,
 * which the page shows with «Riprova». It never throws.
 */
export async function backUpAndRecord(
  db: Db,
  deps: BackupDeps,
  now: number,
): Promise<BackupErrorCode | null> {
  let code: BackupErrorCode | null;
  try {
    await writeBackup({
      cloud: deps.cloud,
      database: deps.serialize(db),
      schemaVersion: lastAppliedMigrationAt(db),
      counts: getBackupCounts(db),
      now,
    });
    code = null;
  } catch (error) {
    code = backupErrorCode(error);
  }
  try {
    if (code === null) {
      recordBackupDone(db, now);
    } else {
      recordBackupFailed(db, code, now);
    }
  } catch {
    // The database closed meanwhile («Elimina tutti i dati»): there is nothing left to record in.
  }
  return code;
}
