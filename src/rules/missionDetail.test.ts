import { addDays } from './gameDay';
import {
  averageValue,
  bucketAverages,
  bucketRate,
  dayMark,
  monthBuckets,
  weekBuckets,
  type DetailInput,
} from './missionDetail';
import type { GameDay } from './types';

// Monday 2 November 2026 … Sunday 29 November 2026; Friday 27 is "today" in most tests.
const TODAY: GameDay = '2026-11-27';

type Status = 'done' | 'partial' | 'skipped';

function daily(overrides: Partial<DetailInput> = {}): DetailInput {
  return {
    mission: {
      kind: 'habit',
      frequency: { type: 'daily' },
      dueDay: null,
      createdDay: '2026-01-01',
    },
    days: [],
    pauses: [],
    restDays: [],
    weekStart: 1,
    ...overrides,
  };
}

const day = (gameDay: GameDay, status: Status = 'done', value: number | null = null) => ({
  gameDay,
  status,
  value,
});

describe('weekBuckets', () => {
  it('gives the current week and the ones before it, from week_start, the last cut at today', () => {
    expect(weekBuckets(TODAY, 3, 1)).toEqual([
      { from: '2026-11-09', to: '2026-11-15' },
      { from: '2026-11-16', to: '2026-11-22' },
      { from: '2026-11-23', to: TODAY },
    ]);
    // Weeks from Sunday.
    expect(weekBuckets(TODAY, 1, 7)).toEqual([{ from: '2026-11-22', to: TODAY }]);
  });
});

describe('monthBuckets', () => {
  it('gives the calendar months up to today, across the year', () => {
    expect(monthBuckets('2027-01-10', 3)).toEqual([
      { from: '2026-11-01', to: '2026-11-30' },
      { from: '2026-12-01', to: '2026-12-31' },
      { from: '2027-01-01', to: '2027-01-10' },
    ]);
    expect(monthBuckets('2026-03-31', 2)).toEqual([
      { from: '2026-02-01', to: '2026-02-28' },
      { from: '2026-03-01', to: '2026-03-31' },
    ]);
  });
});

describe('bucketRate', () => {
  it('counts a past week as closed and the current one only up to today, still open', () => {
    const input = daily({ days: [day('2026-11-16'), day('2026-11-17'), day('2026-11-23')] });
    expect(bucketRate(input, { from: '2026-11-16', to: '2026-11-22' }, TODAY, null)).toBe(
      Math.floor((2 / 7) * 100),
    );
    // Monday 23 … Thursday 26 closed, today still to do.
    expect(bucketRate(input, { from: '2026-11-23', to: TODAY }, TODAY, null)).toBe(25);
  });

  it('has no rate before the creation or after the archive', () => {
    const input = daily({ mission: { ...daily().mission, createdDay: '2026-11-20' } });
    expect(bucketRate(input, { from: '2026-11-09', to: '2026-11-15' }, TODAY, null)).toBeNull();
    const archived = daily({ days: [day('2026-11-10')] });
    expect(
      bucketRate(archived, { from: '2026-11-16', to: '2026-11-22' }, TODAY, '2026-11-12'),
    ).toBeNull();
    // Archived on Thursday 12: Monday 9 … Wednesday 11 closed, Thursday not missed.
    expect(
      bucketRate(archived, { from: '2026-11-09', to: '2026-11-15' }, TODAY, '2026-11-12'),
    ).toBe(33);
  });

  it('gives a week cut by two months to the later one, for N times a week', () => {
    const input = daily({
      mission: { ...daily().mission, frequency: { type: 'times_per_week', times: 2 } },
      // Week of Monday 26 October: one completion on 27 October, one on Sunday 1 November.
      days: [day('2026-10-27'), day('2026-11-01')],
    });
    // October ends on a Saturday: its last week belongs to November.
    expect(bucketRate(input, { from: '2026-10-01', to: '2026-10-31' }, TODAY, null)).toBe(0);
    // November: the week of 26 October done (2 of 2), the next three missed, this week open.
    expect(bucketRate(input, { from: '2026-11-01', to: '2026-11-30' }, TODAY, null)).toBe(
      Math.floor((2 / 8) * 100),
    );
  });
});

