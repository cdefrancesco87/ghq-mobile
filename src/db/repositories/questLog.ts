import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { QUEST_LOG } from '../../rules/config';
import type { GameDay } from '../../rules/types';
import { boss, events, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted, type EventType } from './events';
import type { ActionClock } from './hero';
import { gameDayOf, getSetting } from './settings';

// The Registro of Statistics (analisi-funzionale.md section 8, design-sezioni.md 8.6): the log
// of completions, skips, bosses, items and milestones, grouped by day. An undone event and its
// undo are both hidden (modello-dati.md 4.3), and so are the events of deleted missions (4.5)
// and of deleted bosses.

/** The chips above the list: Tutto, Completamenti, Salti, Boss, Oggetti. */
export const QUEST_LOG_FILTERS = ['all', 'completions', 'skips', 'bosses', 'items'] as const;
export type QuestLogFilter = (typeof QUEST_LOG_FILTERS)[number];

const KIND_TYPES = {
  completions: ['mission.completed', 'mission.progressed', 'mission.backfilled'],
  skips: ['mission.skipped'],
  bosses: ['boss.step_done', 'boss.defeated', 'boss.deadline_missed'],
  items: ['item.bought', 'item.used', 'shield.consumed', 'reward.redeemed'],
} as const satisfies Record<Exclude<QuestLogFilter, 'all'>, readonly EventType[]>;

/** Shown only under Tutto: levels, badges, day bonuses and the hit points lost at a day close. */
const OTHER_TYPES = [
  'hero.level_up',
  'badge.unlocked',
  'bonus.full_day',
  'bonus.plan',
  'day.closed',
] as const satisfies readonly EventType[];

export type QuestLogType =
  (typeof KIND_TYPES)[keyof typeof KIND_TYPES][number] | (typeof OTHER_TYPES)[number];

const ALL_TYPES: readonly QuestLogType[] = [...Object.values(KIND_TYPES).flat(), ...OTHER_TYPES];

/**
 * Left out in the Essential mode (design-sezioni.md 8.11): the entries of health, bosses, coins
 * and shop. Levels, badges and the bonus of the Plan (experience) stay.
 */
const ESSENTIAL_HIDDEN: readonly QuestLogType[] = [
  ...KIND_TYPES.bosses,
  ...KIND_TYPES.items,
  'bonus.full_day',
  'day.closed',
];

/** The chips that match most of the log. */
const DENSE_FILTERS: readonly QuestLogFilter[] = ['all', 'completions'];

/** The events «Annulla» works on (undo.ts), on the day they happened. */
const UNDOABLE_TYPES: readonly QuestLogType[] = [
  'mission.completed',
  'mission.skipped',
  'boss.step_done',
];

export interface QuestLogQuery {
  readonly filter: QuestLogFilter;
  /** Only the entries of this mission («Filtra»). */
  readonly missionId?: string | null;
  /** First and last game day, both included. */
  readonly from?: GameDay | null;
  readonly to?: GameDay | null;
  /** How many entries at most; QUEST_LOG.pageSize when missing. */
  readonly limit?: number;
  /** Only the entries after this one in the list (keyset paging): `next` of the page before. */
  readonly before?: QuestLogCursor | null;
  /** The Essential mode: without the entries of ESSENTIAL_HIDDEN. */
  readonly essential?: boolean;
}

/** A place in the list, newest first: the game day and the order of writing of an entry. */
export interface QuestLogCursor {
  readonly gameDay: GameDay;
  readonly seq: number;
}

export interface QuestLogEntry {
  readonly id: string;
  readonly type: QuestLogType;
  readonly gameDay: GameDay;
  /** Local time of the event, `HH:MM`, with the time zone it was recorded in. */
  readonly time: string;
  readonly missionId: string | null;
  readonly missionName: string | null;
  readonly bossId: string | null;
  /** The name of the boss; for the quest of the first launch a key of the language files. */
  readonly bossName: string | null;
  readonly bossStarter: boolean;
  /** The item of the shop; for `badge.unlocked` the key of the badge. */
  readonly itemKey: string | null;
  readonly xp: number;
  readonly coins: number;
  readonly hp: number;
  /** Hit points taken from a boss by a step or a completion, if any. */
  readonly damage: number | null;
  /** The value reached by a measurable mission. */
  readonly value: number | null;
  /** The level reached, for `hero.level_up`. */
  readonly level: number | null;
  /** The reason of a skip. */
  readonly reason: string | null;
  /** The name of a redeemed reward, as it was at the redemption. */
  readonly rewardName: string | null;
  /** «Annulla» in the menu of the entry: a completion, a skip or a step of today. */
  readonly undoable: boolean;
}

