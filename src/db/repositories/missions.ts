import { and, asc, eq, gte, inArray, lte, max, ne } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import { HABITS_LIST } from '../../rules/config';
import { frequencySchema, isDueToday, type Frequency } from '../../rules/frequency';
import { addDays, isGameDay, weekStartOf, weekday } from '../../rules/gameDay';
import {
  DIFFICULTIES,
  STAT_KEYS,
  type Difficulty,
  type GameDay,
  type StatKey,
} from '../../rules/types';
import { dayPlan, missionDays, missionReminders, missions, scheduledReminders } from '../schema';
import type { Db } from '../types';
import { appendEvent, notDeleted, type EventType } from './events';
import { gameDayOf, getSetting } from './settings';

// The life of a mission: create, change, pause, archive and delete (analisi-funzionale.md,
// sections 3 and 4; modello-dati.md 3.3 and 4.5). Every action is one transaction with its event.

export type Mission = typeof missions.$inferSelect;

/** Goal of a mission; `increment` is the value of one tap (`goal_step`). */
export type MissionGoal =
  | { readonly type: 'none' }
  | {
      readonly type: 'quantity';
      readonly target: number;
      readonly unit: string;
      readonly increment: number;
    }
  /** Minutes, with the timer. */
  | { readonly type: 'duration'; readonly target: number; readonly increment: number };

/** The fields of the editor. */
export interface MissionFields {
  readonly name: string;
  readonly difficulty: Difficulty;
  /** Habits only. */
  readonly frequency: Frequency | null;
  /** Tasks only, optional. */
  readonly dueDay: GameDay | null;
  readonly goal: MissionGoal;
  readonly statPrimary: StatKey | null;
  readonly statSecondary: StatKey | null;
  readonly bossId: string | null;
  readonly categoryKey: string | null;
  readonly iconKey: string | null;
  readonly healthMetric: Mission['healthMetric'];
  readonly notes: string | null;
}

/** The reminders of the editor: `HH:MM` times of a habit (`mission_reminders.time`). */
interface WithReminders {
  /** Missing keeps the reminders as they are; an empty list removes them. */
  readonly reminders?: readonly string[];
}

export type NewMission = Partial<MissionFields> &
  WithReminders & {
    readonly name: string;
    /** A recurring habit (default) or a single task. */
    readonly kind?: Mission['kind'];
    readonly templateKey?: string | null;
  };

export type MissionChanges = Partial<MissionFields> & WithReminders;

const reminderTimesSchema = z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/));

/**
 * The reminder times, in order and once each. A task has none: its reminders come before a due
 * time (`lead_minutes`), and a task has no due time in the data model (modello-dati.md 3.3).
 */
function reminderTimes(kind: Mission['kind'], times: readonly string[]): string[] {
  const valid = reminderTimesSchema.parse(times);
  if (kind === 'task' && valid.length > 0) {
    throw new RangeError('A task has no due time to put reminders before');
  }
  return [...new Set(valid)].sort();
}

function writeReminders(tx: Db, missionId: string, times: readonly string[]): void {
  tx.delete(missionReminders).where(eq(missionReminders.missionId, missionId)).run();
  if (times.length > 0) {
    tx.insert(missionReminders)
      .values(times.map((time) => ({ id: uuidv7(), missionId, time })))
      .run();
  }
}

/** A mission not deleted, to edit it; null when it is gone. */
export function getMission(db: Db, missionId: string): Mission | null {
  return (
    db
      .select()
      .from(missions)
      .where(and(eq(missions.id, missionId), notDeleted(missions)))
      .get() ?? null
  );
}

/** The reminder times of a mission, in order (the editor shows them as chips, design 4.8). */
export function missionReminderTimes(db: Db, missionId: string): string[] {
  return db
    .select({ time: missionReminders.time })
    .from(missionReminders)
    .where(eq(missionReminders.missionId, missionId))
    .all()
    .flatMap((row) => (row.time === null ? [] : [row.time]))
    .sort();
}

