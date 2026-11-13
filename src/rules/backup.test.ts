import { isAutoBackupDue } from './backup';
import { BACKUP } from './config';

const NOW = Date.UTC(2026, 10, 9, 5, 12);
const HOUR = 3_600_000;

describe('isAutoBackupDue', () => {
  it('never runs while the automatic backup is off', () => {
    expect(isAutoBackupDue({ auto: false, lastBackupAt: null }, NOW)).toBe(false);
  });

  it('runs when there is no backup yet', () => {
    expect(isAutoBackupDue({ auto: true, lastBackupAt: null }, NOW)).toBe(true);
  });

  it('waits until the last backup is old enough', () => {
    const gap = BACKUP.autoMinGapHours * HOUR;
    expect(isAutoBackupDue({ auto: true, lastBackupAt: NOW - gap + 1 }, NOW)).toBe(false);
    expect(isAutoBackupDue({ auto: true, lastBackupAt: NOW - gap }, NOW)).toBe(true);
  });
});
