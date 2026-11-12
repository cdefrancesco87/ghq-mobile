import { and, eq, gte, inArray, lte } from 'drizzle-orm';

import { completionDeltas, measurableProgress } from '../../rules/completion';
import { stageFor } from '../../rules/companion';
import { DAY_PLAN, FULL_DAY } from '../../rules/config';
import { canAddToPlan, isFullDay, isPlanComplete, skipsLeft } from '../../rules/day';
import { weekStartOf } from '../../rules/gameDay';
import { nextMissionStreak } from '../../rules/streak';
import type { GameDay } from '../../rules/types';
import {
  boss,
  bossSteps,
  companion,
  dayPlan,
  events,
  missionDays,
  missions,
  scheduledReminders,
} from '../schema';
import type { Db } from '../types';
import { damageBoss, markStepDone } from './boss';
import { appendEvent } from './events';
import { changeHero, loadHero, recordLevelUp, type ActionClock } from './hero';
import { listTodayMissions, type Mission } from './missions';
import { withMoments, type WithMoments } from './moments';
import { gameDayOf, getSetting } from './settings';

// Completing, progressing and skipping a mission, and the day plan (modello-dati.md 3.5, 3.6 and
// 4.4). A completion is the same from every source: app, notification, widget or health data.

/** Where a completion comes from (`mission_days.source`). */
export type CompletionSource = (typeof missionDays.$inferSelect)['source'];

export interface CompletionInput {
  readonly missionId: string;
  readonly source: CompletionSource;
  /** The same key never counts twice, e.g. `notif:<os_id>`. */
  readonly idemKey?: string | null;
  /** UTC instant of the action, in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
}

export interface ProgressInput extends CompletionInput {
  /** Amount added by this action; the increment of the mission when missing. */
  readonly amount?: number;
}

export const SKIP_REASONS = ['illness', 'travel', 'rest', 'other'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

export interface SkipInput extends Omit<CompletionInput, 'source'> {
  readonly reason: SkipReason;
}

export type DayBonus = 'bonus.full_day' | 'bonus.plan';

export interface CompletionResult extends WithMoments {
  /**
   * `completed`: the rewards were given. `progressed`: a measurable mission moved without
   * rewards. `already_done`: the mission was already done today. `already_recorded`: the same
   * idempotency key was already used. In the last two cases nothing changed.
   */
  readonly status: 'completed' | 'progressed' | 'already_done' | 'already_recorded';
  /** The `mission.completed` event and its gains, when the rewards were given. */
  readonly completion: {
    readonly eventId: string;
    readonly xp: number;
    readonly coins: number;
  } | null;
  readonly bonuses: readonly DayBonus[];
  /** Notifications to cancel in the operating system, outside the transaction. */
  readonly cancelledNotificationIds: readonly string[];
}

const NOTHING = {
  completion: null,
  bonuses: [],
  cancelledNotificationIds: [],
  moments: [],
} as const;

function today(tx: Db, { now, tzOffset }: { now: number; tzOffset: number }): GameDay {
  return gameDayOf(now, tzOffset, getSetting(tx, 'day_change'));
}

function alreadyRecorded(tx: Db, idemKey: string | null | undefined): boolean {
  if (!idemKey) {
    return false;
  }
  return (
    tx.select({ id: events.id }).from(events).where(eq(events.idemKey, idemKey)).get() !== undefined
  );
}

/** A mission due on the game day; it throws for unknown, deleted or not due missions. */
function dueMission(tx: Db, missionId: string, day: GameDay): Mission {
  const mission = listTodayMissions(tx, day).find((candidate) => candidate.id === missionId);
  if (mission === undefined) {
    throw new RangeError(`The mission is not due on ${day}: ${missionId}`);
  }
  return mission;
}

function missionDayOf(tx: Db, missionId: string, day: GameDay) {
  return tx
    .select()
    .from(missionDays)
    .where(and(eq(missionDays.missionId, missionId), eq(missionDays.gameDay, day)))
    .get();
}

function writeMissionDay(tx: Db, row: typeof missionDays.$inferInsert): void {
  const { missionId, gameDay, ...changes } = row;
  tx.insert(missionDays)
    .values(row)
    .onConflictDoUpdate({ target: [missionDays.missionId, missionDays.gameDay], set: changes })
    .run();
}

/** One more completion for the companion: the egg hatches at the first one. */
function countCompletion(tx: Db, clock: ActionClock): void {
  const current = tx.select().from(companion).get();
  if (current === undefined) {
    throw new RangeError('There is no companion yet: the first launch must create it');
  }
  const completionsTotal = current.completionsTotal + 1;
  const stage = stageFor(completionsTotal, current.stage);
  tx.update(companion)
    .set({
      completionsTotal,
      stage,
      hatchedAt: current.hatchedAt ?? (stage !== 'egg' ? clock.now : null),
    })
    .where(eq(companion.id, current.id))
    .run();
  if (stage !== current.stage) {
    appendEvent(tx, {
      type: 'companion.stage_up',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      payload: { from: current.stage, to: stage },
    });
  }
}

/** The first completion marks the second step of the quest of the first launch (design 1.8). */
function advanceStarterQuest(tx: Db, clock: ActionClock): void {
  const quest = tx
    .select({ id: boss.id })
    .from(boss)
    .where(and(eq(boss.kind, 'starter'), eq(boss.status, 'active')))
    .get();
  if (quest === undefined) {
    return;
  }
  const step = tx
    .select()
    .from(bossSteps)
    .where(and(eq(bossSteps.bossId, quest.id), eq(bossSteps.position, 1)))
    .get();
  if (step !== undefined && step.doneAt === null) {
    markStepDone(tx, step.id, clock);
  }
}

/** A bonus of the day given and not taken back by an undo. */
export function bonusGiven(tx: Db, type: DayBonus, day: GameDay): boolean {
  const given = tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.type, type), eq(events.gameDay, day)))
    .all()
    .map((row) => row.id);
  if (given.length === 0) {
    return false;
  }
  const reverted = tx
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.type, 'event.reverted'), inArray(events.revertsId, given)))
    .all();
  return given.length > reverted.length;
}

