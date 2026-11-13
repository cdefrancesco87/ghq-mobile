import { isDueToday, type DueMission } from './frequency';
import { addDays, weekday, type Weekday } from './gameDay';
import type { GameDay } from './types';

// When the reminders of the missions fire (analisi-funzionale.md section 11, design-sezioni.md
// 11.1 and 11.4): on the days the frequency schedules, at the local times chosen in the editor,
// never during «Non disturbare» and never for a mission already done that day. Pure function:
// the time zone and the day change arrive as parameters.

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 24 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A mission as the reminders need it: a row of `missions`. */
export interface ReminderMission extends DueMission {
  readonly id: string;
  /** Local `HH:MM` of the due time of a task; null or missing for a task without a time. */
  readonly dueTime?: string | null;
}

/** A row of `mission_reminders`: a time for habits, minutes before the due time for tasks. */
export interface ReminderTime {
  readonly missionId: string;
  readonly time: string | null;
  readonly leadMinutes: number | null;
}

/** A «Non disturbare» interval in local `HH:MM`; it can cross midnight (22:00–07:00). */
export interface QuietInterval {
  readonly start: string;
  readonly end: string;
}

export interface PlannedRemindersInput {
  readonly missions: readonly ReminderMission[];
  readonly reminders: readonly ReminderTime[];
  /** The game days on which a mission was done or skipped: no reminder on those days. */
  readonly done: readonly { readonly missionId: string; readonly day: GameDay }[];
  /** First game day of the window, usually today. */
  readonly fromDay: GameDay;
  /** Number of game days in the window. */
  readonly days: number;
  readonly quietHours: readonly QuietInterval[];
  /**
   * The local `HH:MM` when a game day ends, on the next calendar day: one time for every day, or
   * the time of each day while a change of the setting is pending.
   */
  readonly dayChange: string | ((day: GameDay) => string);
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
  /** The first day of the week: one for every day, or the one of each day while it changes. */
  readonly weekStart: Weekday | ((day: GameDay) => Weekday);
  /** No mission is due on a rest day, so no reminder fires. */
  readonly restDays: readonly Weekday[] | ((day: GameDay) => readonly Weekday[]);
}

export interface PlannedReminder {
  readonly missionId: string;
  /** The game day the reminder belongs to: completing the mission that day cancels it. */
  readonly gameDay: GameDay;
  /** UTC instant in milliseconds. */
  readonly fireAt: number;
}

function minutesOf(time: string): number {
  const match = TIME_PATTERN.exec(time);
  if (!match) {
    throw new RangeError(`Invalid time (expected HH:MM): ${time}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Local minutes since 1970-01-01 00:00 of a time on a calendar day. */
function localMinutes(day: GameDay, minutes: number): number {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, dayOfMonth) / MS_PER_MINUTE + minutes;
}

/** The local minute when the quiet hours around `local` end, or `local` outside them. */
function afterQuietHours(local: number, quietHours: readonly QuietInterval[]): number {
  let result = local;
  // Each interval can move the reminder at most once more than the others: n + 1 passes settle
  // intervals that lead into each other.
  for (let pass = 0; pass <= quietHours.length; pass++) {
    let moved = false;
    for (const interval of quietHours) {
      const start = minutesOf(interval.start);
      const end = minutesOf(interval.end);
      const minute = ((result % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
      const midnight = result - minute;
      if (start < end && minute >= start && minute < end) {
        result = midnight + end;
        moved = true;
      } else if (start > end && minute >= start) {
        result = midnight + MINUTES_PER_DAY + end;
        moved = true;
      } else if (start > end && minute < end) {
        result = midnight + end;
        moved = true;
      }
    }
    if (!moved) {
      break;
    }
  }
  return result;
}

/**
 * The UTC instant when «Non disturbare» around `now` ends, or `now` outside it: a notification
 * that is not a reminder (the goal reached with the health data, design-sezioni.md 12.7) waits
 * until then.
 *
 * @param tzOffset Minutes east of UTC.
 */
export function quietHoursEnd(
  now: number,
  tzOffset: number,
  quietHours: readonly QuietInterval[],
): number {
  const local = Math.floor(now / MS_PER_MINUTE) + tzOffset;
  const end = afterQuietHours(local, quietHours);
  return end === local ? now : (end - tzOffset) * MS_PER_MINUTE;
}

/**
 * The reminders to schedule in a window of game days, ordered by instant. A time earlier than the
 * day change belongs to the night after the game day (01:30 of Monday fires on Tuesday at 01:30).
 * A reminder inside «Non disturbare» waits until the end of the interval, and two times of the
 * same mission brought together fire once; one that would wait past the end of its game day is
 * dropped, because by then the day is closed. A task is reminded only on its due day, the chosen
 * minutes before its due time.
 */
export function plannedReminders(input: PlannedRemindersInput): PlannedReminder[] {
  const { dayChange } = input;
  const dayChangeOf = typeof dayChange === 'string' ? () => dayChange : dayChange;
  const { weekStart, restDays } = input;
  const weekStartOn = typeof weekStart === 'function' ? weekStart : () => weekStart;
  const restDaysOn = typeof restDays === 'function' ? restDays : () => restDays;
  const missionsById = new Map(input.missions.map((mission) => [mission.id, mission]));
  const planned = new Map<string, PlannedReminder>();

  for (let offset = 0; offset < input.days; offset++) {
    const day = addDays(input.fromDay, offset);
    if (restDaysOn(day).includes(weekday(day))) {
      continue;
    }
    const dayStart = localMinutes(day, minutesOf(dayChangeOf(addDays(day, -1))));
    const dayEnd = localMinutes(addDays(day, 1), minutesOf(dayChangeOf(day)));
    /** A local time of the game day: before its start it is the night after. */
    const onGameDay = (time: string) => {
      const local = localMinutes(day, minutesOf(time));
      return local < dayStart ? localMinutes(addDays(day, 1), minutesOf(time)) : local;
    };

    for (const reminder of input.reminders) {
      const mission = missionsById.get(reminder.missionId);
      if (mission === undefined) {
        continue;
      }
      const completedDays = input.done
        .filter((row) => row.missionId === mission.id)
        .map((row) => row.day);
      if (
        completedDays.includes(day) ||
        !isDueToday(mission, day, { weekStart: weekStartOn(day), completedDays })
      ) {
        continue;
      }

      let local: number;
      if (mission.kind === 'habit') {
        if (reminder.time === null) {
          continue;
        }
        local = onGameDay(reminder.time);
      } else {
        // An overdue task stays in Today, but it is reminded only on its due day.
        if (reminder.leadMinutes === null || mission.dueTime == null || mission.dueDay !== day) {
          continue;
        }
        local = onGameDay(mission.dueTime) - reminder.leadMinutes;
      }

      local = afterQuietHours(local, input.quietHours);
      if (local >= dayEnd) {
        continue;
      }
      const fireAt = (local - input.tzOffset) * MS_PER_MINUTE;
      planned.set(`${mission.id}@${fireAt}`, { missionId: mission.id, gameDay: day, fireAt });
    }
  }

  return [...planned.values()].sort(
    (a, b) =>
      a.fireAt - b.fireAt || (a.missionId < b.missionId ? -1 : a.missionId > b.missionId ? 1 : 0),
  );
}
