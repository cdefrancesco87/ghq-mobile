import i18next from 'i18next';

import { backupWhen } from '@/features/backup/format';
import { createI18n } from '@/i18n';

const clock = { now: Date.UTC(2026, 10, 6, 11, 0), tzOffset: 60 };

describe('backupWhen', () => {
  let t: typeof i18next.t;

  beforeAll(async () => {
    t = (await createI18n('it')).t;
  });

  it('says today, yesterday or the date, in the time of the phone', () => {
    expect(backupWhen(Date.UTC(2026, 10, 6, 5, 12), clock, 'it', t)).toBe('oggi alle 6:12');
    // 23:30 of Thursday in UTC is already Friday in Rome.
    expect(backupWhen(Date.UTC(2026, 10, 5, 23, 30), clock, 'it', t)).toBe('oggi alle 0:30');
    expect(backupWhen(Date.UTC(2026, 10, 5, 5, 12), clock, 'it', t)).toBe('ieri alle 6:12');
    expect(backupWhen(Date.UTC(2026, 10, 2, 5, 12), clock, 'it', t)).toBe(
      'il 2 novembre alle 6:12',
    );
  });

  it('adds the year of a backup of another year', () => {
    expect(backupWhen(Date.UTC(2025, 11, 30, 5, 12), clock, 'it', t)).toBe(
      'il 30 dicembre 2025 alle 6:12',
    );
  });
});
