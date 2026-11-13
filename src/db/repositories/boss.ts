import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import {
  applyBossDamage,
  bossHpMax,
  canCreateBoss,
  deadlineSteal,
  editedBossHp,
  shouldWarnDeadline,
  starterQuestReward,
  stepStatPoints,
  victoryReward,
} from '../../rules/boss';
import { BOSS, BOSS_EDIT } from '../../rules/config';
import { isGameDay } from '../../rules/gameDay';
import { isPausedDay } from '../../rules/pause';
import {
  DIFFICULTIES,
  STAT_KEYS,
  type Difficulty,
  type GameDay,
  type StatKey,
} from '../../rules/types';
import { appNotifications, boss, bossSteps, events, missions } from '../schema';
import type { Db } from '../types';
import { appendEvent, notDeleted } from './events';
import { changeHero, loadHero, recordLevelUp, type ActionClock } from './hero';
import { withMoments, type WithMoments } from './moments';
import { getGeneralPause } from './pause';
import { gameDayOf, getSetting, setSetting } from './settings';

// The bosses (analisi-funzionale.md, section 5; modello-dati.md, 3.8): creation, steps, damage
// from the completions, victory, archive and deadlines.

export type Boss = typeof boss.$inferSelect;

export interface NewBoss {
  readonly name: string;
  readonly difficulty: Difficulty;
  /** Stat that gets 10 points at every step, if any. */
  readonly statKey?: StatKey | null;
  readonly deadlineDay?: GameDay | null;
  /** Titles of the steps, in order: from 2 to 20. */
  readonly steps: readonly string[];
  /** Recurring missions linked to the boss: every completion deals damage. */
  readonly missionIds?: readonly string[];
}

export interface StepResult {
  readonly defeated: boolean;
  /** The `boss.step_done` event, for «Annulla» (design-sezioni.md 2.4). */
  readonly eventId: string;
  /** Hit points really taken, for the number of the damage (design-sezioni.md 5.4). */
  readonly dealt: number;
}

export interface DeadlineCheck {
  /** Bosses whose deadline warning starts now: the caller sends the system notification. */
  readonly warned: readonly string[];
  /** Bosses whose deadline has passed now, with the coins they stole. */
  readonly robbed: readonly { bossId: string; coins: number }[];
}

function stepsLeft(tx: Db, bossId: string): number {
  return tx
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(and(eq(bossSteps.bossId, bossId), isNull(bossSteps.doneAt)))
    .all().length;
}

function eventBase(clock: ActionClock, bossId: string) {
  return {
    occurredAt: clock.now,
    tzOffset: clock.tzOffset,
    source: clock.source ?? 'app',
    bossId,
  } as const;
}

/**
 * The damage of a completed mission to its boss. Missions never win: the hit points stop at
 * 10 × steps left. A boss that is not active takes no damage. The event records the hit points
 * really taken (`dealt`), so that an undo can give them back.
 */
export function damageBoss(tx: Db, bossId: string, damage: number, clock: ActionClock): void {
  const target = tx.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'active') {
    return;
  }
  const hit = applyBossDamage({ hp: target.hp, stepsLeft: stepsLeft(tx, bossId) }, damage);
  tx.update(boss).set({ hp: hit.hp, updatedAt: clock.now }).where(eq(boss.id, bossId)).run();
  appendEvent(tx, {
    ...eventBase(clock, bossId),
    type: 'boss.damaged',
    payload: { damage, dealt: target.hp - hit.hp, hp: hit.hp },
  });
}

/** Gives back hit points taken by an undone completion, if the boss is still active. */
export function healBoss(tx: Db, bossId: string, points: number, now: number): void {
  const target = tx.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'active' || points <= 0) {
    return;
  }
  tx.update(boss)
    .set({ hp: Math.min(target.hpMax, target.hp + points), updatedAt: now })
    .where(eq(boss.id, bossId))
    .run();
}

/**
 * Marks a step as done: 20 damage, 10 points to the stat of the boss if it has one, and the
 * victory with its reward when it was the last step.
 */
