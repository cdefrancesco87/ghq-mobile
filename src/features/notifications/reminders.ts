import { and, eq } from 'drizzle-orm';

import { completeMission, progressMission } from '../../db/repositories/completion';
import { notDeleted } from '../../db/repositories/events';
import { gameDayOf, getSetting } from '../../db/repositories/settings';
import { missions, scheduledReminders } from '../../db/schema';
import type { Db } from '../../db/types';
import type { GameDay } from '../../rules/types';
import { incrementLabel } from '../shared/amount';

// The logic of the actions on a reminder (stack-tecnologico.md, point 5; modello-dati.md 3.9 and
// 4.4). It depends on no screen, no React state and no Expo module: the notifications of the
// system sit behind `ReminderScheduler`, so the same code runs in the background task of the
// phone and in the tests, with the test database.

export const ACTION_COMPLETE = 'complete';
export const ACTION_SNOOZE = 'snooze';

export const SNOOZE_MS = 10 * 60_000;
export const MAX_SNOOZES = 3;

/** A notification to schedule in the operating system. */
export interface ReminderRequest {
  readonly missionId: string;
  readonly title: string;
  /** UTC instant of the delivery, in milliseconds. */
  readonly fireAt: number;
  /** How many times the reminder was snoozed: at the maximum there is no Snooze button. */
  readonly snoozeCount: number;
  /**
   * The increment of a measurable mission: its Complete button becomes «+250 ml» (design 11.3).
   * Null for a yes/no mission.
   */
  readonly increment: ReminderIncrement | null;
  /** The label of Complete: «+250 ml» for a measurable mission, null for the default one. */
  readonly completeLabel: string | null;
}

/** One tap of a measurable mission: an amount and the key of its unit (`liter`) or its text. */
export interface ReminderIncrement {
  readonly amount: number;
  readonly unit: string;
}

/** The notifications of the operating system, as the logic needs them. */
export interface ReminderScheduler {
  /** Schedules the notification and returns its id in the system. */
  schedule(request: ReminderRequest): Promise<string>;
  /** Cancels the scheduled notifications and removes the ones already shown. */
  cancel(osIds: readonly string[]): Promise<void>;
}

