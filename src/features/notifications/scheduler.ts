import { and, inArray, ne } from 'drizzle-orm';

import { notDeleted } from '../../db/repositories/events';
import { dayChangeOn, gameDayOf, getSetting, weekRulesOn } from '../../db/repositories/settings';
import { missionDays, missionReminders, missions, scheduledReminders } from '../../db/schema';
import type { Db } from '../../db/types';
import { REMINDERS } from '../../rules/config';
import { addDays, weekStartOf } from '../../rules/gameDay';
import type { GameDay } from '../../rules/types';
import { reminderSlots, type ReminderSlot } from '../../rules/notifications';
import { plannedReminders } from '../../rules/reminders';
import {
  groupOf,
  scheduleReminder,
  scheduleReminderGroup,
  type ReminderScheduler,
} from './reminders';

// Keeps the notifications of the system and `scheduled_reminders` aligned with the reminders of
// the missions, on a window of a few days (iOS keeps at most 64 scheduled notifications). It runs
// at the start of the app, after every action (a change of a mission or of the settings, a
// completion, an undo) and after an action from a notification. Like `reminders.ts` it depends
// on no Expo module: the system sits behind `ReminderScheduler`.

export interface SyncInput {
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

export interface SyncResult {
  readonly scheduled: number;
  readonly cancelled: number;
}

/** The reminders that should be scheduled from `now` on, with the game day of `now`. */
function plan(db: Db, { now, tzOffset }: SyncInput) {
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(now, tzOffset, dayChange);
  // The general switch of the Settings off: no reminder is wanted, the scheduled ones go.
  if (!getSetting(db, 'reminders_enabled')) {
    return { today, planned: [] };
  }
  // A change of the week rules counts at the latest from tomorrow: the days after are the same.
  const tomorrow = addDays(today, 1);
  const rules = { today: weekRulesOn(db, today), later: weekRulesOn(db, tomorrow) };
  const rulesOn = (day: GameDay) => (day < tomorrow ? rules.today : rules.later);
  const candidates = db
    .select()
    .from(missions)
    .where(and(notDeleted(missions), ne(missions.status, 'archived')))
    .all();
  const ids = candidates.map((mission) => mission.id);
  if (ids.length === 0) {
    return { today, planned: [] };
  }
  const reminders = db
    .select()
    .from(missionReminders)
    .where(inArray(missionReminders.missionId, ids))
    .all();
  // A skip counts like a completion: the mission is not expected any more that day. With a
  // first day of the week changing tomorrow, the earlier of the two weeks is read.
  const thisWeek = [today, tomorrow]
    .map((day) => weekStartOf(today, rulesOn(day).weekStart))
    .reduce((first, start) => (start < first ? start : first));
  const taskIds = new Set(candidates.filter((m) => m.kind === 'task').map((m) => m.id));
  const done = db
    .select({ missionId: missionDays.missionId, day: missionDays.gameDay })
    .from(missionDays)
    .where(
      and(inArray(missionDays.missionId, ids), inArray(missionDays.status, ['done', 'skipped'])),
    )
    .all()
    .filter((row) => taskIds.has(row.missionId) || row.day >= thisWeek);
  const planned = plannedReminders({
    missions: candidates,
    reminders,
    done,
    fromDay: today,
    days: REMINDERS.windowDays,
    quietHours: getSetting(db, 'quiet_hours'),
    dayChange: (day) => dayChangeOn(dayChange, day),
    tzOffset,
    weekStart: (day) => rulesOn(day).weekStart,
    restDays: (day) => rulesOn(day).restDays,
  });
  return { today, planned };
}

const keyOf = (reminder: { missionId: string; fireAt: number }) =>
  `${reminder.missionId}@${reminder.fireAt}`;

/** The key of a group: its minute and its missions, in any order. */
const groupKeyOf = (fireAt: number, missionIds: readonly string[]) =>
  `group@${fireAt}@${[...missionIds].sort().join(',')}`;

async function sync(db: Db, scheduler: ReminderScheduler, input: SyncInput): Promise<SyncResult> {
  const { today, planned } = plan(db, input);
  const dueOn = new Set(planned.map((reminder) => `${reminder.missionId}@${reminder.gameDay}`));
  const future = planned.filter((reminder) => reminder.fireAt > input.now);
  const existing = db.select().from(scheduledReminders).all();

  const stale: string[] = [];
  const keptFuture: (typeof existing)[number][] = [];
  let snoozedFuture = 0;
  for (const row of existing) {
    if (row.gameDay < today) {
      // The day is over: its notifications have nothing left to remind.
      stale.push(row.osId);
    } else if (row.fireAt <= input.now) {
      // Already shown today: Snooze and Complete still need the row.
    } else if (row.snoozeCount > 0) {
      // A snooze asked by the user, as long as the mission is still expected that day.
      if (dueOn.has(`${row.missionId}@${row.gameDay}`)) {
        snoozedFuture += 1;
      } else {
        stale.push(row.osId);
      }
    } else {
      keptFuture.push(row);
    }
  }

  // The notifications wanted: one for each reminder, or one for 3 or more of the same minute.
  const slots = reminderSlots(future.slice(0, Math.max(0, REMINDERS.maxScheduled - snoozedFuture)));
  const wanted = new Map<string, ReminderSlot>(
    slots.map((slot) => [
      slot.grouped
        ? groupKeyOf(
            slot.fireAt,
            slot.members.map((member) => member.missionId),
          )
        : keyOf(slot.members[0]),
      slot,
    ]),
  );

  // The scheduled notifications that are still wanted stay; a group stays only whole.
  const groups = new Map<string, (typeof existing)[number][]>();
  for (const row of keptFuture) {
    const group = groupOf(row.osId);
    if (group === null) {
      const key = keyOf(row);
      const slot = wanted.get(key);
      if (slot !== undefined && !slot.grouped && slot.members[0].gameDay === row.gameDay) {
        wanted.delete(key);
      } else {
        stale.push(row.osId);
      }
    } else {
      groups.set(group.groupId, [...(groups.get(group.groupId) ?? []), row]);
    }
  }
  for (const rows of groups.values()) {
    const size = groupOf(rows[0].osId)?.size;
    const key = groupKeyOf(
      rows[0].fireAt,
      rows.map((row) => row.missionId),
    );
    const slot = wanted.get(key);
    const sameDays =
      slot?.members.every((member) =>
        rows.some((row) => row.missionId === member.missionId && row.gameDay === member.gameDay),
      ) ?? false;
    if (rows.length === size && slot !== undefined && sameDays) {
      wanted.delete(key);
    } else {
      stale.push(...rows.map((row) => row.osId));
    }
  }

  if (stale.length > 0) {
    await scheduler.cancel(stale);
    db.delete(scheduledReminders).where(inArray(scheduledReminders.osId, stale)).run();
  }
  let scheduled = 0;
  for (const slot of wanted.values()) {
    if (slot.grouped) {
      await scheduleReminderGroup(db, scheduler, { members: slot.members, fireAt: slot.fireAt });
    } else {
      const [reminder] = slot.members;
      await scheduleReminder(db, scheduler, {
        missionId: reminder.missionId,
        fireAt: reminder.fireAt,
        gameDay: reminder.gameDay,
        now: input.now,
        tzOffset: input.tzOffset,
      });
    }
    scheduled += slot.members.length;
  }
  return { scheduled, cancelled: stale.length };
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` after the syncs already started and before the next ones, so a sync in progress
 * cannot schedule again what `task` cancels («Elimina tutti i dati»).
 */
export function afterReminderSyncs<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Aligns the scheduled notifications with the reminders of the missions: schedules the missing
 * ones of the window (the earliest, within the iOS limit), cancels the ones no longer wanted
 * and those of the days already over. Reminders already shown today and snoozed ones stay, so
 * their actions still work. Calls run one after the other, never together.
 */
export function syncReminders(
  db: Db,
  scheduler: ReminderScheduler,
  input: SyncInput,
): Promise<SyncResult> {
  return afterReminderSyncs(() => sync(db, scheduler, input));
}