export function markStepDone(tx: Db, stepId: string, clock: ActionClock): StepResult {
  const step = tx.select().from(bossSteps).where(eq(bossSteps.id, stepId)).get();
  if (step === undefined) {
    throw new RangeError(`Unknown boss step: ${stepId}`);
  }
  if (step.doneAt !== null) {
    throw new RangeError('The step is already done');
  }
  const target = tx.select().from(boss).where(eq(boss.id, step.bossId)).get();
  if (target === undefined || target.status !== 'active') {
    throw new RangeError('The boss of the step is not active');
  }
  tx.update(bossSteps).set({ doneAt: clock.now }).where(eq(bossSteps.id, stepId)).run();
  const hit = applyBossDamage(
    { hp: target.hp, stepsLeft: stepsLeft(tx, target.id) },
    BOSS.stepDamage,
  );
  tx.update(boss).set({ hp: hit.hp, updatedAt: clock.now }).where(eq(boss.id, target.id)).run();
  const stats = changeHero(tx, { stats: stepStatPoints(target.statKey) }, clock.now);
  const { event } = appendEvent(tx, {
    ...eventBase(clock, target.id),
    type: 'boss.step_done',
    deltas: stats.deltas,
    payload: {
      stepId,
      position: step.position,
      damage: BOSS.stepDamage,
      dealt: target.hp - hit.hp,
      hp: hit.hp,
    },
  });
  if (hit.defeated) {
    const steps = tx
      .select({ id: bossSteps.id })
      .from(bossSteps)
      .where(eq(bossSteps.bossId, target.id))
      .all().length;
    const reward =
      target.kind === 'starter'
        ? starterQuestReward(loadHero(tx))
        : victoryReward(steps, target.difficulty);
    const change = changeHero(tx, { xp: reward.xp, coins: reward.coins }, clock.now);
    tx.update(boss)
      .set({ status: 'defeated', defeatedAt: clock.now, updatedAt: clock.now })
      .where(eq(boss.id, target.id))
      .run();
    appendEvent(tx, {
      ...eventBase(clock, target.id),
      type: 'boss.defeated',
      deltas: change.deltas,
      // The victory of the quest of the first launch is a smaller moment (design 1.8).
      payload: { steps, starter: target.kind === 'starter' },
    });
    recordLevelUp(tx, change, clock);
  }
  return { defeated: hit.defeated, eventId: event.id, dealt: target.hp - hit.hp };
}

function todayOf(tx: Db, clock: ActionClock): GameDay {
  return gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
}

function activeCount(tx: Db): number {
  return tx.select({ id: boss.id }).from(boss).where(eq(boss.status, 'active')).all().length;
}

/** A boss with its steps done, all of them and the next one to do. */
export interface BossProgress {
  readonly boss: Boss;
  readonly stepsDone: number;
  readonly stepsTotal: number;
  readonly nextStep: { readonly id: string; readonly title: string } | null;
}

/** The steps of some bosses, in their order: Today and Obiettivi (design-sezioni.md 2.4, 5.1). */
export function withSteps(db: Db, bosses: readonly Boss[]): BossProgress[] {
  if (bosses.length === 0) {
    return [];
  }
  const steps = db
    .select()
    .from(bossSteps)
    .where(
      inArray(
        bossSteps.bossId,
        bosses.map((item) => item.id),
      ),
    )
    .orderBy(asc(bossSteps.position))
    .all();
  return bosses.map((item) => {
    const own = steps.filter((step) => step.bossId === item.id);
    const next = own.find((step) => step.doneAt === null);
    return {
      boss: item,
      stepsDone: own.filter((step) => step.doneAt !== null).length,
      stepsTotal: own.length,
      nextStep: next === undefined ? null : { id: next.id, title: next.title },
    };
  });
}

/** The active bosses, from the oldest: the choices of «Boss collegato» (design-sezioni.md 4.9). */
export function listActiveBosses(db: Db): Boss[] {
  return db.select().from(boss).where(eq(boss.status, 'active')).orderBy(asc(boss.createdAt)).all();
}

/**
 * Creates a boss (US-BOSS-01): 20 hit points per step, at most 3 active bosses (the quest of
 * the first launch included), an optional deadline from today on and the linked missions.
 */
