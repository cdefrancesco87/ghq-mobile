import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { COMPANION_STAGES } from '../rules/companion';
import { DAY_PLAN, HP, SHOP } from '../rules/config';
import type { Frequency } from '../rules/frequency';
import { DIFFICULTIES, STAT_KEYS, type GameDay, type StatPoints } from '../rules/types';

// The tables of the data model (modello-dati.md, sections 3 and 4). Names are snake_case in the
// database and camelCase in TypeScript; instants are UTC milliseconds and game days are
// `YYYY-MM-DD` text. The `rewards` table (Could) comes in a later version.
//
// Some constraints repeat values of src/rules/config.ts: changing those values needs a new
// migration (`npx drizzle-kit generate`).

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

/** Where a completion comes from. */
const COMPLETION_SOURCES = ['app', 'notification', 'widget', 'health', 'backfill'] as const;
/** Where an event comes from: the completion sources plus the app itself (`system`). */
const EVENT_SOURCES = ['app', 'notification', 'widget', 'health', 'system', 'backfill'] as const;

/** The hero: a single row with id 'hero'. */
export const hero = sqliteTable(
  'hero',
  {
    id: text('id').primaryKey().default('hero'),
    name: text('name').notNull(),
    level: integer('level').notNull().default(1),
    xpInLevel: integer('xp_in_level').notNull().default(0),
    xpTotal: integer('xp_total').notNull().default(0),
    hp: integer('hp').notNull().default(HP.max),
    coins: integer('coins').notNull().default(0),
    streak: integer('streak').notNull().default(0),
    streakBest: integer('streak_best').notNull().default(0),
    /** Game day on which the hero is exhausted (half XP). */
    exhaustedDay: text('exhausted_day').$type<GameDay>(),
    ...timestamps,
  },
  (t) => [check('hero_coins_non_negative', sql`${t.coins} >= 0`)],
);

/** One row per stat with its total points; the level is computed from the points. */
export const heroStats = sqliteTable('hero_stats', {
  statKey: text('stat_key', { enum: STAT_KEYS }).primaryKey(),
  points: integer('points').notNull().default(0),
});

/** The companion: a single row with id 'companion'. The mood is computed, never stored. */
export const companion = sqliteTable('companion', {
  id: text('id').primaryKey().default('companion'),
  /** Null means the default name of the theme. */
  name: text('name'),
  stage: text('stage', { enum: COMPANION_STAGES }).notNull().default('egg'),
  completionsTotal: integer('completions_total').notNull().default(0),
  hatchedAt: integer('hatched_at'),
});