describe('dayMark', () => {
  it('marks done, skipped, missed and today still to do', () => {
    const input = daily({
      days: [day('2026-11-24'), day('2026-11-25', 'skipped'), day('2026-11-23', 'partial', 1)],
    });
    expect(dayMark(input, '2026-11-24', TODAY, null)).toBe('done');
    expect(dayMark(input, '2026-11-25', TODAY, null)).toBe('skipped');
    expect(dayMark(input, '2026-11-26', TODAY, null)).toBe('missed');
    // A partial measurable day counts as not done.
    expect(dayMark(input, '2026-11-23', TODAY, null)).toBe('missed');
    expect(dayMark(input, TODAY, TODAY, null)).toBe('open');
    expect(dayMark(daily({ days: [day(TODAY)] }), TODAY, TODAY, null)).toBe('done');
  });

  it('marks off the days not expected: rest, pause, frequency, before creation, after archive', () => {
    const tuesdays = daily({
      mission: { ...daily().mission, frequency: { type: 'weekdays', days: [2] } },
    });
    expect(dayMark(tuesdays, '2026-11-25', TODAY, null)).toBe('off');
    expect(dayMark(tuesdays, '2026-11-24', TODAY, null)).toBe('missed');
    expect(dayMark(daily({ restDays: [4] }), '2026-11-26', TODAY, null)).toBe('off');
    expect(
      dayMark(daily({ pauses: [{ from: '2026-11-25', until: null }] }), '2026-11-26', TODAY, null),
    ).toBe('off');
    const created = daily({ mission: { ...daily().mission, createdDay: '2026-11-26' } });
    expect(dayMark(created, '2026-11-25', TODAY, null)).toBe('off');
    expect(dayMark(daily(), '2026-11-26', TODAY, '2026-11-25')).toBe('off');
    expect(dayMark(daily(), '2026-11-25', TODAY, '2026-11-25')).toBe('off');
    expect(dayMark(daily(), '2026-11-24', TODAY, '2026-11-25')).toBe('missed');
    // A rest day done stays done.
    expect(
      dayMark(daily({ restDays: [4], days: [day('2026-11-26')] }), '2026-11-26', TODAY, null),
    ).toBe('done');
  });

  it('never marks a day of N times a week as missed', () => {
    const input = daily({
      mission: { ...daily().mission, frequency: { type: 'times_per_week', times: 3 } },
      days: [day('2026-11-24')],
    });
    expect(dayMark(input, '2026-11-24', TODAY, null)).toBe('done');
    expect(dayMark(input, '2026-11-25', TODAY, null)).toBe('off');
    expect(dayMark(input, TODAY, TODAY, null)).toBe('off');
  });

  it('marks a task only on its due day, or on the day it was done', () => {
    const task = (days: DetailInput['days'] = []) =>
      daily({
        mission: { kind: 'task', frequency: null, dueDay: '2026-11-25', createdDay: '2026-11-20' },
        days,
      });
    expect(dayMark(task(), '2026-11-25', TODAY, null)).toBe('missed');
    expect(dayMark(task(), '2026-11-24', TODAY, null)).toBe('off');
    expect(dayMark(task(), '2026-11-25', '2026-11-25', null)).toBe('open');
    expect(dayMark(task([day('2026-11-26')]), '2026-11-25', TODAY, null)).toBe('off');
    expect(dayMark(task([day('2026-11-26')]), '2026-11-26', TODAY, null)).toBe('done');
  });
});

describe('values of a measurable mission', () => {
  const values = daily({
    days: [
      day('2026-10-30', 'done', 2),
      day('2026-11-02', 'partial', 1),
      day('2026-11-03', 'done', 2.5),
      day('2026-11-04', 'skipped'),
    ],
  });

  it('averages the days with a value in the window', () => {
    expect(averageValue(values, '2026-11-01', TODAY)).toBe(1.75);
    expect(averageValue(values, '2026-11-05', TODAY)).toBeNull();
  });

  it('averages every month on the days with a value', () => {
    expect(
      bucketAverages(values, [
        { from: '2026-10-01', to: '2026-10-31' },
        { from: '2026-11-01', to: TODAY },
        { from: addDays(TODAY, 1), to: addDays(TODAY, 3) },
      ]),
    ).toEqual([2, 1.75, null]);
  });
});