export interface QuestLogDay {
  readonly day: GameDay;
  readonly entries: readonly QuestLogEntry[];
}

export interface QuestLogView {
  readonly today: GameDay;
  readonly days: readonly QuestLogDay[];
  /** More entries beyond the limit. */
  readonly hasMore: boolean;
  /** With `hasMore`, the `before` of the next page. */
  readonly next: QuestLogCursor | null;
  /** The missions of the «Filtra» sheet: every mission not deleted, by name. */
  readonly missions: readonly { readonly id: string; readonly name: string }[];
}

function localTime(occurredAt: number, tzOffset: number): string {
  const local = new Date(occurredAt + tzOffset * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

const numberOr = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const reverts = alias(events, 'reverts');
const other = alias(events, 'other');
const otherReverts = alias(events, 'other_reverts');
const otherBoss = alias(boss, 'other_boss');

/** Not undone: no `event.reverted` points at the row `id` (index events_reverts_idx). */
const notReverted = (db: Db, undo: typeof reverts | typeof otherReverts, id: SQLiteColumn) =>
  notExists(
    db
      .select({ one: sql`1` })
      .from(undo)
      .where(and(eq(undo.revertsId, id), eq(undo.type, 'event.reverted'))),
  );

/** Not of a deleted boss (or of no boss). */
const bossShown = (status: SQLiteColumn) => or(isNull(status), ne(status, 'deleted'))!;

/** The Registro, with the filters of the chips and of «Filtra». */
export function getQuestLog(db: Db, clock: ActionClock, query: QuestLogQuery): QuestLogView {
  const today = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
  const types = (query.filter === 'all' ? ALL_TYPES : KIND_TYPES[query.filter]).filter(
    (type) => query.essential !== true || !ESSENTIAL_HIDDEN.includes(type),
  );
  const conditions: SQL[] = [
    // Under Tutto and Completamenti most of the log matches: the unary plus keeps SQLite off
    // events_type_idx, so it walks events_day_idx in the order of the page and stops at the
    // limit. The other chips match few events, which events_type_idx finds faster.
    DENSE_FILTERS.includes(query.filter)
      ? sql`+${events.type} in ${types}`
      : inArray(events.type, [...types]),
    isNull(missions.deletedAt),
    bossShown(boss.status),
    notReverted(db, reverts, events.id),
    // A day close is an entry only when it cost hit points.
    or(ne(events.type, 'day.closed'), ne(events.dHp, 0))!,
  ];
  if (types.includes('mission.progressed')) {
    // Every tap of a measurable mission is a progress: a day keeps only where it got to, and
    // nothing when the mission was completed (as in the history of the mission, T53). Only the
    // entries the Registro shows count: not undone, not of a deleted boss.
    const settling = types.filter(
      (type) => type === 'mission.completed' || type === 'mission.backfilled',
    );
    const later = and(eq(other.type, 'mission.progressed'), gt(other.seq, events.seq))!;
    conditions.push(
      or(
        ne(events.type, 'mission.progressed'),
        notExists(
          db
            .select({ one: sql`1` })
            .from(other)
            .leftJoin(otherBoss, eq(otherBoss.id, other.bossId))
            .where(
              and(
                eq(other.missionId, events.missionId),
                eq(other.gameDay, events.gameDay),
                settling.length > 0 ? or(inArray(other.type, settling), later) : later,
                bossShown(otherBoss.status),
                notReverted(db, otherReverts, other.id),
              ),
            ),
        ),
      )!,
    );
  }
  if (query.missionId != null) {
    conditions.push(eq(events.missionId, query.missionId));
  }
  if (query.from != null) {
    conditions.push(gte(events.gameDay, query.from));
  }
  if (query.to != null) {
    conditions.push(lte(events.gameDay, query.to));
  }
  if (query.before != null) {
    conditions.push(
      or(
        lt(events.gameDay, query.before.gameDay),
        and(eq(events.gameDay, query.before.gameDay), lt(events.seq, query.before.seq)),
      )!,
    );
  }
  const limit = query.limit ?? QUEST_LOG.pageSize;
  const rows = db
    .select({
      seq: events.seq,
      id: events.id,
      type: events.type,
      gameDay: events.gameDay,
      occurredAt: events.occurredAt,
      tzOffset: events.tzOffset,
      missionId: events.missionId,
      missionName: missions.name,
      bossId: events.bossId,
      bossName: boss.name,
      bossKind: boss.kind,
      bossStatus: boss.status,
      itemKey: events.itemKey,
      dXp: events.dXp,
      dCoins: events.dCoins,
      dHp: events.dHp,
      payload: events.payload,
    })
    .from(events)
    .leftJoin(missions, eq(events.missionId, missions.id))
    .leftJoin(boss, eq(events.bossId, boss.id))
    .where(and(...conditions))
    // By game day: an event written for a past day (a day close, a forgotten completion) sits in
    // its own day.
    .orderBy(desc(events.gameDay), desc(events.seq))
    // One more than the page, to know whether there are more.
    .limit(limit + 1)
    .all();
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  // The damage of a completion to its boss is in the `boss.damaged` written in the same action.
  const completionInstants = page
    .filter((row) => row.type === 'mission.completed' && row.bossId !== null)
    .map((row) => row.occurredAt);
  const damages = new Map<string, number>();
  if (completionInstants.length > 0) {
    for (const row of db
      .select({ bossId: events.bossId, occurredAt: events.occurredAt, payload: events.payload })
      .from(events)
      .where(and(eq(events.type, 'boss.damaged'), inArray(events.occurredAt, completionInstants)))
      .orderBy(asc(events.seq))
      .all()) {
      const dealt = numberOr(row.payload.dealt);
      const key = `${row.bossId}|${row.occurredAt}`;
      if (dealt !== null && !damages.has(key)) {
        damages.set(key, dealt);
      }
    }
  }

  const entries: QuestLogEntry[] = page.map((row) => {
    const type = row.type as QuestLogType;
    const damage =
      type === 'boss.step_done'
        ? numberOr(row.payload.dealt)
        : type === 'mission.completed'
          ? (damages.get(`${row.bossId}|${row.occurredAt}`) ?? null)
          : null;
    return {
      id: row.id,
      type,
      gameDay: row.gameDay,
      time: localTime(row.occurredAt, row.tzOffset),
      missionId: row.missionId,
      missionName: row.missionName,
      bossId: row.bossId,
      bossName: row.bossName,
      bossStarter: row.bossKind === 'starter',
      // A badge carries its key in the payload: the entry names it like an item.
      itemKey:
        type === 'badge.unlocked' && typeof row.payload.badge === 'string'
          ? row.payload.badge
          : row.itemKey,
      xp: row.dXp,
      coins: row.dCoins,
      hp: row.dHp,
      damage: damage === 0 ? null : damage,
      value: numberOr(row.payload.value),
      level: type === 'hero.level_up' ? numberOr(row.payload.to) : null,
      reason: typeof row.payload.reason === 'string' ? row.payload.reason : null,
      rewardName:
        type === 'reward.redeemed' && typeof row.payload.name === 'string'
          ? row.payload.name
          : null,
      undoable:
        UNDOABLE_TYPES.includes(type) &&
        row.gameDay === today &&
        (type !== 'boss.step_done' || row.bossStatus === 'active'),
    };
  });

  const days: { day: GameDay; entries: QuestLogEntry[] }[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last?.day === entry.gameDay) {
      last.entries.push(entry);
    } else {
      days.push({ day: entry.gameDay, entries: [entry] });
    }
  }

  return {
    today,
    days,
    hasMore: rows.length > limit,
    next:
      rows.length > limit && last !== undefined ? { gameDay: last.gameDay, seq: last.seq } : null,
    missions: db
      .select({ id: missions.id, name: missions.name })
      .from(missions)
      .where(notDeleted(missions))
      .orderBy(asc(missions.name))
      .all(),
  };
}
