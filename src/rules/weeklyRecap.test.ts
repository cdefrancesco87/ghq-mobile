import { WEEKLY_RECAP } from './config';
import type { GameDay } from './types';
import {
  beatenRecord,
  nextRecapAt,
  recapFirstDay,
  recapLastDay,
  weeklyRecap,
  type WeeklyRecapInput,
} from './weeklyRecap';

const TZ = 60;
/** UTC instant of a local time in Rome on a day of November 2026 (the 15th is a Sunday). */
const rome = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}` as GameDay;
const clock = (n: number, hour: number, minute = 0) => ({
  now: rome(n, hour, minute),
  // Before 06:00 the game day is the day before.
  today: hour < 6 ? day(n - 1) : day(n),
  tzOffset: TZ,
  dayChange: () => '06:00',
  weekday: 7 as const,
  time: '19:00',
});

describe('recapLastDay', () => {
  it('shows the week of last Sunday until the time of the next recap', () => {
    expect(recapLastDay({ ...clock(15, 19), firstDay: '2026-10-01' })).toBe(day(15));
    expect(recapLastDay({ ...clock(15, 18, 59), firstDay: '2026-10-01' })).toBe(day(8));
    expect(recapLastDay({ ...clock(18, 9), firstDay: '2026-10-01' })).toBe(day(15));
    // 02:00 of Monday is still the game day of Sunday.
    expect(recapLastDay({ ...clock(16, 2), firstDay: '2026-10-01' })).toBe(day(15));
  });

  it('is null before the first recap of the hero', () => {
    expect(recapLastDay({ ...clock(14, 9), firstDay: day(10) })).toBeNull();
    expect(recapLastDay({ ...clock(15, 20), firstDay: day(10) })).toBe(day(15));
  });

  it('follows the day of the Settings', () => {
    expect(recapLastDay({ ...clock(18, 20), weekday: 3, firstDay: day(1) })).toBe(day(18));
  });
});

describe('nextRecapAt', () => {
  const base = { quietHours: [], pause: null };

  it('fires on Sunday at 19:00, the same day before that time', () => {
    expect(nextRecapAt({ ...clock(15, 10), ...base })).toBe(rome(15, 19));
    expect(nextRecapAt({ ...clock(15, 19), ...base })).toBe(rome(22, 19));
    expect(nextRecapAt({ ...clock(17, 8), ...base })).toBe(rome(22, 19));
  });

  it('waits for the end of «Non disturbare»', () => {
    const quietHours = [{ start: '18:00', end: '20:30' }];
    expect(nextRecapAt({ ...clock(17, 8), ...base, quietHours })).toBe(rome(22, 20, 30));
  });

  it('skips the Sundays of a general pause, and waits while it has no end', () => {
    const pause = { fromDay: day(20), untilDay: day(23) };
    expect(nextRecapAt({ ...clock(17, 8), ...base, pause })).toBe(rome(29, 19));
    expect(nextRecapAt({ ...clock(17, 8), ...base, pause: { ...pause, untilDay: null } })).toBe(
      null,
    );
  });
});

const input = (overrides: Partial<WeeklyRecapInput> = {}): WeeklyRecapInput => ({
  missions: [],
  bossDamage: 0,
  levelsGained: 0,
  statPoints: 0,
  records: [],
  essential: false,
  ...overrides,
});

describe('weeklyRecap', () => {
  it('tells a good week with its four lines', () => {
    const recap = weeklyRecap(
      input({
        missions: [
          { id: 'a', name: 'Leggere', expected: 7, done: 6 },
          { id: 'b', name: 'Correre', expected: 3, done: 3 },
          { id: 'c', name: 'Acqua', expected: 7, done: 7 },
        ],
        bossDamage: 60,
        levelsGained: 1,
        statPoints: 80,
        records: [
          { missionId: 'a', name: 'Leggere', streak: 9 },
          { missionId: null, name: null, streak: 12 },
        ],
      }),
    );
    // Equal shares: more completions win.
    expect(recap.mostConsistent?.id).toBe('c');
    expect(recap.bossDamage).toBe(60);
    expect(recap.progress).toEqual({ levels: 1, statPoints: 80 });
    expect(recap.records.map((record) => record.missionId)).toEqual([null, 'a']);
    expect(recap.encouragement).toBe(false);
  });

  it('keeps only the successes of a bad week, with the encouragement', () => {
    const recap = weeklyRecap(
      input({
        missions: [
          { id: 'a', name: 'Leggere', expected: 7, done: 1 },
          { id: 'b', name: 'Correre', expected: 7, done: 0 },
        ],
        statPoints: 10,
        bossDamage: 0,
        levelsGained: -1,
      }),
    );
    expect(recap.mostConsistent?.id).toBe('a');
    expect(recap.bossDamage).toBeNull();
    expect(recap.progress).toEqual({ levels: 0, statPoints: 10 });
    expect(recap.records).toEqual([]);
    expect(recap.encouragement).toBe(true);
  });

  it('has only the encouragement when nothing went well', () => {
    const recap = weeklyRecap(
      input({ missions: [{ id: 'a', name: 'Leggere', expected: 7, done: 0 }] }),
    );
    expect(recap.mostConsistent).toBeNull();
    expect(recap.progress).toBeNull();
    expect(recap.encouragement).toBe(true);
  });

  it('keeps the most constant mission and the records in the Essential mode', () => {
    const recap = weeklyRecap(
      input({
        essential: true,
        missions: [{ id: 'a', name: 'Leggere', expected: 7, done: 7 }],
        bossDamage: 40,
        levelsGained: 1,
        statPoints: 30,
        records: [{ missionId: 'a', name: 'Leggere', streak: 5 }],
      }),
    );
    expect(recap.mostConsistent?.id).toBe('a');
    expect(recap.bossDamage).toBeNull();
    expect(recap.progress).toBeNull();
    expect(recap.records).toHaveLength(1);
  });
});

describe('recapFirstDay', () => {
  it('covers 7 days, not before the hero', () => {
    expect(WEEKLY_RECAP.weekDays).toBe(7);
    expect(recapFirstDay(day(15), day(1))).toBe(day(9));
    expect(recapFirstDay(day(15), day(12))).toBe(day(12));
  });
});

describe('beatenRecord', () => {
  it('needs a record of at least 3 days beaten in the week', () => {
    expect(WEEKLY_RECAP.recordMin).toBe(3);
    expect(beatenRecord([1, 2, 3, 0], [1, 2, 3, 4, 5])).toBe(5);
    expect(beatenRecord([1, 2], [3, 4])).toBeNull();
    expect(beatenRecord([5], [4, 5])).toBeNull();
    expect(beatenRecord([], [4])).toBeNull();
  });
});
