import {
  SETTING_DEFAULTS,
  dayChangeOn,
  gameDayOf,
  getDaySettings,
  getDeviceId,
  getLanguage,
  getSetting,
  pendingWeekRules,
  promoteWeekRules,
  setDayChange,
  setSetting,
  setWeekRules,
  weekRulesOn,
} from '@/db/repositories/settings';
import { settings } from '@/db/schema';

import { createTestDb } from '../../../test/db';

const NOW = Date.UTC(2026, 10, 6, 9, 0);

describe('getSetting', () => {
  it('gives the default of every setting that was never written', () => {
    const db = createTestDb();
    expect(getSetting(db, 'language')).toBe('en');
    expect(getSetting(db, 'theme')).toBe('minimal');
    expect(getSetting(db, 'game_mode')).toBe('full');
    expect(getSetting(db, 'day_change')).toEqual({ value: '06:00', next: null, from_day: null });
    expect(getSetting(db, 'week_start')).toBe(1);
    expect(getSetting(db, 'rest_days')).toEqual([]);
    expect(getSetting(db, 'quiet_hours')).toEqual([]);
    expect(getSetting(db, 'evening_summary')).toEqual({ enabled: true, time: '21:00' });
    expect(getSetting(db, 'reduce_motion')).toBe('system');
    expect(getSetting(db, 'colorblind')).toBe(false);
    expect(getSetting(db, 'backup')).toEqual({ auto: false, lastBackupAt: null });
    expect(getSetting(db, 'reminders_enabled')).toBe(true);
  });

  it('falls back to the default when the stored value is not valid any more', () => {
    const db = createTestDb();
    db.insert(settings).values({ key: 'theme', value: 'pink', updatedAt: NOW }).run();
    expect(getSetting(db, 'theme')).toBe(SETTING_DEFAULTS.theme);
  });
});

describe('setSetting', () => {
  it('writes a value and replaces it later', () => {
    const db = createTestDb();
    setSetting(db, 'theme', 'fantasy', NOW);
    expect(getSetting(db, 'theme')).toBe('fantasy');
    setSetting(db, 'theme', 'minimal-scuro', NOW + 1000);
    expect(getSetting(db, 'theme')).toBe('minimal-scuro');
    expect(db.select().from(settings).all()).toEqual([
      { key: 'theme', value: 'minimal-scuro', updatedAt: NOW + 1000 },
    ]);
  });

  it('writes structured values', () => {
    const db = createTestDb();
    setSetting(db, 'rest_days', [6, 7], NOW);
    setSetting(db, 'quiet_hours', [{ start: '22:00', end: '07:00' }], NOW);
    setSetting(db, 'week_start', 7, NOW);
    expect(getSetting(db, 'rest_days')).toEqual([6, 7]);
    expect(getSetting(db, 'quiet_hours')).toEqual([{ start: '22:00', end: '07:00' }]);
    expect(getSetting(db, 'week_start')).toBe(7);
  });

  it('rejects values that are not valid and writes nothing', () => {
    const db = createTestDb();
    expect(() => setSetting(db, 'theme', 'pink' as never, NOW)).toThrow();
    expect(() => setSetting(db, 'week_start', 3 as never, NOW)).toThrow();
    expect(() => setSetting(db, 'rest_days', [1, 1], NOW)).toThrow();
    expect(() => setSetting(db, 'quiet_hours', [{ start: '25:00', end: '07:00' }], NOW)).toThrow();
    expect(() => setSetting(db, 'evening_summary', { enabled: true, time: '9pm' }, NOW)).toThrow();
    expect(db.select().from(settings).all()).toEqual([]);
  });
});

