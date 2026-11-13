import { NOTIFICATIONS } from './config';
import { addDays } from './gameDay';
import type { PlannedReminder } from './reminders';
import type { GameDay } from './types';

// How the notifications are put together (design-sezioni.md 11.4 and 11.5): reminders of the same
// minute grouped, the content of the evening summary and its instant. Pure functions: the texts
// are written elsewhere, from what these return.

const MS_PER_MINUTE = 60_000;

/** One notification of the system: a single reminder, or a group of reminders of one minute. */
export interface ReminderSlot {
  readonly fireAt: number;
  readonly grouped: boolean;
  readonly members: readonly PlannedReminder[];
}

/**
 * The notifications of the planned reminders: `minGroup` or more reminders in the same minute
 * become one group (design 11.4: «3 missioni per adesso»), the others stay one per mission. The
 * order of the reminders is kept, a group at the place of its first member.
 */
export function reminderSlots(
  reminders: readonly PlannedReminder[],
  minGroup: number = NOTIFICATIONS.groupMinSize,
): ReminderSlot[] {
  const byMinute = new Map<number, PlannedReminder[]>();
  for (const reminder of reminders) {
    const minute = Math.floor(reminder.fireAt / MS_PER_MINUTE);
    const members = byMinute.get(minute);
    if (members === undefined) {
      byMinute.set(minute, [reminder]);
    } else {
      members.push(reminder);
    }
  }
  return [...byMinute.values()].flatMap((members): ReminderSlot[] =>
    members.length >= minGroup
      ? [{ fireAt: members[0].fireAt, grouped: true, members }]
      : members.map((member) => ({ fireAt: member.fireAt, grouped: false, members: [member] })),
  );
}

/** What the evening summary says: a compliment, or the missions still to do. */
export type EveningSummary =
  | { readonly kind: 'all_done' }
  | {
      readonly kind: 'left';
      /** Missions still to do. */
      readonly count: number;
      /** The first of them by name, at most `maxNames`. */
      readonly names: readonly string[];
      /** The ones not named: «e altre 2». */
      readonly others: number;
    };

/**
 * The evening summary of a day from its missions in the order of Today (skipped ones left out):
 * null with no mission, the compliment with all done, else at most `maxNames` names and the
 * number of the others (design 11.5).
 */
export function eveningSummary(
  missions: readonly { readonly name: string; readonly done: boolean }[],
  maxNames: number = NOTIFICATIONS.eveningMaxNames,
): EveningSummary | null {
  if (missions.length === 0) {
    return null;
  }
  const left = missions.filter((mission) => !mission.done).map((mission) => mission.name);
  if (left.length === 0) {
    return { kind: 'all_done' };
  }
  const names = left.slice(0, maxNames);
  return { kind: 'left', count: left.length, names, others: left.length - names.length };
}

export interface EveningSummaryAtInput {
  readonly day: GameDay;
  /** Local `HH:MM` chosen in the Settings. */
  readonly time: string;
  /** Local `HH:MM` when the game day starts (the day change of the day before). */
  readonly dayChange: string;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function localMinutes(day: GameDay, minutes: number): number {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, dayOfMonth) / MS_PER_MINUTE + minutes;
}

/**
 * UTC instant of the evening summary of a game day. A time before the day change belongs to the
 * night after the game day, as for the reminders.
 */
export function eveningSummaryAt({
  day,
  time,
  dayChange,
  tzOffset,
}: EveningSummaryAtInput): number {
  const start = localMinutes(day, minutesOf(dayChange));
  let local = localMinutes(day, minutesOf(time));
  if (local < start) {
    local = localMinutes(addDays(day, 1), minutesOf(time));
  }
  return (local - tzOffset) * MS_PER_MINUTE;
}
