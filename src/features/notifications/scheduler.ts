import { and, inArray, ne } from 'drizzle-orm';

import { notDeleted } from '../../db/repositories/events';
import { dayChangeOn, gameDayOf, getSetting, weekRulesOn } from '../../db/repositories/settings';
import { missionDays, missionReminders, missions, scheduledReminders } from '../../db/schema';
import type { Db } from '../../db/types';
import { REMINDERS } from '../../rules/config';
import { addDays, weekStartOf } from '../../rules/gameDay';
import type { GameDay } from '../../rules/types';
import { plannedReminders, type PlannedReminder } from '../../rules/reminders';
import { scheduleReminder, type ReminderScheduler } from './reminders';

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

async function sync(db: Db, scheduler: ReminderScheduler, input: SyncInput): Promise<SyncResult> {
  const { today, planned } = plan(db, input);
  const dueOn = new Set(planned.map((reminder) => `${reminder.missionId}@${reminder.gameDay}`));
  const future = planned.filter((reminder) => reminder.fireAt > input.now);
  const existing = db.select().from(scheduledReminders).all();

  const stale: string[] = [];
  const keptFuture = new Set<string>();
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
      keptFuture.add(row.osId);
    }
  }

  const wanted = new Map<string, PlannedReminder>(
    future
      .slice(0, Math.max(0, REMINDERS.maxScheduled - snoozedFuture))
      .map((reminder) => [keyOf(reminder), reminder]),
  );
  for (const row of existing) {
    if (keptFuture.has(row.osId)) {
      const key = keyOf(row);
      if (wanted.get(key)?.gameDay === row.gameDay) {
        wanted.delete(key);
      } else {
        stale.push(row.osId);
      }
    }
  }

  if (stale.length > 0) {
    await scheduler.cancel(stale);
    db.delete(scheduledReminders).where(inArray(scheduledReminders.osId, stale)).run();
  }
  for (const reminder of wanted.values()) {
    await scheduleReminder(db, scheduler, {
      missionId: reminder.missionId,
      fireAt: reminder.fireAt,
      gameDay: reminder.gameDay,
      now: input.now,
      tzOffset: input.tzOffset,
    });
  }
  return { scheduled: wanted.size, cancelled: stale.length };
}

let queue: Promise<unknown> = Promise.resolve();

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
  const run = queue.then(() => sync(db, scheduler, input));
  queue = run.catch(() => undefined);
  return run;
}
