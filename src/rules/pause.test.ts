import { isPausedOn, pauseLastDay, pauseUntil } from './pause';
import type { GameDay } from './types';

const TODAY: GameDay = '2026-11-13';

describe('pauseUntil', () => {
  it('gives the first day active again after a number of paused days, today included', () => {
    expect(pauseUntil(TODAY, { days: 3 })).toBe('2026-11-16');
    expect(pauseUntil(TODAY, { days: 7 })).toBe('2026-11-20');
    expect(pauseUntil(TODAY, { days: 14 })).toBe('2026-11-27');
  });

  it('turns the last paused day chosen in the calendar into the day after', () => {
    expect(pauseUntil(TODAY, { lastDay: '2026-11-30' })).toBe('2026-12-01');
    expect(pauseUntil(TODAY, { lastDay: TODAY })).toBe('2026-11-14');
  });

  it('is null for a pause without an end', () => {
    expect(pauseUntil(TODAY, { open: true })).toBeNull();
  });

  it('refuses a last day in the past and a pause shorter than a day', () => {
    expect(() => pauseUntil(TODAY, { lastDay: '2026-11-12' })).toThrow(RangeError);
    expect(() => pauseUntil(TODAY, { days: 0 })).toThrow(RangeError);
  });
});

describe('pauseLastDay', () => {
  it('is the day before the first day active again', () => {
    expect(pauseLastDay('2026-11-21')).toBe('2026-11-20');
    expect(pauseLastDay(null)).toBeNull();
  });
});

describe('isPausedOn', () => {
  it('is true for a paused mission until the day before paused_until', () => {
    const mission = { status: 'paused' as const, pausedUntil: '2026-11-16' as GameDay };
    expect(isPausedOn(mission, '2026-11-15')).toBe(true);
    expect(isPausedOn(mission, '2026-11-16')).toBe(false);
  });

  it('is always true for an open pause and false for the other statuses', () => {
    expect(isPausedOn({ status: 'paused', pausedUntil: null }, '2030-01-01')).toBe(true);
    expect(isPausedOn({ status: 'active', pausedUntil: null }, TODAY)).toBe(false);
    expect(isPausedOn({ status: 'archived', pausedUntil: null }, TODAY)).toBe(false);
  });
});