/** Key-value settings; every value is JSON validated by the Zod schema of its key. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const boss = sqliteTable(
  'boss',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** `starter` is the quest of the first launch. */
    kind: text('kind', { enum: ['normal', 'starter'] })
      .notNull()
      .default('normal'),
    difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull(),
    /** Stat that gets 10 points at every step, if any. */
    statKey: text('stat_key', { enum: STAT_KEYS }),
    hpMax: integer('hp_max').notNull(),
    hp: integer('hp').notNull(),
    deadlineDay: text('deadline_day').$type<GameDay>(),
    /** The warning 3 days before the deadline has been sent. */
    deadlineWarned: integer('deadline_warned', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['active', 'defeated', 'archived'] })
      .notNull()
      .default('active'),
    defeatedAt: integer('defeated_at'),
    ...timestamps,
  },
  (t) => [
    // Finds the active bosses quickly; the limit of 3 is checked in the code (canCreateBoss).
    index('boss_active_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const bossSteps = sqliteTable(
  'boss_steps',
  {
    id: text('id').primaryKey(),
    bossId: text('boss_id')
      .notNull()
      .references(() => boss.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    doneAt: integer('done_at'),
  },
  (t) => [index('boss_steps_boss_idx').on(t.bossId, t.position)],
);

export const missions = sqliteTable(
  'missions',
  {
    id: text('id').primaryKey(),
    /** A recurring habit or a single task. */
    kind: text('kind', { enum: ['habit', 'task'] }).notNull(),
    name: text('name').notNull(),
    difficulty: text('difficulty', { enum: DIFFICULTIES }).notNull().default('medium'),
    /** Null for tasks; validated with frequencySchema at every read and write. */
    frequency: text('frequency', { mode: 'json' }).$type<Frequency>(),
    /** Due day of a task, if any. */
    dueDay: text('due_day').$type<GameDay>(),
    goalType: text('goal_type', { enum: ['none', 'quantity', 'duration'] })
      .notNull()
      .default('none'),
    goalTarget: real('goal_target'),
    /** Key of the unit (`liter`, `page`, `minute`…). */
    goalUnit: text('goal_unit'),
    /** Increment of a single tap, e.g. 0.25 litres. */
    goalStep: real('goal_step'),
    statPrimary: text('stat_primary', { enum: STAT_KEYS }),
    statSecondary: text('stat_secondary', { enum: STAT_KEYS }),
    bossId: text('boss_id').references(() => boss.id, { onDelete: 'set null' }),
    categoryKey: text('category_key'),
    iconKey: text('icon_key'),
    templateKey: text('template_key'),
    healthMetric: text('health_metric', { enum: ['steps', 'active_minutes', 'sleep_hours'] }),
    notes: text('notes'),
    status: text('status', { enum: ['active', 'paused', 'archived'] })
      .notNull()
      .default('active'),
    /** Day when a paused mission becomes active again by itself. */
    pausedUntil: text('paused_until').$type<GameDay>(),
    /** A real number, so a mission can move between two others without renumbering. */
    sortOrder: real('sort_order').notNull(),
    streak: integer('streak').notNull().default(0),
    streakBest: integer('streak_best').notNull().default(0),
    completedAt: integer('completed_at'),
    archivedAt: integer('archived_at'),
    /** Logical deletion: the mission disappears from the app but stays in the history. */
    deletedAt: integer('deleted_at'),
    ...timestamps,
  },
  (t) => [
    index('missions_status_idx').on(t.status, t.sortOrder),
    index('missions_boss_idx').on(t.bossId),
    check(
      'missions_stats_differ',
      sql`${t.statSecondary} IS NULL OR ${t.statSecondary} <> ${t.statPrimary}`,
    ),
  ],
);

/** A reminder of a mission: a time for habits, or minutes before the due time for tasks. */
export const missionReminders = sqliteTable(
  'mission_reminders',
  {
    id: text('id').primaryKey(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    /** `HH:MM`, for habits. */
    time: text('time'),
    /** 0, 5, 15 or 30 minutes before the due time, for tasks. */
    leadMinutes: integer('lead_minutes'),
  },
  (t) => [
    index('mission_reminders_mission_idx').on(t.missionId),
    check('mission_reminders_one_kind', sql`(${t.time} IS NULL) <> (${t.leadMinutes} IS NULL)`),
  ],
);

/** What happened to a mission on a game day: done, partial or skipped (one row at most). */
export const missionDays = sqliteTable(
  'mission_days',
  {
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    gameDay: text('game_day').$type<GameDay>().notNull(),
    status: text('status', { enum: ['done', 'partial', 'skipped'] }).notNull(),
    /** Value reached by a measurable mission. */
    value: real('value'),
    skipReason: text('skip_reason'),
    doneAt: integer('done_at'),
    source: text('source', { enum: COMPLETION_SOURCES }).notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.missionId, t.gameDay] }),
    index('mission_days_day_idx').on(t.gameDay),
  ],
);

/** The priorities of a game day: a fourth one is impossible already in the database. */
export const dayPlan = sqliteTable(
  'day_plan',
  {
    gameDay: text('game_day').$type<GameDay>().notNull(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameDay, t.missionId] }),
    uniqueIndex('day_plan_slot').on(t.gameDay, t.position),
    check(
      'day_plan_max_three',
      sql`${t.position} BETWEEN 0 AND ${sql.raw(String(DAY_PLAN.maxPriorities - 1))}`,
    ),
  ],
);

