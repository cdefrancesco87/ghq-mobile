import {
  frequencySchema,
  isDueToday,
  isScheduled,
  type DueMission,
  type Frequency,
  type ScheduleContext,
} from '@/rules/frequency';
import { addDays, diffDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';

const NO_HISTORY: ScheduleContext = { weekStart: 1, completedDays: [] };

/** The days from `from` to `to` (both included) on which `frequency` is scheduled. */
function scheduledDays(
  frequency: Frequency,
  from: GameDay,
  to: GameDay,
  ctx: ScheduleContext = NO_HISTORY,
): GameDay[] {
  const days: GameDay[] = [];
  for (let i = 0; i <= diffDays(from, to); i++) {
    const day = addDays(from, i);
    if (isScheduled(frequency, day, ctx)) {
      days.push(day);
    }
  }
  return days;
}

function mission(overrides: Partial<DueMission> = {}): DueMission {
  return {
    kind: 'habit',
    frequency: { type: 'daily' },
    dueDay: null,
    status: 'active',
    pausedUntil: null,
    deletedAt: null,
    ...overrides,
  };
}

function task(dueDay: GameDay | null, overrides: Partial<DueMission> = {}): DueMission {
  return mission({ kind: 'task', frequency: null, dueDay, ...overrides });
}

describe('frequencySchema', () => {
  it('accepts the six forms of the data model', () => {
    const valid: Frequency[] = [
      { type: 'daily' },
      { type: 'weekdays', days: [1, 3, 5] },
      { type: 'times_per_week', times: 3 },
      { type: 'every_n_days', n: 2, from: '2026-11-06' },
      { type: 'monthly', day: 31 },
      { type: 'yearly', month: 2, day: 29 },
    ];
    for (const frequency of valid) {
      expect(frequencySchema.parse(frequency)).toEqual(frequency);
    }
  });

  it('rejects wrong forms', () => {
    const invalid: unknown[] = [
      null,
      'daily',
      {},
      { type: 'hourly' },
      { type: 'daily', days: [1] },
      { type: 'weekdays' },
      { type: 'weekdays', days: [] },
      { type: 'weekdays', days: [0] },
      { type: 'weekdays', days: [8] },
      { type: 'weekdays', days: [1.5] },
      { type: 'weekdays', days: [1, 1] },
      { type: 'times_per_week', times: 0 },
      { type: 'times_per_week', times: 8 },
      { type: 'times_per_week', times: 2.5 },
      { type: 'every_n_days', n: 0, from: '2026-11-06' },
      { type: 'every_n_days', n: 1.5, from: '2026-11-06' },
      { type: 'every_n_days', n: 2 },
      { type: 'every_n_days', n: 2, from: '2026-02-30' },
      { type: 'every_n_days', n: 2, from: '06/11/2026' },
      { type: 'monthly', day: 0 },
      { type: 'monthly', day: 32 },
      { type: 'monthly', day: '15' },
      { type: 'yearly', month: 0, day: 1 },
      { type: 'yearly', month: 13, day: 1 },
      { type: 'yearly', month: 2, day: 30 },
      { type: 'yearly', month: 4, day: 31 },
      { type: 'yearly', month: 11, day: 31 },
      { type: 'yearly', month: 1 },
    ];
    for (const value of invalid) {
      expect(frequencySchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('isScheduled', () => {
  it('schedules a daily mission every day', () => {
    expect(scheduledDays({ type: 'daily' }, '2026-11-02', '2026-11-08')).toHaveLength(7);
  });

  it('schedules a weekdays mission on the chosen days only', () => {
    expect(
      scheduledDays({ type: 'weekdays', days: [1, 3, 5] }, '2026-11-02', '2026-11-08'),
    ).toEqual(['2026-11-02', '2026-11-04', '2026-11-06']);
    expect(scheduledDays({ type: 'weekdays', days: [7] }, '2026-11-02', '2026-11-15')).toEqual([
      '2026-11-08',
      '2026-11-15',
    ]);
  });

  describe('times_per_week', () => {
    const threeTimes: Frequency = { type: 'times_per_week', times: 3 };

    it('appears every day until the number is reached, then disappears for the rest of the week', () => {
      const ctx: ScheduleContext = {
        weekStart: 1,
        completedDays: ['2026-11-02', '2026-11-03', '2026-11-04'],
      };
      expect(scheduledDays(threeTimes, '2026-11-02', '2026-11-08', ctx)).toEqual([
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
      ]);
    });

    it('stays on the day it reaches the number, so that it shows as done', () => {
      const ctx: ScheduleContext = {
        weekStart: 1,
        completedDays: ['2026-11-02', '2026-11-03', '2026-11-04'],
      };
      expect(isScheduled(threeTimes, '2026-11-04', ctx)).toBe(true);
      expect(isScheduled(threeTimes, '2026-11-05', ctx)).toBe(false);
    });

    it('starts again from zero in a new week', () => {
      const ctx: ScheduleContext = {
        weekStart: 1,
        completedDays: ['2026-11-02', '2026-11-03', '2026-11-04'],
      };
      expect(isScheduled(threeTimes, '2026-11-09', ctx)).toBe(true);
    });

    it('counts the week from the chosen week start', () => {
      // Sunday 1, Monday 2 and Tuesday 3 November.
      const completedDays: GameDay[] = ['2026-11-01', '2026-11-02', '2026-11-03'];
      // Weeks from Sunday: three completions in the week of Wednesday 4 November.
      expect(isScheduled(threeTimes, '2026-11-04', { weekStart: 7, completedDays })).toBe(false);
      // Weeks from Monday: Sunday 1 November belongs to the week before.
      expect(isScheduled(threeTimes, '2026-11-04', { weekStart: 1, completedDays })).toBe(true);
    });

    it('counts a day only once', () => {
      const ctx: ScheduleContext = {
        weekStart: 1,
        completedDays: ['2026-11-02', '2026-11-02', '2026-11-02'],
      };
      expect(isScheduled(threeTimes, '2026-11-03', ctx)).toBe(true);
    });
  });

  describe('every_n_days', () => {
    it('is scheduled every n days from the start day', () => {
      expect(
        scheduledDays(
          { type: 'every_n_days', n: 3, from: '2026-11-06' },
          '2026-11-01',
          '2026-11-13',
        ),
      ).toEqual(['2026-11-06', '2026-11-09', '2026-11-12']);
    });

    it('is never scheduled before the start day', () => {
      // 3 November is 3 days before the start: a multiple of n, but in the past.
      expect(
        isScheduled({ type: 'every_n_days', n: 3, from: '2026-11-06' }, '2026-11-03', NO_HISTORY),
      ).toBe(false);
      expect(
        scheduledDays(
          { type: 'every_n_days', n: 1, from: '2026-11-06' },
          '2026-11-04',
          '2026-11-08',
        ),
      ).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    });

    it('counts real calendar days across the end of February', () => {
      expect(
        scheduledDays(
          { type: 'every_n_days', n: 2, from: '2028-02-27' },
          '2028-02-27',
          '2028-03-03',
        ),
      ).toEqual(['2028-02-27', '2028-02-29', '2028-03-02']);
    });
  });

  describe('monthly', () => {
    it('is scheduled on the chosen day of the month', () => {
      expect(scheduledDays({ type: 'monthly', day: 15 }, '2026-11-01', '2026-12-31')).toEqual([
        '2026-11-15',
        '2026-12-15',
      ]);
    });

    it('moves the 31st to the last day of shorter months', () => {
      expect(scheduledDays({ type: 'monthly', day: 31 }, '2026-01-01', '2026-06-30')).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
        '2026-05-31',
        '2026-06-30',
      ]);
    });

    it('uses 29 February in leap years', () => {
      expect(scheduledDays({ type: 'monthly', day: 31 }, '2028-02-01', '2028-02-29')).toEqual([
        '2028-02-29',
      ]);
      expect(scheduledDays({ type: 'monthly', day: 30 }, '2026-02-01', '2026-03-31')).toEqual([
        '2026-02-28',
        '2026-03-30',
      ]);
    });
  });

  describe('yearly', () => {
    it('is scheduled once a year on the chosen date', () => {
      const birthday: Frequency = { type: 'yearly', month: 11, day: 6 };
      expect(scheduledDays(birthday, '2026-01-01', '2027-12-31')).toEqual([
        '2026-11-06',
        '2027-11-06',
      ]);
    });

    it('moves 29 February to the 28th in years that are not leap years', () => {
      const leapDay: Frequency = { type: 'yearly', month: 2, day: 29 };
      expect(scheduledDays(leapDay, '2026-01-01', '2026-12-31')).toEqual(['2026-02-28']);
      expect(scheduledDays(leapDay, '2028-01-01', '2028-12-31')).toEqual(['2028-02-29']);
      expect(scheduledDays(leapDay, '2100-01-01', '2100-12-31')).toEqual(['2100-02-28']);
    });
  });

  it('rejects a day that does not exist', () => {
    expect(() => isScheduled({ type: 'daily' }, '2026-02-30', NO_HISTORY)).toThrow(RangeError);
  });
});

describe('isDueToday', () => {
  it('shows an active habit on the days its frequency schedules', () => {
    const mondays = mission({ frequency: { type: 'weekdays', days: [1] } });
    expect(isDueToday(mondays, '2026-11-02', NO_HISTORY)).toBe(true);
    expect(isDueToday(mondays, '2026-11-03', NO_HISTORY)).toBe(false);
  });

  it('never shows a habit without a frequency', () => {
    expect(isDueToday(mission({ frequency: null }), '2026-11-06', NO_HISTORY)).toBe(false);
  });

  it('hides a paused mission until the end day, when it comes back by itself', () => {
    const paused = mission({ status: 'paused', pausedUntil: '2026-11-10' });
    expect(isDueToday(paused, '2026-11-06', NO_HISTORY)).toBe(false);
    expect(isDueToday(paused, '2026-11-09', NO_HISTORY)).toBe(false);
    expect(isDueToday(paused, '2026-11-10', NO_HISTORY)).toBe(true);
    expect(isDueToday(paused, '2026-11-11', NO_HISTORY)).toBe(true);
  });

  it('still follows the frequency after the pause', () => {
    // 10 November 2026 is a Tuesday: a Monday habit comes back on Monday 16.
    const paused = mission({
      status: 'paused',
      pausedUntil: '2026-11-10',
      frequency: { type: 'weekdays', days: [1] },
    });
    expect(isDueToday(paused, '2026-11-10', NO_HISTORY)).toBe(false);
    expect(isDueToday(paused, '2026-11-16', NO_HISTORY)).toBe(true);
  });

  it('hides a mission paused without an end day', () => {
    expect(isDueToday(mission({ status: 'paused' }), '2026-11-06', NO_HISTORY)).toBe(false);
  });

  it('hides archived and deleted missions', () => {
    expect(isDueToday(mission({ status: 'archived' }), '2026-11-06', NO_HISTORY)).toBe(false);
    const deletedAt = Date.UTC(2026, 10, 5, 12, 0);
    expect(isDueToday(mission({ deletedAt }), '2026-11-06', NO_HISTORY)).toBe(false);
    expect(isDueToday(task('2026-11-06', { deletedAt }), '2026-11-06', NO_HISTORY)).toBe(false);
  });

  describe('tasks', () => {
    it('shows a task due today or overdue and not completed', () => {
      expect(isDueToday(task('2026-11-06'), '2026-11-06', NO_HISTORY)).toBe(true);
      expect(isDueToday(task('2026-11-01'), '2026-11-06', NO_HISTORY)).toBe(true);
    });

    it('hides a task due later and a task without a due day', () => {
      expect(isDueToday(task('2026-11-07'), '2026-11-06', NO_HISTORY)).toBe(false);
      expect(isDueToday(task(null), '2026-11-06', NO_HISTORY)).toBe(false);
    });

    it('hides a task completed on an earlier day', () => {
      const ctx: ScheduleContext = { weekStart: 1, completedDays: ['2026-11-04'] };
      expect(isDueToday(task('2026-11-01'), '2026-11-06', ctx)).toBe(false);
    });

    it('keeps a task completed today, shown as done', () => {
      const ctx: ScheduleContext = { weekStart: 1, completedDays: ['2026-11-06'] };
      expect(isDueToday(task('2026-11-01'), '2026-11-06', ctx)).toBe(true);
    });

    it('counts a past day as due when the task was completed only later', () => {
      const ctx: ScheduleContext = { weekStart: 1, completedDays: ['2026-11-06'] };
      expect(isDueToday(task('2026-11-01'), '2026-11-03', ctx)).toBe(true);
    });

    it('hides a paused task', () => {
      expect(isDueToday(task('2026-11-06', { status: 'paused' }), '2026-11-06', NO_HISTORY)).toBe(
        false,
      );
    });
  });

  it('rejects a day that does not exist', () => {
    expect(() => isDueToday(task('2026-11-01'), '2026-13-01', NO_HISTORY)).toThrow(RangeError);
  });
});