export function createBoss(db: Db, input: NewBoss, clock: ActionClock): Boss {
  const name = input.name.trim();
  if (name === '') {
    throw new RangeError('The boss needs a name');
  }
  if (!DIFFICULTIES.includes(input.difficulty)) {
    throw new RangeError(`Unknown difficulty: ${input.difficulty}`);
  }
  const statKey = input.statKey ?? null;
  if (statKey !== null && !STAT_KEYS.includes(statKey)) {
    throw new RangeError(`Unknown stat: ${statKey}`);
  }
  const titles = input.steps.map((title) => title.trim());
  if (titles.some((title) => title === '')) {
    throw new RangeError('Every step needs a title');
  }
  const hpMax = bossHpMax(titles.length);
  const missionIds = [...new Set(input.missionIds ?? [])];
  return db.transaction((tx) => {
    if (!canCreateBoss(activeCount(tx))) {
      throw new RangeError(`There are already ${BOSS.maxActive} active bosses`);
    }
    const deadlineDay = input.deadlineDay ?? null;
    if (deadlineDay !== null && (!isGameDay(deadlineDay) || deadlineDay < todayOf(tx, clock))) {
      throw new RangeError(`The deadline must be today or later: ${deadlineDay}`);
    }
    if (missionIds.length > 0) {
      const found = tx
        .select({ id: missions.id })
        .from(missions)
        .where(and(inArray(missions.id, missionIds), notDeleted(missions)))
        .all();
      if (found.length !== missionIds.length) {
        throw new RangeError('A linked mission does not exist');
      }
    }
    const created = tx
      .insert(boss)
      .values({
        id: uuidv7(),
        name,
        kind: 'normal',
        difficulty: input.difficulty,
        statKey,
        hpMax,
        hp: hpMax,
        deadlineDay,
        createdAt: clock.now,
        updatedAt: clock.now,
      })
      .returning()
      .get();
    tx.insert(bossSteps)
      .values(
        titles.map((title, position) => ({ id: uuidv7(), bossId: created.id, position, title })),
      )
      .run();
    if (missionIds.length > 0) {
      tx.update(missions)
        .set({ bossId: created.id, updatedAt: clock.now })
        .where(inArray(missions.id, missionIds))
        .run();
    }
    appendEvent(tx, {
      ...eventBase(clock, created.id),
      type: 'boss.created',
      payload: { kind: 'normal', steps: titles.length, hpMax, missionIds },
    });
    return created;
  });
}

/** Completes a step of an active boss: damage, stat points and, at the last step, the victory. */
export function completeBossStep(
  db: Db,
  stepId: string,
  clock: ActionClock,
): StepResult & WithMoments {
  return db.transaction((tx) => withMoments(tx, () => markStepDone(tx, stepId, clock)));
}

/** The step of the quest of the first launch that opening the statistics does (design 1.8). */
const STARTER_STATS_STEP = 2;

/** The step of the quest of the first launch that opening the statistics would do, if any. */
export function starterStatsStepId(db: Db): string | null {
  const quest = db
    .select({ id: boss.id })
    .from(boss)
    .where(and(eq(boss.kind, 'starter'), eq(boss.status, 'active')))
    .get();
  if (quest === undefined) {
    return null;
  }
  const steps = db.select().from(bossSteps).where(eq(bossSteps.bossId, quest.id)).all();
  const before = steps.find((step) => step.position === STARTER_STATS_STEP - 1);
  const target = steps.find((step) => step.position === STARTER_STATS_STEP);
  return target === undefined || target.doneAt !== null || before?.doneAt == null
    ? null
    : target.id;
}

/**
 * Opening the statistics does the third step of the quest of the first launch, and so wins it
 * (design-sezioni.md 1.8), once its second step (the first completion) is done. Otherwise, or
 * without an active quest, nothing changes.
 */
export function completeStarterStatsStep(
  db: Db,
  clock: ActionClock,
): { readonly done: boolean } & WithMoments {
  return db.transaction((tx) =>
    withMoments(tx, () => {
      const stepId = starterStatsStepId(tx);
      if (stepId === null) {
        return { done: false };
      }
      markStepDone(tx, stepId, clock);
      return { done: true };
    }),
  );
}