export interface ActionContext {
  /** UTC instant of the action, in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
}

const goalSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('none') }),
  z.strictObject({
    type: z.literal('quantity'),
    target: z.number().positive(),
    unit: z.string().min(1),
    increment: z.number().positive(),
  }),
  z.strictObject({
    type: z.literal('duration'),
    target: z.number().positive(),
    increment: z.number().positive(),
  }),
]);

/** The goal as stored in the `goal_*` columns of `missions`. */
export function goalColumns(goal: MissionGoal) {
  switch (goal.type) {
    case 'none':
      return { goalType: 'none', goalTarget: null, goalUnit: null, goalStep: null } as const;
    case 'quantity':
      return {
        goalType: 'quantity',
        goalTarget: goal.target,
        goalUnit: goal.unit,
        goalStep: goal.increment,
      } as const;
    case 'duration':
      return {
        goalType: 'duration',
        goalTarget: goal.target,
        goalUnit: 'minute',
        goalStep: goal.increment,
      } as const;
  }
}

function goalOf(row: Mission): MissionGoal {
  if (row.goalType === 'quantity') {
    return {
      type: 'quantity',
      target: row.goalTarget ?? 0,
      unit: row.goalUnit ?? '',
      increment: row.goalStep ?? 0,
    };
  }
  if (row.goalType === 'duration') {
    return { type: 'duration', target: row.goalTarget ?? 0, increment: row.goalStep ?? 0 };
  }
  return { type: 'none' };
}

function fieldsOf(row: Mission): MissionFields {
  return {
    name: row.name,
    difficulty: row.difficulty,
    frequency: row.frequency,
    dueDay: row.dueDay,
    goal: goalOf(row),
    statPrimary: row.statPrimary,
    statSecondary: row.statSecondary,
    bossId: row.bossId,
    categoryKey: row.categoryKey,
    iconKey: row.iconKey,
    healthMetric: row.healthMetric,
    notes: row.notes,
  };
}

/** Checks a mission before writing it; the frequency is validated with Zod. */
function validated(kind: Mission['kind'], fields: MissionFields): MissionFields {
  const name = fields.name.trim();
  if (name === '') {
    throw new RangeError('A mission needs a name');
  }
  if (!DIFFICULTIES.includes(fields.difficulty)) {
    throw new RangeError(`Unknown difficulty: ${fields.difficulty}`);
  }
  let frequency: Frequency | null = null;
  if (kind === 'habit') {
    if (fields.frequency === null) {
      throw new RangeError('A habit needs a frequency');
    }
    if (fields.dueDay !== null) {
      throw new RangeError('Only tasks have a due day');
    }
    frequency = frequencySchema.parse(fields.frequency);
  } else {
    if (fields.frequency !== null) {
      throw new RangeError('A task has no frequency');
    }
    if (fields.dueDay !== null && !isGameDay(fields.dueDay)) {
      throw new RangeError(`Invalid due day: ${fields.dueDay}`);
    }
  }
  for (const stat of [fields.statPrimary, fields.statSecondary]) {
    if (stat !== null && !STAT_KEYS.includes(stat)) {
      throw new RangeError(`Unknown stat: ${stat}`);
    }
  }
  if (fields.statSecondary !== null && fields.statSecondary === fields.statPrimary) {
    throw new RangeError('The secondary stat must differ from the primary one');
  }
  return { ...fields, name, frequency, goal: goalSchema.parse(fields.goal) };
}

function columnsOf(fields: MissionFields) {
  const { goal, ...rest } = fields;
  return { ...rest, ...goalColumns(goal) };
}

/** A mission that exists and is not deleted. */
function load(tx: Db, missionId: string): Mission {
  const row = tx.select().from(missions).where(eq(missions.id, missionId)).get();
  if (row === undefined) {
    throw new RangeError(`Unknown mission: ${missionId}`);
  }
  if (row.deletedAt !== null) {
    throw new RangeError(`The mission was deleted: ${missionId}`);
  }
  return row;
}

function today(tx: Db, { now, tzOffset }: ActionContext): GameDay {
  return gameDayOf(now, tzOffset, getSetting(tx, 'day_change'));
}

function record(
  tx: Db,
  type: EventType,
  missionId: string,
  { now, tzOffset }: ActionContext,
  payload: Record<string, unknown> = {},
): void {
  appendEvent(tx, { type, occurredAt: now, tzOffset, source: 'app', missionId, payload });
}

function save(tx: Db, missionId: string, changes: Partial<typeof missions.$inferInsert>): Mission {
  const row = tx.update(missions).set(changes).where(eq(missions.id, missionId)).returning().get();
  // `load` has already checked that the mission exists.
  return row as Mission;
}

const DAILY: Frequency = { type: 'daily' };

/** Creates a mission. With just a name it is a daily habit of medium difficulty (US-EDT-01). */
export function createMission(db: Db, input: NewMission, context: ActionContext): Mission {
  const kind = input.kind ?? 'habit';
  const fields = validated(kind, {
    name: input.name,
    difficulty: input.difficulty ?? 'medium',
    frequency: input.frequency !== undefined ? input.frequency : kind === 'habit' ? DAILY : null,
    dueDay: input.dueDay ?? null,
    goal: input.goal ?? { type: 'none' },
    statPrimary: input.statPrimary ?? null,
    statSecondary: input.statSecondary ?? null,
    bossId: input.bossId ?? null,
    categoryKey: input.categoryKey ?? null,
    iconKey: input.iconKey ?? null,
    healthMetric: input.healthMetric ?? null,
    notes: input.notes ?? null,
  });
  const times = reminderTimes(kind, input.reminders ?? []);
  return db.transaction((tx) => {
    const last = tx
      .select({ sortOrder: max(missions.sortOrder) })
      .from(missions)
      .get();
    const mission = tx
      .insert(missions)
      .values({
        id: uuidv7(),
        kind,
        ...columnsOf(fields),
        templateKey: input.templateKey ?? null,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        createdAt: context.now,
        updatedAt: context.now,
      })
      .returning()
      .get();
    writeReminders(tx, mission.id, times);
    record(tx, 'mission.created', mission.id, context, { kind });
    return mission;
  });
}

/**
 * Changes a mission. The past is never recalculated: difficulty and stats count from the next
 * completions, because every completion records its own changes (US-EDT-02).
 */
export function updateMission(
  db: Db,
  missionId: string,
  changes: MissionChanges,
  context: ActionContext,
): Mission {
  return db.transaction((tx) => {
    const current = load(tx, missionId);
    const given = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as MissionChanges;
    const { reminders, ...fieldChanges } = given;
    const fields = validated(current.kind, { ...fieldsOf(current), ...fieldChanges });
    const mission = save(tx, missionId, { ...columnsOf(fields), updatedAt: context.now });
    if (reminders !== undefined) {
      writeReminders(tx, missionId, reminderTimes(current.kind, reminders));
    }
    record(tx, 'mission.updated', missionId, context, { fields: Object.keys(given).sort() });
    return mission;
  });
}

/**
 * Pauses a mission: it leaves Today and takes no hit points. With an end day it comes back by
 * itself on that day (US-ABI-02); without one it waits for resumeMission.
 */
export function pauseMission(
  db: Db,
  missionId: string,
  until: GameDay | null,
  context: ActionContext,
): Mission {
  return db.transaction((tx) => {
    const current = load(tx, missionId);
    if (current.status === 'archived') {
      throw new RangeError('An archived mission cannot be paused');
    }
    if (until !== null && (!isGameDay(until) || until <= today(tx, context))) {
      throw new RangeError(`The pause must end after today: ${until}`);
    }
    const mission = save(tx, missionId, {
      status: 'paused',
      pausedUntil: until,
      updatedAt: context.now,
    });
    record(tx, 'mission.paused', missionId, context, { until });
    return mission;
  });
}

export function resumeMission(db: Db, missionId: string, context: ActionContext): Mission {
  return db.transaction((tx) => {
    if (load(tx, missionId).status !== 'paused') {
      throw new RangeError('Only a paused mission can be resumed');
    }
    const mission = save(tx, missionId, {
      status: 'active',
      pausedUntil: null,
      updatedAt: context.now,
    });
    record(tx, 'mission.resumed', missionId, context);
    return mission;
  });
}

/** Archives a mission: its history stays and it can be restored (US-ABI-03). */
export function archiveMission(db: Db, missionId: string, context: ActionContext): Mission {
  return db.transaction((tx) => {
    if (load(tx, missionId).status === 'archived') {
      throw new RangeError('The mission is already archived');
    }
    const mission = save(tx, missionId, {
      status: 'archived',
      pausedUntil: null,
      archivedAt: context.now,
      updatedAt: context.now,
    });
    record(tx, 'mission.archived', missionId, context);
    return mission;
  });
}

/** Brings an archived mission back among the active ones. */
export function restoreMission(db: Db, missionId: string, context: ActionContext): Mission {
  return db.transaction((tx) => {
    if (load(tx, missionId).status !== 'archived') {
      throw new RangeError('Only an archived mission can be restored');
    }
    const mission = save(tx, missionId, {
      status: 'active',
      archivedAt: null,
      updatedAt: context.now,
    });
    record(tx, 'mission.restored', missionId, context);
    return mission;
  });
}

/**
 * Deletes a mission logically (modello-dati.md 4.5): it disappears from every screen, its
 * reminders and its places in the day plan from today on go away, while `mission_days` and the
 * events stay, so the hero keeps everything it earned. The caller cancels the returned
 * notifications in the operating system, outside the transaction.
 */
export function deleteMission(
  db: Db,
  missionId: string,
  context: ActionContext,
): { cancelledNotificationIds: string[] } {
  return db.transaction((tx) => {
    load(tx, missionId);
    const scheduled = tx
      .select({ osId: scheduledReminders.osId })
      .from(scheduledReminders)
      .where(eq(scheduledReminders.missionId, missionId))
      .all();
    tx.delete(scheduledReminders).where(eq(scheduledReminders.missionId, missionId)).run();
    tx.delete(missionReminders).where(eq(missionReminders.missionId, missionId)).run();
    tx.delete(dayPlan)
      .where(and(eq(dayPlan.missionId, missionId), gte(dayPlan.gameDay, today(tx, context))))
      .run();
    save(tx, missionId, { deletedAt: context.now, updatedAt: context.now });
    record(tx, 'mission.deleted', missionId, context);
    return { cancelledNotificationIds: scheduled.map((row) => row.osId) };
  });
}

/**
 * Archives by itself every single task done at least 7 days ago (analisi-funzionale.md, section
 * 3; design-sezioni.md 3.7 ★). It runs at every start, after the day closing; running it again
 * changes nothing. Returns the ids of the tasks archived now.
 */
export function archiveCompletedSingles(db: Db, context: ActionContext): string[] {
  return db.transaction((tx) => {
    const lastVisible = addDays(today(tx, context), -HABITS_LIST.doneTaskVisibleDays);
    const due = tx
      .selectDistinct({ id: missions.id })
      .from(missions)
      .innerJoin(missionDays, eq(missionDays.missionId, missions.id))
      .where(
        and(
          eq(missions.kind, 'task'),
          ne(missions.status, 'archived'),
          notDeleted(missions),
          eq(missionDays.status, 'done'),
          lte(missionDays.gameDay, lastVisible),
        ),
      )
      .orderBy(asc(missions.sortOrder))
      .all()
      .map((row) => row.id);
    for (const missionId of due) {
      save(tx, missionId, {
        status: 'archived',
        pausedUntil: null,
        archivedAt: context.now,
        updatedAt: context.now,
      });
      appendEvent(tx, {
        type: 'mission.archived',
        occurredAt: context.now,
        tzOffset: context.tzOffset,
        source: 'system',
        missionId,
        payload: { auto: true },
      });
    }
    return due;
  });
}

/**
 * A mission not deleted, archived ones included, already has this name, ignoring case and the
 * spaces around it: the editor warns without blocking (design-sezioni.md 4.12).
 */
export function isMissionNameTaken(db: Db, name: string): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  if (wanted === '') {
    return false;
  }
  return db
    .select({ name: missions.name })
    .from(missions)
    .where(notDeleted(missions))
    .all()
    .some((row) => row.name.trim().toLocaleLowerCase() === wanted);
}