/** One row per closed game day: it makes the closing idempotent and feeds heatmap and mood. */
export const daySummaries = sqliteTable('day_summaries', {
  gameDay: text('game_day').$type<GameDay>().primaryKey(),
  scheduledCount: integer('scheduled_count').notNull(),
  doneCount: integer('done_count').notNull(),
  scheduledXp: integer('scheduled_xp').notNull(),
  missedXp: integer('missed_xp').notNull(),
  hpLost: integer('hp_lost').notNull(),
  isRestDay: integer('is_rest_day', { mode: 'boolean' }).notNull(),
  /** The full-day bonus was given. */
  fullDay: integer('full_day', { mode: 'boolean' }).notNull(),
  planComplete: integer('plan_complete', { mode: 'boolean' }).notNull(),
  shieldUsed: integer('shield_used', { mode: 'boolean' }).notNull(),
  closedAt: integer('closed_at').notNull(),
});

/** Items owned, by key of the shop content (`potion`, `shield`). */
export const inventory = sqliteTable(
  'inventory',
  {
    itemKey: text('item_key').primaryKey(),
    quantity: integer('quantity').notNull().default(0),
  },
  (t) => [
    check(
      'inventory_shields_max',
      sql`${t.itemKey} <> 'shield' OR ${t.quantity} <= ${sql.raw(String(SHOP.shield.maxOwned))}`,
    ),
  ],
);

/** Unlocked badges; conditions and rewards live in the code. */
export const badges = sqliteTable('badges', {
  badgeKey: text('badge_key').primaryKey(),
  unlockedAt: integer('unlocked_at').notNull(),
});

/** Notifications inside the app (badge of the small widget, «Notifiche recenti»). */
export const appNotifications = sqliteTable('app_notifications', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  params: text('params', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: integer('created_at').notNull(),
  seenAt: integer('seen_at'),
});

/** Reminders scheduled in the operating system, to cancel them and count the snoozes. */
export const scheduledReminders = sqliteTable(
  'scheduled_reminders',
  {
    /** Id of the notification in the operating system. */
    osId: text('os_id').primaryKey(),
    missionId: text('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    gameDay: text('game_day').$type<GameDay>().notNull(),
    fireAt: integer('fire_at').notNull(),
    snoozeCount: integer('snooze_count').notNull().default(0),
  },
  (t) => [index('scheduled_reminders_mission_idx').on(t.missionId, t.gameDay)],
);

/** The append-only event log (modello-dati.md, section 4). */
export const events = sqliteTable(
  'events',
  {
    /** Order of writing on this device. */
    seq: integer('seq').primaryKey({ autoIncrement: true }),
    /** UUID v7, sortable in time. */
    id: text('id').notNull().unique(),
    type: text('type').notNull(),
    /** Version of the format of this event type. */
    v: integer('v').notNull().default(1),
    occurredAt: integer('occurred_at').notNull(),
    /** Minutes east of UTC at the time of the event (local time = UTC + offset). */
    tzOffset: integer('tz_offset').notNull(),
    gameDay: text('game_day').$type<GameDay>().notNull(),
    source: text('source', { enum: EVENT_SOURCES }).notNull(),
    deviceId: text('device_id').notNull(),
    missionId: text('mission_id'),
    bossId: text('boss_id'),
    itemKey: text('item_key'),
    /** The event undone by this one. */
    revertsId: text('reverts_id'),
    /** Idempotency key, e.g. `notif:<os_id>`: the same action never counts twice. */
    idemKey: text('idem_key').unique(),
    dXp: integer('d_xp').notNull().default(0),
    dCoins: integer('d_coins').notNull().default(0),
    dHp: integer('d_hp').notNull().default(0),
    dStats: text('d_stats', { mode: 'json' }).$type<StatPoints>(),
    payload: text('payload', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    index('events_day_idx').on(t.gameDay),
    index('events_mission_idx').on(t.missionId, t.gameDay),
    index('events_type_idx').on(t.type, t.gameDay),
  ],
);
