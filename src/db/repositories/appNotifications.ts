import { and, count, desc, eq, gt, isNull, lte, type SQL } from 'drizzle-orm';

import { NOTIFICATIONS } from '../../rules/config';
import type { GameDay } from '../../rules/types';
import { appNotifications, boss, scheduledReminders } from '../schema';
import type { Db } from '../types';
import type { Boss } from './boss';
import { getMission } from './missions';
import { gameDayOf, getSetting } from './settings';

// The notifications inside the app (modello-dati.md 3.9; design-sezioni.md 11.7, 12.1): every
// notification sent by the phone gets a row, which feeds the sheet «Notifiche recenti» and the
// number of the unseen ones (the badge of the icon and of the small widget). The system tells
// nothing when a scheduled notification is shown, so a reminder is written once its time has
// passed (at the next sync, or when a completion removes it), and the evening summary is written
// when it is scheduled, for its time: a row whose time is still to come is not sent yet and is
// invisible to every reading here.

/** The kinds of `app_notifications`. The deadline rows are written by `boss.ts`. */
export type AppNotificationKind =
  'reminder' | 'summary' | 'boss.deadline_warning' | 'boss.deadline_missed';

export interface AppNotification {
  readonly id: string;
  readonly kind: AppNotificationKind;
  readonly params: Readonly<Record<string, unknown>>;
  /** UTC instant the notification was sent. */
  readonly createdAt: number;
  /** Game day and local time `HH:MM` of `createdAt`. */
  readonly day: GameDay;
  readonly time: string;
  readonly seen: boolean;
  /** The name of the mission of a reminder; null if it was deleted. */
  readonly missionName: string | null;
  /** The boss of a deadline notification. */
  readonly boss: Boss | null;
}

export interface RecentNotifications {
  readonly today: GameDay;
  readonly items: readonly AppNotification[];
  /** All the unseen ones, also those beyond the list. */
  readonly unseen: number;
}

/**
 * Writes the reminders whose time has passed, once each (`reminder:<os id>`). Call it before the
 * rows of `scheduled_reminders` are removed; `where` narrows the rows read.
 */
export function recordFiredReminders(db: Db, now: number, where?: SQL): void {
  const rows = db
    .select()
    .from(scheduledReminders)
    .where(and(lte(scheduledReminders.fireAt, now), where))
    .all();
  for (const row of rows) {
    db.insert(appNotifications)
      .values({
        id: `reminder:${row.osId}`,
        kind: 'reminder',
        params: { missionId: row.missionId, gameDay: row.gameDay },
        createdAt: row.fireAt,
      })
      .onConflictDoNothing()
      .run();
  }
}

export interface SummaryRecord {
  readonly day: GameDay;
  /** The time of the summary of `day`. */
  readonly fireAt: number;
  /** The texts scheduled, or null when no summary is scheduled for `day`. */
  readonly text: { readonly title: string; readonly body: string } | null;
}

/**
 * Keeps the row of the evening summary of `day` (`summary:<day>`) aligned with what is scheduled:
 * the texts while it is still to come, nothing when it is not wanted any more. A summary already
 * sent is never changed.
 */
export function recordSummary(db: Db, { day, fireAt, text }: SummaryRecord, now: number): void {
  const id = `summary:${day}`;
  db.transaction((tx) => {
    // Only a row still to come can change; a summary sent stays as it was.
    tx.delete(appNotifications)
      .where(and(eq(appNotifications.id, id), gt(appNotifications.createdAt, now)))
      .run();
    if (text !== null && fireAt > now) {
      tx.insert(appNotifications)
        .values({ id, kind: 'summary', params: { ...text }, createdAt: fireAt })
        .onConflictDoNothing()
        .run();
    }
  });
}

const sent = (now: number) => lte(appNotifications.createdAt, now);

/** How many notifications already sent are not seen yet. */
export function unseenNotificationCount(db: Db, now: number): number {
  return (
    db
      .select({ value: count() })
      .from(appNotifications)
      .where(and(sent(now), isNull(appNotifications.seenAt)))
      .get()?.value ?? 0
  );
}

function localTime(instant: number, tzOffset: number): string {
  const local = new Date(instant + tzOffset * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** The latest notifications already sent, the newest first (sheet «Notifiche recenti»). */
export function recentNotifications(
  db: Db,
  { now, tzOffset }: { readonly now: number; readonly tzOffset: number },
  limit: number = NOTIFICATIONS.recentMax,
): RecentNotifications {
  const dayChange = getSetting(db, 'day_change');
  const items = db
    .select()
    .from(appNotifications)
    .where(sent(now))
    .orderBy(desc(appNotifications.createdAt), desc(appNotifications.id))
    .limit(limit)
    .all()
    .map((row): AppNotification => ({
      id: row.id,
      kind: row.kind as AppNotificationKind,
      params: row.params,
      createdAt: row.createdAt,
      day: gameDayOf(row.createdAt, tzOffset, dayChange),
      time: localTime(row.createdAt, tzOffset),
      seen: row.seenAt !== null,
      missionName:
        typeof row.params.missionId === 'string'
          ? (getMission(db, row.params.missionId)?.name ?? null)
          : null,
      boss:
        typeof row.params.bossId === 'string'
          ? (db.select().from(boss).where(eq(boss.id, row.params.bossId)).get() ?? null)
          : null,
    }));
  return {
    today: gameDayOf(now, tzOffset, dayChange),
    items,
    unseen: unseenNotificationCount(db, now),
  };
}

/** Marks as seen every notification already sent; returns how many changed. */
export function markNotificationsSeen(db: Db, now: number): number {
  return db
    .update(appNotifications)
    .set({ seenAt: now })
    .where(and(sent(now), isNull(appNotifications.seenAt)))
    .returning({ id: appNotifications.id })
    .all().length;
}
