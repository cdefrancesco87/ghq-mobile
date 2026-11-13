import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';

import type { BackupCounts } from '@/db/repositories/backup';
import { BackupError, type CloudStore } from './cloudStore';

// The backup in the cloud (US-IMP-03; stack-tecnologico.md point 4; modello-dati.md section 8):
// one backup only, replaced every time (gap L21), made of the database compressed with gzip and,
// next to it, a small summary read before the restore: date, missions, level and the version of
// the schema. A backup of a newer app is refused; an older one is restored and then migrated by
// the normal start of the database.

export const BACKUP_DATA_FILE = 'ghq-backup.db.gz';
export const BACKUP_SUMMARY_FILE = 'ghq-backup.json';
const FORMAT = 1;

/** «SQLite format 3» and a zero: the first 16 bytes of every SQLite database. */
const SQLITE_HEADER = strToU8('SQLite format 3\0');

const summarySchema = z.object({
  format: z.literal(FORMAT),
  /** When the backup was made, in milliseconds. */
  createdAt: z.number().int(),
  /** When the last migration of the database was generated (Drizzle journal); null if none. */
  schemaVersion: z.number().int().nullable(),
  missions: z.number().int().min(0),
  level: z.number().int().min(1),
  /** Length of the compressed database: a summary and a file of two different backups differ. */
  size: z.number().int().min(0),
});

export type BackupSummary = z.infer<typeof summarySchema>;

export interface MakeBackupInput {
  readonly cloud: CloudStore;
  /** The bytes of the database file (`serialize` of SQLite). */
  readonly database: Uint8Array;
  readonly schemaVersion: number | null;
  readonly counts: BackupCounts;
  readonly now: number;
}

/**
 * Writes the backup in the cloud: first the database, then the summary, so a summary always
 * speaks of a database that is already there.
 */
export async function writeBackup(input: MakeBackupInput): Promise<BackupSummary> {
  const data = gzipSync(input.database);
  const summary: BackupSummary = {
    format: FORMAT,
    createdAt: input.now,
    schemaVersion: input.schemaVersion,
    missions: input.counts.missions,
    level: input.counts.level,
    size: data.length,
  };
  await input.cloud.write(BACKUP_DATA_FILE, data);
  await input.cloud.write(BACKUP_SUMMARY_FILE, strToU8(JSON.stringify(summary)));
  return summary;
}

/** The summary of the backup in the cloud, or null when there is no backup. */
export async function readBackupSummary(cloud: CloudStore): Promise<BackupSummary | null> {
  const bytes = await cloud.read(BACKUP_SUMMARY_FILE);
  if (bytes === null) {
    return null;
  }
  try {
    const parsed = summarySchema.safeParse(JSON.parse(strFromU8(bytes)));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Not JSON: the same answer as a summary that is not valid.
  }
  throw new BackupError('corrupt');
}

/** True when the backup comes from an app with a newer database than this one. */
export function isNewerThanApp(summary: BackupSummary, appSchemaVersion: number | null): boolean {
  return (
    summary.schemaVersion !== null &&
    (appSchemaVersion === null || summary.schemaVersion > appSchemaVersion)
  );
}

/**
 * The database of the backup described by `summary`, ready to take the place of the one on the
 * phone. It refuses a backup of a newer app and a file that is missing or damaged.
 */
export async function readBackupDatabase(
  cloud: CloudStore,
  summary: BackupSummary,
  appSchemaVersion: number | null,
): Promise<Uint8Array> {
  if (isNewerThanApp(summary, appSchemaVersion)) {
    throw new BackupError('newer');
  }
  const data = await cloud.read(BACKUP_DATA_FILE);
  if (data === null) {
    throw new BackupError('missing');
  }
  if (data.length !== summary.size) {
    throw new BackupError('corrupt');
  }
  let database: Uint8Array;
  try {
    database = gunzipSync(data);
  } catch (error) {
    throw new BackupError('corrupt', { cause: error });
  }
  const isSqlite =
    database.length >= SQLITE_HEADER.length &&
    SQLITE_HEADER.every((byte, index) => database[index] === byte);
  if (!isSqlite) {
    throw new BackupError('corrupt');
  }
  return database;
}
