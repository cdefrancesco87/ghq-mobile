import { HABITS_LIST } from './config';
import { isScheduled, type Frequency } from './frequency';
import { addDays, weekday, weekStartOf, type Weekday } from './gameDay';
import type { GameDay } from './types';

// The completion rate of a mission in the last 30 days, shown in Habits (design-sezioni.md 3.2).
// The documents give no formula: skipped and paused days are excluded (backlog T46), and the rest
// follows the day closing (src/rules/closeDays.ts).

/** Days of a pause: from `from` included to `until` excluded; `until` null is a pause still on. */
export interface PauseSpan {
  readonly from: GameDay;
  readonly until: GameDay | null;
}

export interface RateMission {
  readonly kind: 'habit' | 'task';
  /** Null for tasks. */
  readonly frequency: Frequency | null;
  readonly dueDay: GameDay | null;
  /** The game day of its creation: the window never starts before it. */
  readonly createdDay: GameDay;
}

export interface RateInput {
  readonly mission: RateMission;
  /** The last day of the window, still open: today, or the day the mission was archived. */
  readonly lastDay: GameDay;
  /** What happened on the days of the mission (`mission_days`); every day for a task. */
  readonly days: readonly { readonly gameDay: GameDay; readonly status: string }[];
  readonly pauses: readonly PauseSpan[];
  readonly restDays: readonly Weekday[];
  readonly weekStart: Weekday;
}

/** The mission events that start and end a pause, in the order of the log. */
export interface PauseEvent {
  readonly type: string;
  readonly gameDay: GameDay;
  /** `paused_until` of a `mission.paused` event: the first day active again. */
  readonly until?: GameDay | null;
}

const PAUSE_ENDS = new Set(['mission.resumed', 'mission.archived', 'mission.deleted']);

/** The pauses of a mission from its events: a resume, an archive or a new pause ends a pause. */
export function pauseSpans(events: readonly PauseEvent[]): PauseSpan[] {
  const spans: PauseSpan[] = [];
  let open: PauseSpan | null = null;
  const close = (day: GameDay) => {
    if (open !== null) {
      spans.push({
        from: open.from,
        until: open.until !== null && open.until < day ? open.until : day,
      });
      open = null;
    }
  };
  for (const event of events) {
    if (event.type === 'mission.paused') {
      close(event.gameDay);
      open = { from: event.gameDay, until: event.until ?? null };
    } else if (PAUSE_ENDS.has(event.type)) {
      close(event.gameDay);
    }
  }
  if (open !== null) {
    spans.push(open);
  }
  return spans;
}

function isPaused(day: GameDay, pauses: readonly PauseSpan[]): boolean {
  return pauses.some((span) => day >= span.from && (span.until === null || day < span.until));
}

/**
 * The share of the expected occurrences that were done, from 0 to 100 rounded down, or null when
 * nothing was expected yet. The window is the last 30 game days up to `lastDay`, from the day of
 * creation; `lastDay` is still open, so it counts only when done. A partial measurable mission
 * counts as not done.
 *
 * - Habits by day: the days of the frequency, without skipped, paused and rest days (a day done
 *   counts anyway).
 * - `times_per_week`: N per closed week, minus one for every skip and paused day (CLAUDE.md,
 *   choices 17 and 23), at most N completions counted. A week still open, or cut by the window or
 *   by the creation, is never missed: it counts only its completions (choice 16).
 * - Tasks: 100 when done, 0 when the due day has passed, otherwise null.
 */
export function completionRate(input: RateInput): number | null {
  const { mission, lastDay } = input;
  const status = new Map(input.days.map((day) => [day.gameDay, day.status]));
  if (mission.kind === 'task') {
    if (input.days.some((day) => day.status === 'done' && day.gameDay <= lastDay)) {
      return 100;
    }
    return mission.dueDay !== null && mission.dueDay < lastDay ? 0 : null;
  }
  const windowStart = addDays(lastDay, 1 - HABITS_LIST.rateWindowDays);
  const first = mission.createdDay > windowStart ? mission.createdDay : windowStart;
  if (first > lastDay || mission.frequency === null) {
    return null;
  }
  const { expected, done } =
    mission.frequency.type === 'times_per_week'
      ? byWeek(input, mission.frequency.times, first, status)
      : byDay(input, mission.frequency, first, status);
  return expected === 0 ? null : Math.floor((done / expected) * 100);
}

function byDay(
  { lastDay, pauses, restDays, weekStart }: RateInput,
  frequency: Frequency,
  first: GameDay,
  status: ReadonlyMap<GameDay, string>,
) {
  let expected = 0;
  let done = 0;
  for (let day = first; day <= lastDay; day = addDays(day, 1)) {
    if (!isScheduled(frequency, day, { weekStart, completedDays: [] })) {
      continue;
    }
    const state = status.get(day);
    if (state === 'done') {
      expected++;
      done++;
    } else if (
      day !== lastDay &&
      state !== 'skipped' &&
      !restDays.includes(weekday(day)) &&
      !isPaused(day, pauses)
    ) {
      expected++;
    }
  }
  return { expected, done };
}

function byWeek(
  { lastDay, pauses, weekStart }: RateInput,
  times: number,
  first: GameDay,
  status: ReadonlyMap<GameDay, string>,
) {
  let expected = 0;
  let done = 0;
  for (let week = weekStartOf(first, weekStart); week <= lastDay; week = addDays(week, 7)) {
    const weekEnd = addDays(week, 6);
    let completed = 0;
    let excused = 0;
    for (
      let day = week < first ? first : week;
      day <= weekEnd && day <= lastDay;
      day = addDays(day, 1)
    ) {
      const state = status.get(day);
      if (state === 'done') {
        completed++;
      } else if (state === 'skipped' || isPaused(day, pauses)) {
        excused++;
      }
    }
    const required = Math.max(0, times - excused);
    const counted = Math.min(completed, required);
    // Only a whole week that is over can be missed.
    const whole = week >= first && weekEnd < lastDay;
    expected += whole ? required : counted;
    done += counted;
  }
  return { expected, done };
}
