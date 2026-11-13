import { RECALL } from './config';
import { recallAt } from './recall';

const TZ = 60;
/** UTC instant of a local time in Rome on a day of November 2026. */
const rome = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);
const base = { tzOffset: TZ, dayChange: '06:00', quietHours: [], pause: null };

describe('recallAt', () => {
  it('fires 3 days after the opening, at the same time', () => {
    expect(RECALL.afterDays).toBe(3);
    expect(recallAt({ ...base, now: rome(10, 18, 30) })).toBe(rome(13, 18, 30));
  });

  it('waits for the end of «Non disturbare»', () => {
    const quietHours = [{ start: '22:00', end: '07:00' }];
    expect(recallAt({ ...base, quietHours, now: rome(10, 23, 15) })).toBe(rome(14, 7));
    expect(recallAt({ ...base, quietHours, now: rome(10, 21, 59) })).toBe(rome(13, 21, 59));
  });

  it('moves after a general pause that holds its day', () => {
    const pause = { fromDay: '2026-11-12', untilDay: '2026-11-15' } as const;
    expect(recallAt({ ...base, pause, now: rome(10, 18) })).toBe(rome(16, 18));
  });

  it('counts the game day: 02:00 belongs to the day before', () => {
    // 02:00 of the 14th is still the game day of the 13th, the last paused day.
    const pause = { fromDay: '2026-11-12', untilDay: '2026-11-13' } as const;
    expect(recallAt({ ...base, pause, now: rome(11, 2) })).toBe(rome(15, 2));
  });

  it('is not scheduled while a pause without an end holds its day', () => {
    const pause = { fromDay: '2026-11-11' as const, untilDay: null };
    expect(recallAt({ ...base, pause, now: rome(10, 18) })).toBeNull();
  });

  it('ignores a pause that ends before its day', () => {
    const pause = { fromDay: '2026-11-10', untilDay: '2026-11-11' } as const;
    expect(recallAt({ ...base, pause, now: rome(10, 18) })).toBe(rome(13, 18));
  });
});