/** Archives an active boss: it leaves the list, its steps stay (US-BOSS-03). */
export function archiveBoss(db: Db, bossId: string, clock: ActionClock): void {
  db.transaction((tx) => {
    const target = tx.select().from(boss).where(eq(boss.id, bossId)).get();
    if (target === undefined || target.status !== 'active') {
      throw new RangeError(`There is no active boss ${bossId}`);
    }
    tx.update(boss)
      .set({ status: 'archived', updatedAt: clock.now })
      .where(eq(boss.id, bossId))
      .run();
    appendEvent(tx, { ...eventBase(clock, bossId), type: 'boss.archived' });
  });
}

/** A step of a boss being changed: `id` for a step that exists, none for a new one. */
export interface BossStepEdit {
  readonly id?: string;
  readonly title: string;
}

export interface BossEdit {
  readonly name: string;
  /** Every step, in the new order; a step of the boss left out is taken away. */
  readonly steps: readonly BossStepEdit[];
  /** The missions linked to the boss after the change; the links stay when missing. */
  readonly missionIds?: readonly string[];
  /** The new deadline, null for none; the deadline stays when missing or the same. */
  readonly deadlineDay?: GameDay | null;
}

function activeBoss(tx: Db, bossId: string): Boss {
  const target = tx.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'active') {
    throw new RangeError(`There is no active boss ${bossId}`);
  }
  return target;
}

/** A new deadline from today on, or none: the warning 3 days before starts again. */
function moveDeadline(tx: Db, bossId: string, deadlineDay: GameDay | null, clock: ActionClock) {
  if (deadlineDay !== null && (!isGameDay(deadlineDay) || deadlineDay < todayOf(tx, clock))) {
    throw new RangeError(`The deadline must be today or later: ${deadlineDay}`);
  }
  tx.update(boss)
    .set({ deadlineDay, deadlineWarned: false, updatedAt: clock.now })
    .where(eq(boss.id, bossId))
    .run();
}

/** Links exactly these missions to the boss: the others that hit it are left without a boss. */
function linkMissions(tx: Db, bossId: string, missionIds: readonly string[], now: number): void {
  if (missionIds.length > 0) {
    const found = tx
      .select({ id: missions.id })
      .from(missions)
      .where(and(inArray(missions.id, missionIds), notDeleted(missions)))
      .all();
    if (found.length !== missionIds.length) {
      throw new RangeError('A linked mission does not exist');
    }
  }
  const unlinked = tx
    .select({ id: missions.id })
    .from(missions)
    .where(eq(missions.bossId, bossId))
    .all()
    .map((row) => row.id)
    .filter((id) => !missionIds.includes(id));
  if (unlinked.length > 0) {
    tx.update(missions)
      .set({ bossId: null, updatedAt: now })
      .where(inArray(missions.id, unlinked))
      .run();
  }
  if (missionIds.length > 0) {
    tx.update(missions)
      .set({ bossId, updatedAt: now })
      .where(inArray(missions.id, [...missionIds]))
      .run();
  }
}

/**
 * Changes an active boss after its creation (US-BOSS-01): name, steps added, taken away, moved
 * and renamed, linked missions. The hit points follow `editedBossHp` and the victory pays the new
 * number of steps. Provisional until CLAUDE.md choice 21 (BOSS_EDIT): a done step cannot be taken
 * away and at least one step to do stays. The quest of the first launch keeps its steps.
 */
