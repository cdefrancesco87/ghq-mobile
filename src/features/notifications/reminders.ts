import { and, eq } from 'drizzle-orm';

import { recordFiredReminders } from '../../db/repositories/appNotifications';
import { completeMission, progressMission } from '../../db/repositories/completion';
import { notDeleted } from '../../db/repositories/events';
import { gameDayOf, getSetting } from '../../db/repositories/settings';
import { missions, scheduledReminders } from '../../db/schema';
import type { Db } from '../../db/types';
import type { GameDay } from '../../rules/types';
import { incrementLabel } from '../shared/amount';
import { notificationTextsOf, type NotificationTexts } from './texts';

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
  /** The name of the mission, always first (design-sezioni.md 11.2). */
  readonly title: string;
  /** A short sentence in the lexicon of the theme. */
  readonly body: string;
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
  /** The label of Snooze, «Tra 10 min», for the category of a measurable mission. */
  readonly snoozeLabel: string;
}

/** One tap of a measurable mission: an amount and the key of its unit (`liter`) or its text. */
export interface ReminderIncrement {
  readonly amount: number;
  readonly unit: string;
}

/**
 * One notification for 3 or more reminders of the same minute (design-sezioni.md 11.4): it has no
 * buttons, a touch opens Today, where each mission is completed.
 */
export interface ReminderGroupRequest {
  readonly missionIds: readonly string[];
  /** «3 missioni per adesso». */
  readonly title: string;
  /** The names of the missions. */
  readonly body: string;
  readonly fireAt: number;
}

