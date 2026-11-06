import {
  addDays,
  daysBetween,
  diffDays,
  isGameDay,
  toGameDay,
  weekStartOf,
  weekday,
  type Weekday,
} from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';

const HOUR = 3_600_000;
const ROME_WINTER = 60;
const ROME_SUMMER = 120;
const TOKYO = 540;
const HONOLULU = -600;

describe('toGameDay', () => {
  it('gives a completion at 01:00 to the previous day when the day changes at 06:00', () => {
    const oneAm = Date.UTC(2026, 10, 6, 0, 0); // 01:00 in Rome on 6 November
    expect(toGameDay(oneAm, ROME_WINTER, '06:00')).toBe('2026-11-05');
  });

  it('starts the new game day exactly at 06:00', () => {
    const sixAm = Date.UTC(2026, 10, 6, 5, 0); // 06:00 in Rome
    expect(toGameDay(sixAm - 1, ROME_WINTER, '06:00')).toBe('2026-11-05');
    expect(toGameDay(sixAm, ROME_WINTER, '06:00')).toBe('2026-11-06');
  });

  it('follows the calendar date when the day changes at midnight', () => {
    const midnight = Date.UTC(2026, 10, 5, 23, 0); // 00:00 in Rome on 6 November
    expect(toGameDay(midnight - 1, ROME_WINTER, '00:00')).toBe('2026-11-05');
    expect(toGameDay(midnight, ROME_WINTER, '00:00')).toBe('2026-11-06');
  });

  it('works with time zones that are not whole hours', () => {
    const sixAmInIndia = Date.UTC(2026, 10, 6, 0, 30); // 06:00 in Kolkata (UTC+5:30)
    expect(toGameDay(sixAmInIndia - 1, 330, '06:00')).toBe('2026-11-05');
    expect(toGameDay(sixAmInIndia, 330, '06:00')).toBe('2026-11-06');
  });

  it('changes day at 06:00 local time on the spring daylight saving change (a 23-hour day)', () => {
    // On 29 March 2026 Rome goes from 02:00 CET (UTC+1) to 03:00 CEST (UTC+2).
    const dayStart = Date.UTC(2026, 2, 28, 5, 0); // 06:00 CET on 28 March
    const nextDayStart = dayStart + 23 * HOUR; // 06:00 CEST on 29 March
    expect(toGameDay(dayStart, ROME_WINTER, '06:00')).toBe('2026-03-28');
    expect(toGameDay(nextDayStart - 1, ROME_SUMMER, '06:00')).toBe('2026-03-28');
    expect(toGameDay(nextDayStart, ROME_SUMMER, '06:00')).toBe('2026-03-29');
  });

  it('keeps the repeated hour of the autumn daylight saving change in one game day (a 25-hour day)', () => {
    // On 25 October 2026 Rome goes back from 03:00 CEST (UTC+2) to 02:00 CET (UTC+1).
    const firstHalfPastTwo = Date.UTC(2026, 9, 25, 0, 30); // 02:30 CEST
    const secondHalfPastTwo = Date.UTC(2026, 9, 25, 1, 30); // 02:30 CET, one hour later
    expect(toGameDay(firstHalfPastTwo, ROME_SUMMER, '06:00')).toBe('2026-10-24');
    expect(toGameDay(secondHalfPastTwo, ROME_WINTER, '06:00')).toBe('2026-10-24');
    const dayStart = Date.UTC(2026, 9, 24, 4, 0); // 06:00 CEST on 24 October
    const nextDayStart = dayStart + 25 * HOUR; // 06:00 CET on 25 October
    expect(toGameDay(nextDayStart - 1, ROME_WINTER, '06:00')).toBe('2026-10-24');
    expect(toGameDay(nextDayStart, ROME_WINTER, '06:00')).toBe('2026-10-25');
  });

  it('handles the end of the month and leap years', () => {
    // 01:00 on 1 March belongs to the last day of February.
    expect(toGameDay(Date.UTC(2026, 2, 1, 0, 0), ROME_WINTER, '06:00')).toBe('2026-02-28');
    expect(toGameDay(Date.UTC(2028, 2, 1, 0, 0), ROME_WINTER, '06:00')).toBe('2028-02-29');
    // 03:00 on 1 January belongs to the last day of the year before.
    expect(toGameDay(Date.UTC(2027, 0, 1, 2, 0), ROME_WINTER, '06:00')).toBe('2026-12-31');
  });

  it('rejects a day change time that is not HH:MM', () => {
    const instant = Date.UTC(2026, 10, 6, 12, 0);
    for (const dayChange of ['6:00', '24:00', '06:60', '06:00:00', '', 'mezzanotte']) {
      expect(() => toGameDay(instant, ROME_WINTER, dayChange)).toThrow(RangeError);
    }
  });

  it('rejects invalid instants and time zone offsets', () => {
    const instant = Date.UTC(2026, 10, 6, 12, 0);
    expect(() => toGameDay(Number.NaN, ROME_WINTER, '06:00')).toThrow(RangeError);
    expect(() => toGameDay(Number.POSITIVE_INFINITY, ROME_WINTER, '06:00')).toThrow(RangeError);
    expect(() => toGameDay(9e15, ROME_WINTER, '06:00')).toThrow(RangeError);
    expect(() => toGameDay(instant, 60.5, '06:00')).toThrow(RangeError);
    expect(() => toGameDay(instant, 19 * 60, '06:00')).toThrow(RangeError);
    expect(() => toGameDay(instant, -19 * 60, '06:00')).toThrow(RangeError);
  });
});