describe('setDayChange', () => {
  it('makes a new day change time count from the next day', () => {
    const db = createTestDb();
    setDayChange(db, '05:00', { today: '2026-11-06', now: NOW });
    const dayChange = getSetting(db, 'day_change');
    expect(dayChange).toEqual({ value: '06:00', next: '05:00', from_day: '2026-11-07' });
    expect(dayChangeOn(dayChange, '2026-11-06')).toBe('06:00');
    expect(dayChangeOn(dayChange, '2026-11-07')).toBe('05:00');
    expect(dayChangeOn(dayChange, '2026-11-20')).toBe('05:00');
  });

  it('keeps the time already in force when changing it again later', () => {
    const db = createTestDb();
    setDayChange(db, '05:00', { today: '2026-11-06', now: NOW });
    setDayChange(db, '04:30', { today: '2026-11-10', now: NOW });
    expect(getSetting(db, 'day_change')).toEqual({
      value: '05:00',
      next: '04:30',
      from_day: '2026-11-11',
    });
  });

  it('replaces a change made earlier the same day, or cancels it', () => {
    const db = createTestDb();
    setDayChange(db, '05:00', { today: '2026-11-06', now: NOW });
    setDayChange(db, '04:00', { today: '2026-11-06', now: NOW });
    expect(getSetting(db, 'day_change')).toEqual({
      value: '06:00',
      next: '04:00',
      from_day: '2026-11-07',
    });
    setDayChange(db, '06:00', { today: '2026-11-06', now: NOW });
    expect(getSetting(db, 'day_change')).toEqual({ value: '06:00', next: null, from_day: null });
  });

  it('accepts only times from 00:00 to 06:00, every 30 minutes', () => {
    const db = createTestDb();
    for (const time of ['00:00', '00:30', '05:30', '06:00']) {
      expect(() => setDayChange(db, time, { today: '2026-11-06', now: NOW })).not.toThrow();
    }
    for (const time of ['06:30', '07:00', '05:15', '5:00', '']) {
      expect(() => setDayChange(db, time, { today: '2026-11-06', now: NOW })).toThrow();
    }
  });
});

describe('setWeekRules', () => {
  const FRIDAY = '2026-11-06';

  it('makes new rest days and a new first day of the week count from the next day', () => {
    const db = createTestDb();
    setWeekRules(db, { restDays: [5, 7] }, { today: FRIDAY, now: NOW });
    expect(getSetting(db, 'rest_days')).toEqual([]);
    expect(pendingWeekRules(db)).toEqual({
      week_start: 1,
      rest_days: [5, 7],
      from_day: '2026-11-07',
    });
    expect(weekRulesOn(db, FRIDAY)).toEqual({ weekStart: 1, restDays: [] });
    expect(weekRulesOn(db, '2026-11-07')).toEqual({ weekStart: 1, restDays: [5, 7] });

    setWeekRules(db, { weekStart: 7 }, { today: FRIDAY, now: NOW });
    expect(pendingWeekRules(db)).toEqual({
      week_start: 7,
      rest_days: [5, 7],
      from_day: '2026-11-07',
    });
    expect(weekRulesOn(db, '2026-11-20')).toEqual({ weekStart: 7, restDays: [5, 7] });
  });

  it('cancels the change when the rules in force are chosen again', () => {
    const db = createTestDb();
    setWeekRules(db, { restDays: [7] }, { today: FRIDAY, now: NOW });
    setWeekRules(db, { restDays: [] }, { today: FRIDAY, now: NOW });
    expect(pendingWeekRules(db)).toBeNull();
  });

  it('puts in force a change whose day has come before making a new one', () => {
    const db = createTestDb();
    setWeekRules(db, { restDays: [7] }, { today: FRIDAY, now: NOW });
    setWeekRules(db, { weekStart: 7 }, { today: '2026-11-10', now: NOW });
    expect(getSetting(db, 'rest_days')).toEqual([7]);
    expect(getSetting(db, 'week_start')).toBe(1);
    expect(pendingWeekRules(db)).toEqual({ week_start: 7, rest_days: [7], from_day: '2026-11-11' });
  });

  it('puts the change in force with promoteWeekRules once its day has come', () => {
    const db = createTestDb();
    setWeekRules(db, { restDays: [6], weekStart: 7 }, { today: FRIDAY, now: NOW });
    promoteWeekRules(db, FRIDAY, NOW);
    expect(pendingWeekRules(db)).not.toBeNull();
    promoteWeekRules(db, '2026-11-07', NOW);
    expect(pendingWeekRules(db)).toBeNull();
    expect(getSetting(db, 'rest_days')).toEqual([6]);
    expect(getSetting(db, 'week_start')).toBe(7);
  });

  it('keeps the rest days in the order of the week and rejects values that are not valid', () => {
    const db = createTestDb();
    setWeekRules(db, { restDays: [7, 3] }, { today: FRIDAY, now: NOW });
    expect(pendingWeekRules(db)?.rest_days).toEqual([3, 7]);
    expect(() => setWeekRules(db, { restDays: [8 as 7] }, { today: FRIDAY, now: NOW })).toThrow();
    expect(() => setWeekRules(db, { weekStart: 3 as 1 }, { today: FRIDAY, now: NOW })).toThrow();
  });
});

