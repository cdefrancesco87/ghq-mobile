import { and, eq, isNull } from 'drizzle-orm';

import { applyBossDamage, stepStatPoints, victoryReward } from '../../rules/boss';
import { BOSS } from '../../rules/config';
import { boss, bossSteps } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { changeHero, recordLevelUp, type ActionClock } from './hero';

// Damage and steps of the bosses, shared by the completions and by the boss actions.

export type Boss = typeof boss.$inferSelect;

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
 * 10 × steps left. A boss that is not active takes no damage.
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
    payload: { damage, hp: hit.hp },
  });
}

/**
 * Marks a step as done: 20 damage, 10 points to the stat of the boss if it has one, and the
 * victory with its reward when it was the last step.
 */
export function markStepDone(tx: Db, stepId: string, clock: ActionClock): { defeated: boolean } {
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
  appendEvent(tx, {
    ...eventBase(clock, target.id),
    type: 'boss.step_done',
    deltas: stats.deltas,
    payload: { stepId, position: step.position, damage: BOSS.stepDamage, hp: hit.hp },
  });
  if (hit.defeated) {
    const steps = tx
      .select({ id: bossSteps.id })
      .from(bossSteps)
      .where(eq(bossSteps.bossId, target.id))
      .all().length;
    const reward = victoryReward(steps, target.difficulty);
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
  return { defeated: hit.defeated };
}