export function updateBoss(db: Db, bossId: string, input: BossEdit, clock: ActionClock): Boss {
  const name = input.name.trim();
  if (name === '') {
    throw new RangeError('The boss needs a name');
  }
  const wanted = input.steps.map((step) => ({ id: step.id, title: step.title.trim() }));
  if (wanted.some((step) => step.title === '')) {
    throw new RangeError('Every step needs a title');
  }
  const hpMax = bossHpMax(wanted.length);
  return db.transaction((tx) => {
    const target = activeBoss(tx, bossId);
    if (target.kind === 'starter') {
      throw new RangeError('The quest of the first launch cannot be changed');
    }
    const current = tx.select().from(bossSteps).where(eq(bossSteps.bossId, bossId)).all();
    const kept = wanted.flatMap((step) => (step.id === undefined ? [] : [step.id]));
    if (new Set(kept).size !== kept.length) {
      throw new RangeError('A step is there twice');
    }
    if (kept.some((id) => !current.some((step) => step.id === id))) {
      throw new RangeError('A step is not of this boss');
    }
    const removed = current.filter((step) => !kept.includes(step.id));
    if (!BOSS_EDIT.canRemoveDoneSteps && removed.some((step) => step.doneAt !== null)) {
      throw new RangeError('A done step cannot be taken away');
    }
    const stepsLeftBefore = current.filter((step) => step.doneAt === null).length;
    const stepsLeft = wanted.filter(
      (step) => step.id === undefined || current.find((row) => row.id === step.id)?.doneAt === null,
    ).length;
    if (stepsLeft < BOSS_EDIT.minStepsLeft) {
      throw new RangeError('The boss needs a step to do for the final blow');
    }
    const hp = editedBossHp({ hp: target.hp, stepsLeft: stepsLeftBefore }, stepsLeft, hpMax);
    if (removed.length > 0) {
      tx.delete(bossSteps)
        .where(
          inArray(
            bossSteps.id,
            removed.map((step) => step.id),
          ),
        )
        .run();
    }
    wanted.forEach((step, position) => {
      if (step.id === undefined) {
        tx.insert(bossSteps).values({ id: uuidv7(), bossId, position, title: step.title }).run();
        return;
      }
      tx.update(bossSteps)
        .set({ position, title: step.title })
        .where(eq(bossSteps.id, step.id))
        .run();
    });
    const missionIds = input.missionIds === undefined ? null : [...new Set(input.missionIds)];
    if (missionIds !== null) {
      linkMissions(tx, bossId, missionIds, clock.now);
    }
    const deadlineDay = input.deadlineDay;
    const newDeadline = deadlineDay !== undefined && deadlineDay !== target.deadlineDay;
    if (newDeadline) {
      moveDeadline(tx, bossId, deadlineDay, clock);
    }
    const updated = tx
      .update(boss)
      .set({ name, hp, hpMax, updatedAt: clock.now })
      .where(eq(boss.id, bossId))
      .returning()
      .get();
    appendEvent(tx, {
      ...eventBase(clock, bossId),
      type: 'boss.updated',
      payload: {
        name,
        steps: wanted.length,
        added: wanted.length - kept.length,
        removed: removed.length,
        hp,
        hpMax,
        ...(missionIds === null ? {} : { missionIds }),
        ...(newDeadline ? { deadlineDay } : {}),
      },
    });
    return updated;
  });
}

/**
 * «Nuova scadenza» of an active boss (design-sezioni.md 5.3, 5.6; US-BOSS-03): a day from today
 * on, or none. The warning 3 days before starts again, and a new deadline can be missed once.
 */
export function setBossDeadline(
  db: Db,
  bossId: string,
  deadlineDay: GameDay | null,
  clock: ActionClock,
): void {
  db.transaction((tx) => {
    activeBoss(tx, bossId);
    moveDeadline(tx, bossId, deadlineDay, clock);
    appendEvent(tx, {
      ...eventBase(clock, bossId),
      type: 'boss.updated',
      payload: { deadlineDay },
    });
  });
}

/**
 * Deletes an active boss (design-sezioni.md 5.3), provisional until CLAUDE.md choice 21: the data
 * model has no deletion of a boss, so it is logical (`status = 'deleted'`). It leaves every list,
 * frees its place, its missions hit no boss any more and it never steals; the steps stay, and so
 * does what it already gave to the hero, since the log is never rewritten.
 */
export function deleteBoss(db: Db, bossId: string, clock: ActionClock): void {
  db.transaction((tx) => {
    activeBoss(tx, bossId);
    linkMissions(tx, bossId, [], clock.now);
    tx.update(boss)
      .set({ status: 'deleted', updatedAt: clock.now })
      .where(eq(boss.id, bossId))
      .run();
    appendEvent(tx, { ...eventBase(clock, bossId), type: 'boss.deleted' });
  });
}

function notify(tx: Db, kind: string, bossId: string, now: number): void {
  tx.insert(appNotifications)
    .values({ id: uuidv7(), kind, params: { bossId }, createdAt: now })
    .run();
}