/**
 * The bonuses of the day, given at the moment the last mission or priority is done, each with
 * its own event (CLAUDE.md, choice 4). Skipped missions do not count in the day, as in the
 * heatmap (design 8.3).
 */
function giveDayBonuses(tx: Db, day: GameDay, clock: ActionClock): DayBonus[] {
  const rows = tx.select().from(missionDays).where(eq(missionDays.gameDay, day)).all();
  const done = rows.filter((row) => row.status === 'done').map((row) => row.missionId);
  const skipped = new Set(
    rows.filter((row) => row.status === 'skipped').map((row) => row.missionId),
  );
  const scheduled = listTodayMissions(tx, day)
    .map((mission) => mission.id)
    .filter((id) => !skipped.has(id));
  const plan = tx
    .select({ missionId: dayPlan.missionId })
    .from(dayPlan)
    .where(eq(dayPlan.gameDay, day))
    .all()
    .map((row) => row.missionId);
  const base = {
    occurredAt: clock.now,
    tzOffset: clock.tzOffset,
    source: clock.source ?? 'app',
    gameDay: day,
  } as const;
  const bonuses: DayBonus[] = [];
  if (isFullDay(scheduled, done) && !bonusGiven(tx, 'bonus.full_day', day)) {
    const change = changeHero(tx, { coins: FULL_DAY.bonusCoins, hp: FULL_DAY.bonusHp }, clock.now);
    appendEvent(tx, { ...base, type: 'bonus.full_day', deltas: change.deltas });
    bonuses.push('bonus.full_day');
  }
  if (isPlanComplete(plan, done) && !bonusGiven(tx, 'bonus.plan', day)) {
    const change = changeHero(tx, { xp: DAY_PLAN.bonusXp }, clock.now);
    appendEvent(tx, { ...base, type: 'bonus.plan', deltas: change.deltas });
    recordLevelUp(tx, change, clock);
    bonuses.push('bonus.plan');
  }
  return bonuses;
}

/** Deletes the reminders of the mission for the day and returns their system ids. */
function cancelReminders(tx: Db, missionId: string, day: GameDay): string[] {
  const where = and(
    eq(scheduledReminders.missionId, missionId),
    eq(scheduledReminders.gameDay, day),
  );
  const ids = tx
    .select({ osId: scheduledReminders.osId })
    .from(scheduledReminders)
    .where(where)
    .all();
  tx.delete(scheduledReminders).where(where).run();
  return ids.map((row) => row.osId);
}

