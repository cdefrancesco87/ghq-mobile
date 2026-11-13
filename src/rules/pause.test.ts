import {
  deadlineAfterPause,
  isDeadlineHeld,
  isPausedDay,
  isPausedOn,
  pauseIntervals,
  pauseLastDay,
  pauseLength,
  windowStartOutsidePause,
  pausedDaysBetween,
  pauseUntil,
  type PauseEvent,
} from './pause';
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

describe('general pause', () => {
  const started = (fromDay: GameDay, untilDay: GameDay | null): PauseEvent => ({
    type: 'pause.started',
    payload: { fromDay, untilDay },
  });

  describe('pauseIntervals', () => {
    it('is empty without pause events', () => {
      expect(pauseIntervals([])).toEqual([]);
    });

    it('reads a pause with its end, an open one and a changed end', () => {
      expect(
        pauseIntervals([
          started('2026-11-02', '2026-11-04'),
          { type: 'pause.ended', payload: { fromDay: '2026-11-02', untilDay: '2026-11-04' } },
          started('2026-11-10', null),
          {
            type: 'pause.changed',
            payload: { fromDay: '2026-11-10', oldUntilDay: null, untilDay: '2026-11-12' },
          },
        ]),
      ).toEqual([
        { fromDay: '2026-11-02', untilDay: '2026-11-04' },
        { fromDay: '2026-11-10', untilDay: '2026-11-12' },
      ]);
      expect(pauseIntervals([started('2026-11-10', null)])).toEqual([
        { fromDay: '2026-11-10', untilDay: null },
      ]);
    });

    it('drops a scheduled pause cancelled before its start', () => {
      expect(
        pauseIntervals([
          started('2026-11-20', '2026-11-25'),
          {
            type: 'pause.ended',
            payload: { fromDay: '2026-11-20', untilDay: '2026-11-25', cancelled: true },
          },
        ]),
      ).toEqual([]);
    });
  });

  describe('isPausedDay', () => {
    const intervals = [
      { fromDay: '2026-11-02' as GameDay, untilDay: '2026-11-04' as GameDay },
      { fromDay: '2026-11-10' as GameDay, untilDay: null },
    ];

    it('includes the first and the last day of a pause', () => {
      expect(isPausedDay('2026-11-01', intervals)).toBe(false);
      expect(isPausedDay('2026-11-02', intervals)).toBe(true);
      expect(isPausedDay('2026-11-04', intervals)).toBe(true);
      expect(isPausedDay('2026-11-05', intervals)).toBe(false);
    });

    it('has no end for an open pause', () => {
      expect(isPausedDay('2026-11-09', intervals)).toBe(false);
      expect(isPausedDay('2027-03-01', intervals)).toBe(true);
    });
  });

  describe('pausedDaysBetween', () => {
    const intervals = [{ fromDay: '2026-11-04' as GameDay, untilDay: '2026-11-05' as GameDay }];

    it('counts the paused days of a range, both ends included', () => {
      expect(pausedDaysBetween(intervals, '2026-11-02', '2026-11-08')).toBe(2);
      expect(pausedDaysBetween(intervals, '2026-11-05', '2026-11-08')).toBe(1);
      expect(pausedDaysBetween(intervals, '2026-11-06', '2026-11-08')).toBe(0);
      expect(pausedDaysBetween([], '2026-11-02', '2026-11-08')).toBe(0);
    });

    it('counts an open pause up to the end of the range', () => {
      expect(
        pausedDaysBetween([{ fromDay: '2026-11-07', untilDay: null }], '2026-11-02', '2026-11-08'),
      ).toBe(2);
    });
  });

  describe('pauseLength', () => {
    it('counts the days of a pause, the last one included', () => {
      expect(pauseLength({ fromDay: '2026-11-13', untilDay: '2026-11-13' })).toBe(1);
      expect(pauseLength({ fromDay: '2026-11-13', untilDay: '2026-11-17' })).toBe(5);
    });
  });

  describe('windowStartOutsidePause', () => {
    const intervals = [{ fromDay: '2026-11-10' as GameDay, untilDay: '2026-11-14' as GameDay }];

    it('is the start of a plain window without pauses', () => {
      expect(windowStartOutsidePause('2026-11-30', 30, [])).toBe('2026-11-01');
    });

    it('goes back by the paused days, so the window has as many days not paused', () => {
      expect(windowStartOutsidePause('2026-11-30', 30, intervals)).toBe('2026-10-27');
      expect(windowStartOutsidePause('2026-11-16', 3, intervals)).toBe('2026-11-09');
    });
  });
});

describe('deadlineAfterPause', () => {
  const PAUSE = { fromDay: '2026-11-10', untilDay: '2026-11-12' } as const;

  it('moves a deadline from the first paused day on by the paused days', () => {
    expect(deadlineAfterPause('2026-11-20', PAUSE)).toBe('2026-11-23');
    expect(deadlineAfterPause('2026-11-10', PAUSE)).toBe('2026-11-13');
  });

  it('leaves a deadline before the pause, and every deadline without a pause', () => {
    expect(deadlineAfterPause('2026-11-09', PAUSE)).toBe('2026-11-09');
    expect(deadlineAfterPause('2026-11-20', null)).toBe('2026-11-20');
  });

  it('has no deadline yet while a pause without an end holds it', () => {
    expect(deadlineAfterPause('2026-11-20', { fromDay: '2026-11-10', untilDay: null })).toBeNull();
    expect(deadlineAfterPause('2026-11-09', { fromDay: '2026-11-10', untilDay: null })).toBe(
      '2026-11-09',
    );
  });
});

describe('isDeadlineHeld', () => {
  it('holds a deadline from the first paused day on, never one before or without a pause', () => {
    const pause = { fromDay: '2026-11-10' } as const;
    expect(isDeadlineHeld('2026-11-10', pause)).toBe(true);
    expect(isDeadlineHeld('2026-11-30', pause)).toBe(true);
    expect(isDeadlineHeld('2026-11-09', pause)).toBe(false);
    expect(isDeadlineHeld(null, pause)).toBe(false);
    expect(isDeadlineHeld('2026-11-30', null)).toBe(false);
  });
});