/** The notifications of the operating system, as the logic needs them. */
export interface ReminderScheduler {
  /** Schedules the notification and returns its id in the system. */
  schedule(request: ReminderRequest): Promise<string>;
  /** Schedules the notification of a group and returns its id in the system. */
  scheduleGroup(request: ReminderGroupRequest): Promise<string>;
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
  /** The rewards were given: the gains of the confirmation «Fatto! +20 XP · +5 monete». */
  | { readonly outcome: 'completed'; readonly xp: number; readonly coins: number }
  | { readonly outcome: 'already_done' | 'already_recorded' }
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

/** A short fingerprint of the texts of a notification (FNV-1a, 32 bits, in hex). */
function fingerprint(parts: readonly (string | number | null)[]): string {
  const text = JSON.stringify(parts);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** The fingerprint of the texts of a reminder: title, body and the labels of its buttons. */
export function reminderContentHash(request: ReminderRequest): string {
  return fingerprint([
    request.title,
    request.body,
    request.completeLabel,
    request.snoozeLabel,
    request.increment?.amount ?? null,
    request.increment?.unit ?? null,
  ]);
}

/** The fingerprint of the texts of a group: its title and its body. */
export function groupContentHash(request: ReminderGroupRequest): string {
  return fingerprint([request.title, request.body]);
}

export interface ReminderRequestInput {
  readonly missionId: string;
  readonly fireAt: number;
  readonly snoozeCount?: number;
}

/**
 * The notification of a reminder of a mission, with the texts of today (name, language, theme,
 * increment). `texts` can be passed when many reminders are built together.
 */
export function reminderRequestOf(
  db: Db,
  input: ReminderRequestInput,
  texts: NotificationTexts = notificationTextsOf(db),
): ReminderRequest {
  const mission = missionOf(db, input.missionId);
  const increment = incrementOf(mission);
  return {
    missionId: input.missionId,
    title: mission.name,
    body: texts.reminderBody,
    snoozeLabel: texts.snoozeLabel,
    fireAt: input.fireAt,
    snoozeCount: input.snoozeCount ?? 0,
    increment,
    completeLabel:
      increment === null
        ? null
        : incrementLabel(increment.amount, increment.unit, getSetting(db, 'language')),
  };
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
  const request = reminderRequestOf(db, input);
  const osId = await scheduler.schedule(request);
  try {
    remember(
      db,
      {
        osId,
        missionId: input.missionId,
        gameDay:
          input.gameDay ?? gameDayOf(input.now, input.tzOffset, getSetting(db, 'day_change')),
        fireAt: input.fireAt,
        snoozeCount: request.snoozeCount,
        contentHash: reminderContentHash(request),
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

/**
 * A group is one notification of the system for several rows of `scheduled_reminders`: each row
 * has the id `<group>#<size>#<mission>`, so a completion cancels the group (the remaining
 * missions are scheduled again by the next sync) and a group with a row missing is known as
 * broken.
 */
const GROUP_SEPARATOR = '#';

export function groupMemberId(groupId: string, size: number, missionId: string): string {
  return [groupId, size, missionId].join(GROUP_SEPARATOR);
}

/** The group of a row of `scheduled_reminders`, or null for a reminder of its own. */
export function groupOf(osId: string): { readonly groupId: string; readonly size: number } | null {
  const parts = osId.split(GROUP_SEPARATOR);
  if (parts.length !== 3) {
    return null;
  }
  return { groupId: parts[0], size: Number(parts[1]) };
}

export interface ScheduleGroupInput {
  readonly members: readonly { readonly missionId: string; readonly gameDay: GameDay }[];
  readonly fireAt: number;
}

/** The notification of a group, with the texts of today. */
export function groupRequestOf(
  db: Db,
  members: readonly { readonly missionId: string }[],
  fireAt: number,
  texts: NotificationTexts = notificationTextsOf(db),
): ReminderGroupRequest {
  const names = members.map((member) => missionOf(db, member.missionId).name);
  const text = texts.group(names);
  return {
    missionIds: members.map((member) => member.missionId),
    title: text.title,
    body: text.body,
    fireAt,
  };
}

/**
 * Schedules one notification for reminders of the same minute (design-sezioni.md 11.4) and
 * remembers a row for each mission, so that completing one cancels the group.
 */
export async function scheduleReminderGroup(
  db: Db,
  scheduler: ReminderScheduler,
  { members, fireAt }: ScheduleGroupInput,
): Promise<string> {
  const request = groupRequestOf(db, members, fireAt);
  const contentHash = groupContentHash(request);
  const groupId = await scheduler.scheduleGroup(request);
  try {
    db.transaction((tx) => {
      for (const member of members) {
        tx.insert(scheduledReminders)
          .values({
            osId: groupMemberId(groupId, members.length, member.missionId),
            missionId: member.missionId,
            gameDay: member.gameDay,
            fireAt,
            snoozeCount: 0,
            contentHash,
          })
          .run();
      }
    });
  } catch (error) {
    await scheduler.cancel([groupId]);
    throw error;
  }
  return groupId;
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
      const gains = result.completion ?? { xp: 0, coins: 0 };
      return { outcome: 'completed', xp: gains.xp, coins: gains.coins };
    } else if (result.status === 'progressed') {
      // The other reminders of the day stay: the target is not reached yet.
      await scheduler.cancel([input.notificationId]);
      const where = eq(scheduledReminders.osId, input.notificationId);
      recordFiredReminders(db, input.now, where);
      db.delete(scheduledReminders).where(where).run();
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
  // The row is claimed (read and removed) in one transaction, before any await: on Android the
  // same touch can reach both the background task and the listener of the app, and the second
  // one then finds nothing to snooze.
  type Claim =
    | { readonly status: 'missing' }
    | { readonly status: 'limit' }
    | { readonly status: 'claimed'; readonly row: typeof scheduledReminders.$inferSelect };
  let claim: Claim;
  try {
    claim = db.transaction((tx): Claim => {
      const where = eq(scheduledReminders.osId, input.notificationId);
      const found = tx.select().from(scheduledReminders).where(where).get();
      if (found === undefined) {
        return { status: 'missing' };
      }
      if (found.snoozeCount >= MAX_SNOOZES) {
        return { status: 'limit' };
      }
      // The reminder snoozed was shown: it stays among the recent notifications.
      recordFiredReminders(tx, input.now, where);
      tx.delete(scheduledReminders).where(where).run();
      return { status: 'claimed', row: found };
    });
  } catch (error) {
    return { outcome: 'failed', message: error instanceof Error ? error.message : String(error) };
  }
  if (claim.status === 'missing') {
    // A completion removes the reminders of the day, and a snooze its reminder: nothing left.
    return { outcome: 'ignored' };
  }
  if (claim.status === 'limit') {
    return { outcome: 'snooze_limit' };
  }
  const { row } = claim;
  try {
    const fireAt = input.now + SNOOZE_MS;
    const snoozeCount = row.snoozeCount + 1;
    const osId = await scheduleReminder(db, scheduler, {
      missionId: row.missionId,
      fireAt,
      now: input.now,
      tzOffset: input.tzOffset,
      snoozeCount,
    });
    await scheduler.cancel([row.osId]);
    return { outcome: 'snoozed', osId, fireAt, snoozeCount };
  } catch (error) {
    // The snooze was not scheduled: the reminder comes back, so Snooze and Complete still work.
    try {
      db.insert(scheduledReminders).values(row).onConflictDoNothing().run();
    } catch {
      // The mission was deleted meanwhile: nothing to bring back.
    }
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