/**
 * The deadlines of the active bosses (analisi-funzionale.md, section 5): the warning from 3 days
 * before, once, and, when the deadline has passed, the theft of 10% of the coins (at most 500),
 * once for each deadline (nothing in the Essential mode). The boss stays active and its steps stay.
 * On a day of general pause nothing happens, and a deadline that falls in the pause in progress or
 * scheduled is skipped: the end of the pause moves it forward (choice 23, closePendingDays).
 */
export function checkBossDeadlines(db: Db, clock: ActionClock): DeadlineCheck {
  return db.transaction((tx) => {
    const today = todayOf(tx, clock);
    const warned: string[] = [];
    const robbed: { bossId: string; coins: number }[] = [];
    const pause = getGeneralPause(tx);
    const pauses = pause === null ? [] : [pause];
    if (isPausedDay(today, pauses)) {
      return { warned, robbed };
    }
    const active = tx.select().from(boss).where(eq(boss.status, 'active')).all();
    for (const target of active) {
      if (target.deadlineDay === null || isPausedDay(target.deadlineDay, pauses)) {
        continue;
      }
      if (shouldWarnDeadline(today, target.deadlineDay, target.deadlineWarned)) {
        tx.update(boss).set({ deadlineWarned: true }).where(eq(boss.id, target.id)).run();
        notify(tx, 'boss.deadline_warning', target.id, clock.now);
        warned.push(target.id);
      }
      const idemKey = `boss.deadline_missed:${target.id}:${target.deadlineDay}`;
      const alreadyStolen =
        tx.select({ id: events.id }).from(events).where(eq(events.idemKey, idemKey)).get() !==
        undefined;
      if (today <= target.deadlineDay || alreadyStolen) {
        continue;
      }
      // In the Essential mode the penalties are off: the deadline is missed, nothing is stolen
      // (design-sezioni.md 5.10), and the sheet still offers a new deadline.
      const coins =
        getSetting(tx, 'game_mode') === 'essential' ? 0 : deadlineSteal(loadHero(tx).coins);
      const change = changeHero(tx, { coins: -coins }, clock.now);
      appendEvent(tx, {
        ...eventBase(clock, target.id),
        type: 'boss.deadline_missed',
        idemKey,
        deltas: change.deltas,
        payload: { deadlineDay: target.deadlineDay, coins },
      });
      notify(tx, 'boss.deadline_missed', target.id, clock.now);
      robbed.push({ bossId: target.id, coins });
    }
    return { warned, robbed };
  });
}

export interface MissedDeadline extends BossProgress {
  /** The `seq` of the theft in the log: the sheet is marked seen up to it. */
  readonly seq: number;
  /** Coins stolen by the boss. */
  readonly coins: number;
}

/**
 * The sheets of the missed deadlines still to show (design-sezioni.md 5.6; US-BOSS-03), from the
 * oldest theft: one for every theft after the last sheet seen, while the boss is still active and
 * its deadline is the one missed (a new deadline, the archive or the deletion close the matter).
 */
export function pendingMissedDeadlines(db: Db): MissedDeadline[] {
  const thefts = db
    .select()
    .from(events)
    .where(
      and(
        eq(events.type, 'boss.deadline_missed'),
        gt(events.seq, getSetting(db, 'missed_deadline_seen')),
      ),
    )
    .orderBy(asc(events.seq))
    .all();
  if (thefts.length === 0) {
    return [];
  }
  const robbed = withSteps(
    db,
    db
      .select()
      .from(boss)
      .where(
        and(
          eq(boss.status, 'active'),
          inArray(
            boss.id,
            thefts.map((event) => event.bossId ?? ''),
          ),
        ),
      )
      .all(),
  );
  return thefts.flatMap((event) => {
    const item = robbed.find((row) => row.boss.id === event.bossId);
    return item === undefined || item.boss.deadlineDay !== event.payload.deadlineDay
      ? []
      : [{ ...item, seq: event.seq, coins: Math.abs(event.dCoins) }];
  });
}

/** The sheet of a missed deadline was shown: it does not open again, nor do the older ones. */
export function markMissedDeadlineSeen(db: Db, seq: number, now: number): void {
  db.transaction((tx) => {
    if (seq > getSetting(tx, 'missed_deadline_seen')) {
      setSetting(tx, 'missed_deadline_seen', seq, now);
    }
  });
}