/**
 * The missions of a game day, in the order of the list (US-OGGI-01): the habits scheduled by
 * their frequency and the tasks due or overdue, without paused, archived or deleted missions.
 * On a rest day no mission is due (design-sezioni.md 10.5).
 */
export function listTodayMissions(db: Db, day: GameDay): Mission[] {
  if (!isGameDay(day)) {
    throw new RangeError(`Invalid game day: ${day}`);
  }
  if (getSetting(db, 'rest_days').includes(weekday(day))) {
    return [];
  }
  const weekStart = getSetting(db, 'week_start');
  const candidates = db
    .select()
    .from(missions)
    .where(and(notDeleted(missions), ne(missions.status, 'archived')))
    .orderBy(asc(missions.sortOrder))
    .all();
  if (candidates.length === 0) {
    return [];
  }
  // Completions that decide whether a mission is still due: this week's for the habits counted
  // per week, and every earlier one for the tasks.
  const taskIds = candidates.filter((mission) => mission.kind === 'task').map((m) => m.id);
  const thisWeek = weekStartOf(day, weekStart);
  const done = db
    .select({ missionId: missionDays.missionId, gameDay: missionDays.gameDay })
    .from(missionDays)
    .where(
      and(
        eq(missionDays.status, 'done'),
        lte(missionDays.gameDay, day),
        inArray(
          missionDays.missionId,
          candidates.map((mission) => mission.id),
        ),
      ),
    )
    .all()
    .filter((row) => taskIds.includes(row.missionId) || row.gameDay >= thisWeek);
  return candidates.filter((mission) =>
    isDueToday(mission, day, {
      weekStart,
      completedDays: done.filter((row) => row.missionId === mission.id).map((row) => row.gameDay),
    }),
  );
}