describe('getDeviceId', () => {
  it('creates a UUID v7 once and then keeps it', () => {
    const db = createTestDb();
    const id = getDeviceId(db, NOW);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(getDeviceId(db, NOW + 1000)).toBe(id);
  });
});

describe('getLanguage', () => {
  it('gives the device language while no language was saved (choice 19)', () => {
    const db = createTestDb();
    expect(getLanguage(db, ['it-IT'])).toBe('it');
    expect(getLanguage(db, ['pt-BR', 'fr-FR'])).toBe('fr');
    expect(getLanguage(db, ['ja-JP'])).toBe('en');
    expect(getLanguage(db, [])).toBe('en');
  });

  it('always prefers the saved language', () => {
    const db = createTestDb();
    setSetting(db, 'language', 'de', NOW);
    expect(getLanguage(db, ['it-IT'])).toBe('de');
  });
});

describe('gameDayOf', () => {
  const ROME = 60;
  const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);

  it('uses the day change time in force', () => {
    const setting = { value: '06:00', next: null, from_day: null };
    expect(gameDayOf(at(6, 1), ROME, setting)).toBe('2026-11-05');
    expect(gameDayOf(at(6, 6), ROME, setting)).toBe('2026-11-06');
  });

  it('ends the day in progress with the old time when the new one is earlier', () => {
    const earlier = { value: '06:00', next: '05:00', from_day: '2026-11-07' as const };
    expect(gameDayOf(at(7, 5, 30), ROME, earlier)).toBe('2026-11-06');
    expect(gameDayOf(at(7, 6), ROME, earlier)).toBe('2026-11-07');
    expect(gameDayOf(at(8, 5), ROME, earlier)).toBe('2026-11-08');
  });

  it('never goes back to the day before when the new time is later', () => {
    const later = { value: '05:00', next: '06:00', from_day: '2026-11-07' as const };
    expect(gameDayOf(at(7, 5, 30), ROME, later)).toBe('2026-11-07');
    expect(gameDayOf(at(8, 5, 30), ROME, later)).toBe('2026-11-07');
    expect(gameDayOf(at(8, 6), ROME, later)).toBe('2026-11-08');
  });
});

describe('getDaySettings', () => {
  // Friday 6 November 2026 at 10:00 in Rome.
  const CLOCK = { now: Date.UTC(2026, 10, 6, 9, 0), tzOffset: 60 };

  it('gives the rules of today and no change by default', () => {
    expect(getDaySettings(createTestDb(), CLOCK)).toEqual({
      today: '2026-11-06',
      dayChange: '06:00',
      weekRules: { weekStart: 1, restDays: [] },
      next: { dayChange: null, weekRules: null },
    });
  });

  it('gives the changes that count from tomorrow, then nothing once they are in force', () => {
    const db = createTestDb();
    setDayChange(db, '04:00', { today: '2026-11-06', now: CLOCK.now });
    setWeekRules(db, { weekStart: 7, restDays: [6] }, { today: '2026-11-06', now: CLOCK.now });
    expect(getDaySettings(db, CLOCK)).toMatchObject({
      dayChange: '06:00',
      weekRules: { weekStart: 1, restDays: [] },
      next: {
        dayChange: { value: '04:00', fromDay: '2026-11-07' },
        weekRules: { weekStart: 7, restDays: [6], fromDay: '2026-11-07' },
      },
    });
    const tomorrow = { ...CLOCK, now: CLOCK.now + 24 * 3_600_000 };
    expect(getDaySettings(db, tomorrow)).toMatchObject({
      today: '2026-11-07',
      dayChange: '04:00',
      weekRules: { weekStart: 7, restDays: [6] },
      next: { dayChange: null, weekRules: null },
    });
  });
});
