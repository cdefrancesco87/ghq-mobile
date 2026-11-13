import { BACKUP } from './config';

const MS_PER_HOUR = 3_600_000;

/**
 * True when the daily automatic backup should run now: it is on and the last backup is at least
 * `BACKUP.autoMinGapHours` old, or there is none (US-IMP-03; design-sezioni.md 10.8).
 */
export function isAutoBackupDue(
  backup: { readonly auto: boolean; readonly lastBackupAt: number | null },
  now: number,
): boolean {
  if (!backup.auto) {
    return false;
  }
  return (
    backup.lastBackupAt === null ||
    now - backup.lastBackupAt >= BACKUP.autoMinGapHours * MS_PER_HOUR
  );
}
