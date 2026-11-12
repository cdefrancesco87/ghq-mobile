import { and, eq, inArray, isNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import {
  applyBossDamage,
  bossHpMax,
  canCreateBoss,
  deadlineSteal,
  shouldWarnDeadline,
  starterQuestReward,
  stepStatPoints,
  victoryReward,
} from '../../rules/boss';
import { BOSS } from '../../rules/config';
import { isGameDay } from '../../rules/gameDay';
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
import { gameDayOf, getSetting } from './settings';

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
      payload: { steps },
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

function notify(tx: Db, kind: string, bossId: string, now: number): void {
  tx.insert(appNotifications)
    .values({ id: uuidv7(), kind, params: { bossId }, createdAt: now })
    .run();
}

/**
 * The deadlines of the active bosses (analisi-funzionale.md, section 5): the warning from 3 days
 * before, once, and, when the deadline has passed, the theft of 10% of the coins (at most 500),
 * once for each deadline. The boss stays active and its steps stay.
 */
export function checkBossDeadlines(db: Db, clock: ActionClock): DeadlineCheck {
  return db.transaction((tx) => {
    const today = todayOf(tx, clock);
    const warned: string[] = [];
    const robbed: { bossId: string; coins: number }[] = [];
    const active = tx.select().from(boss).where(eq(boss.status, 'active')).all();
    for (const target of active) {
      if (target.deadlineDay === null) {
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
      const coins = deadlineSteal(loadHero(tx).coins);
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