export interface ReminderActionInput {
  /** `complete`, `snooze` or any other identifier (a tap on the body of the notification). */
  readonly actionId: string;
  /** Id of the notification in the system: it is the base of the idempotency key. */
  readonly notificationId: string;
  readonly missionId: string;
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

export type ReminderOutcome =
  | { readonly outcome: 'completed' | 'already_done' | 'already_recorded' }
  /** A measurable mission moved on without reaching its target. */
  | { readonly outcome: 'progressed' }
  | { readonly outcome: 'snoozed'; osId: string; fireAt: number; snoozeCount: number }
  /** The reminder was snoozed three times already. */
  | { readonly outcome: 'snooze_limit' }
  /** Nothing to do: another action, or a reminder that is not remembered any more. */
  | { readonly outcome: 'ignored' }
  | { readonly outcome: 'failed'; readonly message: string };

export interface ScheduleReminderInput {
  readonly missionId: string;
  readonly fireAt: number;
  readonly now: number;
  readonly tzOffset: number;
  /** For a reminder that comes from a snooze. */
  readonly snoozeCount?: number;
  /** The game day the reminder belongs to; the game day of `now` when missing. */
  readonly gameDay?: GameDay;
}

function missionOf(db: Db, missionId: string) {
  const row = db
    .select({
      name: missions.name,
      goalType: missions.goalType,
      goalUnit: missions.goalUnit,
      goalStep: missions.goalStep,
    })
    .from(missions)
    .where(and(eq(missions.id, missionId), notDeleted(missions)))
    .get();
  if (row === undefined) {
    throw new RangeError(`No mission ${missionId}`);
  }
  return row;
}

/** The increment of a quantity goal; a duration goal uses its timer (T79), not the button. */
function incrementOf(mission: ReturnType<typeof missionOf>): ReminderIncrement | null {
  if (mission.goalType !== 'quantity' || mission.goalStep === null || mission.goalUnit === null) {
    return null;
  }
  return { amount: mission.goalStep, unit: mission.goalUnit };
}

function remember(
  db: Db,
  row: typeof scheduledReminders.$inferInsert,
  replacing: string | null,
): void {
  db.transaction((tx) => {
    if (replacing !== null) {
      tx.delete(scheduledReminders).where(eq(scheduledReminders.osId, replacing)).run();
    }
    tx.insert(scheduledReminders).values(row).run();
  });
}

/**
 * Schedules a reminder of a mission and remembers it in `scheduled_reminders`, so that a
 * completion can cancel it and the snoozes can be counted.
 */
export async function scheduleReminder(
  db: Db,
  scheduler: ReminderScheduler,
  input: ScheduleReminderInput,
  replacing: string | null = null,
): Promise<string> {
  const mission = missionOf(db, input.missionId);
  const increment = incrementOf(mission);
  const snoozeCount = input.snoozeCount ?? 0;
  const osId = await scheduler.schedule({
    missionId: input.missionId,
    title: mission.name,
    fireAt: input.fireAt,
    snoozeCount,
    increment,
    completeLabel:
      increment === null
        ? null
        : incrementLabel(increment.amount, increment.unit, getSetting(db, 'language')),
  });
  try {
    remember(
      db,
      {
        osId,
        missionId: input.missionId,
        gameDay:
          input.gameDay ?? gameDayOf(input.now, input.tzOffset, getSetting(db, 'day_change')),
        fireAt: input.fireAt,
        snoozeCount,
      },
      replacing,
    );
  } catch (error) {
    // A notification the database does not know could never be cancelled.
    await scheduler.cancel([osId]);
    throw error;
  }
  return osId;
}

async function complete(
  db: Db,
  scheduler: ReminderScheduler,
  input: ReminderActionInput,
): Promise<ReminderOutcome> {
  try {
    const completion = {
      missionId: input.missionId,
      source: 'notification',
      idemKey: `notif:${input.notificationId}`,
      now: input.now,
      tzOffset: input.tzOffset,
    } as const;
    // A measurable mission adds its increment, like a tap in Today (US-NOT-01).
    const result =
      incrementOf(missionOf(db, input.missionId)) === null
        ? completeMission(db, completion)
        : progressMission(db, completion);
    if (result.status === 'completed') {
      // The reminders left for the day, and the notification that was just tapped.
      const ids = new Set([...result.cancelledNotificationIds, input.notificationId]);
      await scheduler.cancel([...ids]);
    } else if (result.status === 'progressed') {
      // The other reminders of the day stay: the target is not reached yet.
      await scheduler.cancel([input.notificationId]);
      db.delete(scheduledReminders).where(eq(scheduledReminders.osId, input.notificationId)).run();
    }
    return { outcome: result.status };
  } catch (error) {
    return { outcome: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

async function snooze(
  db: Db,
  scheduler: ReminderScheduler,
  input: ReminderActionInput,
): Promise<ReminderOutcome> {
  const row = db
    .select()
    .from(scheduledReminders)
    .where(eq(scheduledReminders.osId, input.notificationId))
    .get();
  if (row === undefined) {
    // A completion removes the reminders of the day: there is nothing left to snooze.
    return { outcome: 'ignored' };
  }
  if (row.snoozeCount >= MAX_SNOOZES) {
    return { outcome: 'snooze_limit' };
  }
  try {
    const fireAt = input.now + SNOOZE_MS;
    const snoozeCount = row.snoozeCount + 1;
    const osId = await scheduleReminder(
      db,
      scheduler,
      { missionId: row.missionId, fireAt, now: input.now, tzOffset: input.tzOffset, snoozeCount },
      row.osId,
    );
    await scheduler.cancel([row.osId]);
    return { outcome: 'snoozed', osId, fireAt, snoozeCount };
  } catch (error) {
    return { outcome: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * What happens when the user taps an action of a reminder: Complete gives the same rewards as the
 * app, once (`notif:<id>`); Snooze moves the reminder 10 minutes on, up to 3 times.
 */
export function handleReminderAction(
  db: Db,
  scheduler: ReminderScheduler,
  input: ReminderActionInput,
): Promise<ReminderOutcome> {
  switch (input.actionId) {
    case ACTION_COMPLETE:
      return complete(db, scheduler, input);
    case ACTION_SNOOZE:
      return snooze(db, scheduler, input);
    default:
      return Promise.resolve({ outcome: 'ignored' });
  }
}