/** The rewards and every consequence of a completion, inside the transaction of the action. */
function finishCompletion(
  tx: Db,
  mission: Mission,
  day: GameDay,
  value: number | null,
  input: CompletionInput,
): Omit<CompletionResult, 'moments'> {
  const clock: ActionClock = { now: input.now, tzOffset: input.tzOffset, source: input.source };
  const current = loadHero(tx);
  const rewards = completionDeltas({
    difficulty: mission.difficulty,
    heroStreak: current.streak,
    exhausted: current.exhaustedDay === day,
    statPrimary: mission.statPrimary,
    statSecondary: mission.statSecondary,
  });
  const change = changeHero(tx, rewards, input.now);
  const before = missionDayOf(tx, mission.id, day);
  const { event } = appendEvent(tx, {
    type: 'mission.completed',
    occurredAt: input.now,
    tzOffset: input.tzOffset,
    source: input.source,
    idemKey: input.idemKey,
    missionId: mission.id,
    bossId: mission.bossId,
    gameDay: day,
    deltas: change.deltas,
    // What an undo needs to restore (undo.ts): the mission day and the streak before.
    payload: {
      value,
      before: before === undefined ? null : { status: before.status, value: before.value },
      streakBefore: { streak: mission.streak, best: mission.streakBest },
    },
  });
  recordLevelUp(tx, change, clock);
  writeMissionDay(tx, {
    missionId: mission.id,
    gameDay: day,
    status: 'done',
    value,
    doneAt: input.now,
    source: input.source,
    updatedAt: input.now,
  });
  // Tasks have no streak and the weekly missions count the weeks at the closing of the days
  // (CLAUDE.md, choices 9 and 10).
  if (mission.kind === 'habit' && mission.frequency?.type !== 'times_per_week') {
    const streak = nextMissionStreak({ streak: mission.streak, best: mission.streakBest }, 'done');
    tx.update(missions)
      .set({ streak: streak.streak, streakBest: streak.best })
      .where(eq(missions.id, mission.id))
      .run();
  }
  countCompletion(tx, clock);
  if (mission.bossId !== null) {
    damageBoss(tx, mission.bossId, rewards.bossDamage, clock);
  }
  advanceStarterQuest(tx, clock);
  const bonuses = giveDayBonuses(tx, day, clock);
  return {
    status: 'completed',
    completion: { eventId: event.id, xp: change.deltas.xp, coins: change.deltas.coins },
    bonuses,
    cancelledNotificationIds: cancelReminders(tx, mission.id, day),
  };
}

/**
 * Completes a mission of today in one transaction (modello-dati.md 4.4): event, mission day, hero
 * (XP and level, coins, hit points), stats, companion, mission streak, damage to the linked boss,
 * bonuses of the day and the reminders of the day. A measurable mission is completed at its
 * target. The same completion counts once, whatever its source.
 */
export function completeMission(db: Db, input: CompletionInput): CompletionResult {
  return db.transaction((tx) => {
    if (alreadyRecorded(tx, input.idemKey)) {
      return { status: 'already_recorded', ...NOTHING };
    }
    const day = today(tx, input);
    const mission = dueMission(tx, input.missionId, day);
    const missionDay = missionDayOf(tx, mission.id, day);
    if (missionDay?.status === 'done') {
      return { status: 'already_done', ...NOTHING };
    }
    if (missionDay?.status === 'skipped') {
      throw new RangeError('The mission was skipped today');
    }
    return withMoments(tx, () =>
      finishCompletion(
        tx,
        mission,
        day,
        mission.goalType === 'none' ? null : mission.goalTarget,
        input,
      ),
    );
  });
}

/**
 * Adds an amount to a measurable mission: it stays partial until the value reaches the target,
 * then it is completed with its rewards, once; going beyond the target gives nothing more.
 */
