import { z } from 'zod';

import { diffDays, isGameDay, weekStartOf, weekday, type Weekday } from './gameDay';
import type { GameDay } from './types';

// When a mission is due. The frequency is stored as JSON in `missions.frequency` and validated
// with `frequencySchema` at every read and write (modello-dati.md, 3.4).

const weekdaySchema = z.literal([1, 2, 3, 4, 5, 6, 7]);
const gameDaySchema = z.custom<GameDay>(isGameDay, 'Expected a game day (YYYY-MM-DD)');

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month (1 = January … 12 = December). */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export const frequencySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('daily') }),
  z.strictObject({
    type: z.literal('weekdays'),
    days: z
      .array(weekdaySchema)
      .min(1)
      .refine((days) => new Set(days).size === days.length, 'Each weekday only once'),
  }),
  // Appears every day of the week until it is completed `times` times (at most once a day).
  z.strictObject({ type: z.literal('times_per_week'), times: z.number().int().min(1).max(7) }),
  z.strictObject({
    type: z.literal('every_n_days'),
    n: z.number().int().min(1),
    from: gameDaySchema,
  }),
  // In shorter months a day after the last one moves to the last day.
  z.strictObject({ type: z.literal('monthly'), day: z.number().int().min(1).max(31) }),
  // 29 February moves to the 28th in the years that are not leap years.
  z
    .strictObject({
      type: z.literal('yearly'),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    })
    .refine((frequency) => frequency.day <= daysInMonth(2000, frequency.month), {
      message: 'This day does not exist in this month',
      path: ['day'],
    }),
]);

export type Frequency = z.infer<typeof frequencySchema>;

export interface ScheduleContext {
  /** First day of the week, from the `week_start` setting: 1 = Monday … 7 = Sunday. */
  readonly weekStart: Weekday;
  /**
   * Game days on which this mission was completed. A `times_per_week` habit needs at least the
   * days of the current week; a task needs the day it was completed.
   */
  readonly completedDays: readonly GameDay[];
}

/** The fields of a mission (a row of `missions`) that decide whether it is due. */
export interface DueMission {
  readonly kind: 'habit' | 'task';
  /** Null for tasks. */
  readonly frequency: Frequency | null;
  /** Due day of a task, if any. */
  readonly dueDay: GameDay | null;
  readonly status: 'active' | 'paused' | 'archived';
  /** Day when a paused mission becomes active again by itself; null for an open-ended pause. */
  readonly pausedUntil: GameDay | null;
  readonly deletedAt: number | null;
}

function assertGameDay(day: GameDay): void {
  if (!isGameDay(day)) {
    throw new RangeError(`Invalid game day: ${day}`);
  }
}

/** Whether `frequency` schedules the mission on `day`, whatever the state of the mission. */
export function isScheduled(frequency: Frequency, day: GameDay, ctx: ScheduleContext): boolean {
  assertGameDay(day);
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  switch (frequency.type) {
    case 'daily':
      return true;
    case 'weekdays':
      return frequency.days.includes(weekday(day));
    case 'times_per_week': {
      // Only completions before `day` count, so the mission stays in the list (shown as done) on
      // the day it reaches the number. Game days in YYYY-MM-DD format compare as strings.
      const weekStart = weekStartOf(day, ctx.weekStart);
      const doneThisWeek = new Set(ctx.completedDays.filter((d) => d >= weekStart && d < day));
      return doneThisWeek.size < frequency.times;
    }
    case 'every_n_days': {
      const elapsed = diffDays(frequency.from, day);
      return elapsed >= 0 && elapsed % frequency.n === 0;
    }
    case 'monthly':
      return dayOfMonth === Math.min(frequency.day, daysInMonth(year, month));
    case 'yearly':
      return (
        month === frequency.month &&
        dayOfMonth === Math.min(frequency.day, daysInMonth(year, frequency.month))
      );
  }
}

/**
 * Whether the mission appears among the missions of `day` (US-OGGI-01): habits scheduled by
 * their frequency, plus tasks due on `day` or overdue and not completed before it. Paused,
 * archived and deleted missions never appear; a pause with an end day ends on that day.
 */
export function isDueToday(mission: DueMission, day: GameDay, ctx: ScheduleContext): boolean {
  assertGameDay(day);
  if (mission.deletedAt !== null || mission.status === 'archived') {
    return false;
  }
  if (mission.status === 'paused' && (mission.pausedUntil === null || day < mission.pausedUntil)) {
    return false;
  }
  if (mission.kind === 'task') {
    if (mission.dueDay === null || mission.dueDay > day) {
      return false;
    }
    // A task completed on `day` stays in the list of that day, shown as done.
    return !ctx.completedDays.some((completedDay) => completedDay < day);
  }
  return mission.frequency !== null && isScheduled(mission.frequency, day, ctx);
}
