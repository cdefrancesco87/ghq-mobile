import {
  healthAmount,
  healthUnit,
  healthValue,
  healthWindow,
  HEALTH_METRICS,
  sleepHoursOf,
} from './health';
import { quietHoursEnd } from './reminders';

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe('health metrics', () => {
  it('are steps, minutes of activity and hours of sleep, each with its unit', () => {
    expect(HEALTH_METRICS).toEqual(['steps', 'active_minutes', 'sleep_hours']);
    expect(healthUnit('steps')).toBe('step');
    expect(healthUnit('active_minutes')).toBe('minute');
    expect(healthUnit('sleep_hours')).toBe('hour');
  });
});

describe('healthWindow', () => {
  // 2026-11-13 at 15:00 in Rome (UTC+60).
  const now = Date.UTC(2026, 10, 13, 14, 0);

  it('reads steps and activity from the start of the game day until now', () => {
    const window = healthWindow({
      metric: 'steps',
      day: '2026-11-13',
      dayChange: '04:00',
      tzOffset: 60,
      now,
    });
    expect(window).toEqual({ start: Date.UTC(2026, 10, 13, 3, 0), end: now });
  });

  it('reads sleep from the evening before the game day, so the night counts', () => {
    const window = healthWindow({
      metric: 'sleep_hours',
      day: '2026-11-13',
      dayChange: '00:00',
      tzOffset: 60,
      now,
    });
    expect(window.start).toBe(Date.UTC(2026, 10, 12, 23, 0) - 6 * HOUR);
    expect(window.end).toBe(now);
  });

  it('never reads past the end of the game day', () => {
    const late = Date.UTC(2026, 10, 15, 10, 0);
    const window = healthWindow({
      metric: 'steps',
      day: '2026-11-13',
      dayChange: '00:00',
      tzOffset: 0,
      now: late,
    });
    expect(window.end).toBe(Date.UTC(2026, 10, 14, 0, 0));
  });
});

describe('healthValue', () => {
  it('counts whole steps and minutes and tenths of an hour, rounded down', () => {
    expect(healthValue('steps', 6200.7)).toBe(6200);
    expect(healthValue('active_minutes', 31.9)).toBe(31);
    expect(healthValue('sleep_hours', 7.46)).toBe(7.4);
  });

  it('gives 0 for a missing or negative reading', () => {
    expect(healthValue('steps', -3)).toBe(0);
    expect(healthValue('steps', Number.NaN)).toBe(0);
  });
});

describe('healthAmount', () => {
  it('adds only what the reading has more than the value of the day', () => {
    expect(healthAmount(0, 6200)).toBe(6200);
    expect(healthAmount(6200, 7000)).toBe(800);
    expect(healthAmount(1.2, 7.4)).toBe(6.2);
  });

  it('never goes back: a lower reading adds nothing', () => {
    expect(healthAmount(7000, 6200)).toBe(0);
    expect(healthAmount(5, 5)).toBe(0);
  });
});

describe('quietHoursEnd', () => {
  const quiet = [{ start: '22:00', end: '07:00' }];

  it('is now outside «Non disturbare»', () => {
    const now = Date.UTC(2026, 10, 13, 14, 0);
    expect(quietHoursEnd(now, 60, quiet)).toBe(now);
    expect(quietHoursEnd(now, 60, [])).toBe(now);
  });

  it('is the end of the interval inside it, in local time', () => {
    // 23:30 in Rome: the interval ends at 07:00 of the next day, 06:00 UTC.
    const now = Date.UTC(2026, 10, 13, 22, 30);
    expect(quietHoursEnd(now, 60, quiet)).toBe(Date.UTC(2026, 10, 14, 6, 0));
  });

  it('keeps the seconds out: the notification arrives on the minute the interval ends', () => {
    const now = Date.UTC(2026, 10, 14, 5, 0) + 30 * MINUTE + 15_000;
    expect(quietHoursEnd(now, 60, quiet)).toBe(Date.UTC(2026, 10, 14, 6, 0));
  });
});

describe('sleepHoursOf', () => {
  const window = { start: 0, end: 24 * HOUR };

  it('adds the samples asleep, counting the overlaps of two devices once', () => {
    const samples = [
      { start: 1 * HOUR, end: 4 * HOUR },
      { start: 3 * HOUR, end: 6 * HOUR },
      { start: 2 * HOUR, end: 3 * HOUR },
      { start: 7 * HOUR, end: 7.5 * HOUR },
    ];
    expect(sleepHoursOf(samples, window)).toBe(5.5);
  });

  it('cuts the samples at the edges of the window', () => {
    expect(sleepHoursOf([{ start: -2 * HOUR, end: 2 * HOUR }], window)).toBe(2);
    expect(sleepHoursOf([{ start: 25 * HOUR, end: 26 * HOUR }], window)).toBe(0);
    expect(sleepHoursOf([], window)).toBe(0);
  });
});