export function progressMission(db: Db, input: ProgressInput): CompletionResult {
  return db.transaction((tx) => {
    if (alreadyRecorded(tx, input.idemKey)) {
      return { status: 'already_recorded', ...NOTHING };
    }
    const day = today(tx, input);
    const mission = dueMission(tx, input.missionId, day);
    if (mission.goalType === 'none' || mission.goalTarget === null || mission.goalStep === null) {
      throw new RangeError('The mission has no measurable goal');
    }
    const missionDay = missionDayOf(tx, mission.id, day);
    if (missionDay?.status === 'skipped') {
      throw new RangeError('The mission was skipped today');
    }
    const progress = measurableProgress({
      value: missionDay?.value ?? 0,
      step: input.amount ?? mission.goalStep,
      target: mission.goalTarget,
    });
    const done = missionDay?.status === 'done';
    if (!done && progress.completesNow) {
      return withMoments(tx, () => finishCompletion(tx, mission, day, progress.value, input));
    }
    writeMissionDay(tx, {
      missionId: mission.id,
      gameDay: day,
      status: done ? 'done' : 'partial',
      value: progress.value,
      doneAt: missionDay?.doneAt ?? null,
      source: input.source,
      updatedAt: input.now,
    });
    appendEvent(tx, {
      type: 'mission.progressed',
      occurredAt: input.now,
      tzOffset: input.tzOffset,
      source: input.source,
      idemKey: input.idemKey,
      missionId: mission.id,
      gameDay: day,
      payload: { value: progress.value },
    });
    return { status: 'progressed', ...NOTHING };
  });
}

/**
 * «Salta oggi» (US-OGGI-06): the mission gives no XP, takes no hit points and does not break its
 * streak. At most 3 skips a week for each mission, from the week start of the settings.
 */
export function skipMission(db: Db, input: SkipInput): { skipsLeft: number } {
  if (!SKIP_REASONS.includes(input.reason)) {
    throw new RangeError(`Unknown reason: ${input.reason}`);
  }
  return db.transaction((tx) => {
    const day = today(tx, input);
    const mission = dueMission(tx, input.missionId, day);
    const missionDay = missionDayOf(tx, mission.id, day);
    if (missionDay?.status === 'done' || missionDay?.status === 'skipped') {
      throw new RangeError(`The mission is already ${missionDay.status} today`);
    }
    const weekStart = weekStartOf(day, getSetting(tx, 'week_start'));
    const skipsThisWeek = tx
      .select({ day: missionDays.gameDay })
      .from(missionDays)
      .where(
        and(
          eq(missionDays.missionId, mission.id),
          eq(missionDays.status, 'skipped'),
          gte(missionDays.gameDay, weekStart),
          lte(missionDays.gameDay, day),
        ),
      )
      .all().length;
    if (skipsLeft(skipsThisWeek) === 0) {
      throw new RangeError('No skips left this week for this mission');
    }
    writeMissionDay(tx, {
      missionId: mission.id,
      gameDay: day,
      status: 'skipped',
      value: missionDay?.value ?? null,
      skipReason: input.reason,
      source: 'app',
      updatedAt: input.now,
    });
    appendEvent(tx, {
      type: 'mission.skipped',
      occurredAt: input.now,
      tzOffset: input.tzOffset,
      source: 'app',
      idemKey: input.idemKey,
      missionId: mission.id,
      gameDay: day,
      payload: { reason: input.reason },
    });
    return { skipsLeft: skipsLeft(skipsThisWeek + 1) };
  });
}

/** Adds a mission of today to the day plan, in the first free place: at most 3 (US-OGGI-02). */
export function setDayPlan(
  db: Db,
  missionId: string,
  clock: { now: number; tzOffset: number },
): void {
  db.transaction((tx) => {
    const day = today(tx, clock);
    dueMission(tx, missionId, day);
    const plan = tx.select().from(dayPlan).where(eq(dayPlan.gameDay, day)).all();
    if (plan.some((row) => row.missionId === missionId)) {
      throw new RangeError('The mission is already a priority');
    }
    if (!canAddToPlan(plan.map((row) => row.missionId))) {
      throw new RangeError(`There are already ${DAY_PLAN.maxPriorities} priorities`);
    }
    const taken = new Set(plan.map((row) => row.position));
    let position = 0;
    while (taken.has(position)) {
      position++;
    }
    tx.insert(dayPlan).values({ gameDay: day, missionId, position }).run();
  });
}

/** Removes a mission from today's plan. */
export function removeFromDayPlan(
  db: Db,
  missionId: string,
  clock: { now: number; tzOffset: number },
): void {
  db.transaction((tx) => {
    const day = today(tx, clock);
    const where = and(eq(dayPlan.gameDay, day), eq(dayPlan.missionId, missionId));
    if (tx.select().from(dayPlan).where(where).get() === undefined) {
      throw new RangeError('The mission is not a priority today');
    }
    tx.delete(dayPlan).where(where).run();
  });
}