describe('flights', () => {
  it('flying east does not invent missed days', () => {
    // Rome → Tokyo: leave at 12:00 on 6 November, land 12 hours later at 08:00 on 7 November.
    const departure = Date.UTC(2026, 10, 6, 11, 0);
    const arrival = departure + 12 * HOUR;
    const before = toGameDay(departure, ROME_WINTER, '06:00');
    const after = toGameDay(arrival, TOKYO, '06:00');
    expect(before).toBe('2026-11-06');
    expect(after).toBe('2026-11-07');
    expect(daysBetween(before, after)).toEqual([]);
  });

  it('flying west can move the game day back without inventing missed days', () => {
    // Tokyo → Honolulu: leave at 08:00 on 7 November, land 7 hours later at 20:00 on 6 November.
    const departure = Date.UTC(2026, 10, 6, 23, 0);
    const arrival = departure + 7 * HOUR;
    const before = toGameDay(departure, TOKYO, '06:00');
    const after = toGameDay(arrival, HONOLULU, '06:00');
    expect(before).toBe('2026-11-07');
    expect(after).toBe('2026-11-06');
    expect(diffDays(before, after)).toBe(-1);
    expect(daysBetween(before, after)).toEqual([]);
    // The next morning in Honolulu it is 7 November again: still nothing to close.
    const nextMorning = toGameDay(Date.UTC(2026, 10, 7, 17, 0), HONOLULU, '06:00');
    expect(nextMorning).toBe('2026-11-07');
    expect(daysBetween(before, nextMorning)).toEqual([]);
  });
});

describe('addDays', () => {
  it('crosses the end of the month and of the year', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-11-06', 0)).toBe('2026-11-06');
  });

  it('knows leap years, including the century rule', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
    expect(addDays('2028-01-01', 366)).toBe('2029-01-01');
  });

  it('rejects a number of days that is not an integer', () => {
    expect(() => addDays('2026-11-06', 1.5)).toThrow(RangeError);
  });

  it('rejects a day that does not exist', () => {
    expect(() => addDays('2026-02-29', 1)).toThrow(RangeError);
    expect(() => addDays('2026-13-01', 1)).toThrow(RangeError);
  });
});

describe('diffDays', () => {
  it('counts the calendar days from the first day to the second', () => {
    expect(diffDays('2026-11-01', '2026-11-06')).toBe(5);
    expect(diffDays('2026-11-06', '2026-11-01')).toBe(-5);
    expect(diffDays('2026-11-06', '2026-11-06')).toBe(0);
  });

  it('counts 366 days in a leap year and ignores daylight saving changes', () => {
    expect(diffDays('2028-01-01', '2029-01-01')).toBe(366);
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('weekday', () => {
  it('numbers the days from 1 (Monday) to 7 (Sunday)', () => {
    expect(weekday('2026-11-02')).toBe(1);
    expect(weekday('2026-11-06')).toBe(5);
    expect(weekday('2026-11-08')).toBe(7);
    expect(weekday('2028-02-29')).toBe(2);
  });

  it('works before 1970 too', () => {
    expect(weekday('1970-01-01')).toBe(4);
    expect(weekday('1969-12-31')).toBe(3);
  });
});

describe('weekStartOf', () => {
  it('finds the Monday of the week when weeks start on Monday', () => {
    expect(weekStartOf('2026-11-06', 1)).toBe('2026-11-02');
    expect(weekStartOf('2026-11-02', 1)).toBe('2026-11-02');
    expect(weekStartOf('2026-11-08', 1)).toBe('2026-11-02');
    expect(weekStartOf('2027-01-01', 1)).toBe('2026-12-28');
  });

  it('finds the Sunday of the week when weeks start on Sunday', () => {
    expect(weekStartOf('2026-11-06', 7)).toBe('2026-11-01');
    expect(weekStartOf('2026-11-07', 7)).toBe('2026-11-01');
    expect(weekStartOf('2026-11-08', 7)).toBe('2026-11-08');
  });

  it('rejects a week start that is not a weekday', () => {
    for (const weekStart of [0, 8, 1.5]) {
      expect(() => weekStartOf('2026-11-06', weekStart as Weekday)).toThrow(RangeError);
    }
  });
});

describe('daysBetween', () => {
  it('is empty when no whole day has passed', () => {
    expect(daysBetween('2026-11-06', '2026-11-06')).toEqual([]);
    expect(daysBetween('2026-11-05', '2026-11-06')).toEqual([]);
  });

  it('lists the whole days in between, in order, across the end of the month', () => {
    expect(daysBetween('2026-10-30', '2026-11-05')).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('includes 29 February in a leap year', () => {
    expect(daysBetween('2028-02-27', '2028-03-02')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('is empty when the second day comes first', () => {
    expect(daysBetween('2026-11-07', '2026-11-03')).toEqual([]);
  });
});

describe('isGameDay', () => {
  it('accepts only real dates in the YYYY-MM-DD format', () => {
    expect(isGameDay('2026-11-06')).toBe(true);
    expect(isGameDay('2028-02-29')).toBe(true);
    const invalid: unknown[] = [
      '2026-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-00-10',
      '2026-11-6',
      '2026-11-06T06:00',
      '0099-01-01',
      '',
      20261106,
      null,
    ];
    for (const value of invalid) {
      expect(isGameDay(value)).toBe(false);
    }
  });

  it('narrows a string to GameDay', () => {
    const value: string = '2026-11-06';
    if (!isGameDay(value)) {
      throw new Error('expected a game day');
    }
    const day: GameDay = value;
    expect(addDays(day, 1)).toBe('2026-11-07');
  });
});
