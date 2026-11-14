import { and, asc, eq, gt, inArray } from 'drizzle-orm';

import { canAddToPlan } from '../../rules/day';
import { bonusesToRevert, canUndo, revertDeltas, type DayBonus } from '../../rules/undo';
import type { GameDay } from '../../rules/types';
import { boss, bossSteps, companion, dayPlan, events, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { healBoss } from './boss';
import { appendEvent, type EventRow } from './events';
import { changeHero, NotEnoughCoinsError, type ActionClock } from './hero';
import { listTodayMissions } from './missions';
import { gameDayOf, getSetting } from './settings';

// Undo of a completion (US-OGGI-04; modello-dati.md, 4.3) or of a skip (design-sezioni.md A7):
// nothing is deleted from the log, an `event.reverted` event adds the opposite changes (none for
// a skip, apart from the bonus it gave). Every gain goes back: XP and level, coins,
// hit points, stat points, the mission day and streak, the damage to the boss and the bonuses of
// the day that the undo makes incomplete (CLAUDE.md, choices 4 and 5). The companion never loses
// a stage and the step of the quest of the first launch stays done.

/** Why an undo was refused: the screen says it in words (US-OGGI-04). */
export type UndoRefusal = 'already_undone' | 'day_changed' | 'coins_spent' | 'boss_not_active';

export class UndoRefusedError extends RangeError {
  constructor(readonly reason: UndoRefusal) {
    super(`The undo was refused: ${reason}`);
    this.name = 'UndoRefusedError';
  }
}

/** What a `mission.completed` event records for its undo (completion.ts). */
interface CompletionPayload {
  readonly before: { status: 'partial' | 'skipped' | 'done'; value: number | null } | null;
  readonly streakBefore: { streak: number; best: number };
}

/** What a `mission.skipped` event records for its undo (completion.ts). */
interface SkipPayload {
  readonly before: { status: 'partial'; value: number | null } | null;
  /** The place the mission had in the day plan. */
  readonly planPosition: number | null;
}

/** Puts a skipped priority back in the plan: in its place if free, else in the first free one. */
function restorePriority(tx: Db, missionId: string, day: GameDay, position: number): void {
  const plan = tx.select().from(dayPlan).where(eq(dayPlan.gameDay, day)).all();
  const ids = plan.map((row) => row.missionId);
  if (ids.includes(missionId) || !canAddToPlan(ids)) {
    return;
  }
  const taken = new Set(plan.map((row) => row.position));
  let free = position;
  if (taken.has(free)) {
    free = 0;
    while (taken.has(free)) {
      free++;
    }
  }
  tx.insert(dayPlan).values({ gameDay: day, missionId, position: free }).run();
}

function isReverted(tx: Db, eventId: string): boolean {
  return (
    tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.type, 'event.reverted'), eq(events.revertsId, eventId)))
      .get() !== undefined
  );
}

/** Writes the `event.reverted` event of an event and applies its opposite changes to the hero. */
function revert(tx: Db, original: EventRow, clock: ActionClock): void {
  const change = changeHero(
    tx,
    revertDeltas({
      xp: original.dXp,
      coins: original.dCoins,
      hp: original.dHp,
      stats: original.dStats ?? {},
    }),
    clock.now,
  );
  appendEvent(tx, {
    type: 'event.reverted',
    occurredAt: clock.now,
    tzOffset: clock.tzOffset,
    source: clock.source ?? 'app',
    gameDay: original.gameDay,
    missionId: original.missionId,
    bossId: original.bossId,
    itemKey: original.itemKey,
    revertsId: original.id,
    deltas: change.deltas,
    payload: { type: original.type },
  });
}

function restoreMissionDay(tx: Db, completed: EventRow, payload: CompletionPayload): void {
  const missionId = completed.missionId!;
  const where = and(
    eq(missionDays.missionId, missionId),
    eq(missionDays.gameDay, completed.gameDay),
  );
  if (payload.before === null) {
    tx.delete(missionDays).where(where).run();
  } else {
    tx.update(missionDays)
      .set({
        status: payload.before.status,
        value: payload.before.value,
        doneAt: null,
        updatedAt: completed.occurredAt,
      })
      .where(where)
      .run();
  }
  tx.update(missions)
    .set({ streak: payload.streakBefore.streak, streakBest: payload.streakBefore.best })
    .where(eq(missions.id, missionId))
    .run();
}

/**
 * Gives back to the boss the hit points taken by the completion: the `dealt` of the
 * `boss.damaged` event linked to it (`completionId`), nothing if the completion dealt no damage
 * (a boss not active, e.g. locked in a chain). Events written before the link have no
 * `completionId`: the damage is the one written by the same action (same instant, right after).
 */
function restoreBoss(tx: Db, completed: EventRow, now: number): void {
  if (completed.bossId === null) {
    return;
  }
  const candidates = tx
    .select()
    .from(events)
    .where(
      and(
        eq(events.type, 'boss.damaged'),
        eq(events.bossId, completed.bossId),
        eq(events.occurredAt, completed.occurredAt),
        gt(events.seq, completed.seq),
      ),
    )
    .orderBy(asc(events.seq))
    .all();
  const damaged =
    candidates.find((row) => row.payload.completionId === completed.id) ??
    candidates.find((row) => row.payload.completionId === undefined);
  const dealt = damaged?.payload.dealt;
  if (typeof dealt === 'number') {
    healBoss(tx, completed.bossId, dealt, now);
  }
}

/** The bonus events of a day still in force, by type. */
function bonusesInForce(tx: Db, day: GameDay): Map<DayBonus, EventRow> {
  const given = tx
    .select()
    .from(events)
    .where(and(inArray(events.type, ['bonus.full_day', 'bonus.plan']), eq(events.gameDay, day)))
    .all();
  const inForce = new Map<DayBonus, EventRow>();
  for (const event of given) {
    if (!isReverted(tx, event.id)) {
      inForce.set(event.type as DayBonus, event);
    }
  }
  return inForce;
}

/** Undoes the day bonuses that the day, or the plan, no longer earns. */
function revertDayBonuses(tx: Db, day: GameDay, clock: ActionClock): string[] {
  const given = bonusesInForce(tx, day);
  if (given.size === 0) {
    return [];
  }
  const rows = tx.select().from(missionDays).where(eq(missionDays.gameDay, day)).all();
  const skipped = new Set(
    rows.filter((row) => row.status === 'skipped').map((row) => row.missionId),
  );
  const toRevert = bonusesToRevert({
    scheduled: listTodayMissions(tx, day)
      .map((mission) => mission.id)
      .filter((id) => !skipped.has(id)),
    plan: tx
      .select({ missionId: dayPlan.missionId })
      .from(dayPlan)
      .where(eq(dayPlan.gameDay, day))
      .all()
      .map((row) => row.missionId),
    doneAfterUndo: rows.filter((row) => row.status === 'done').map((row) => row.missionId),
    given: [...given.keys()],
  });
  return toRevert.map((type) => {
    const bonus = given.get(type)!;
    revert(tx, bonus, clock);
    return bonus.id;
  });
}

/**
 * The opposite of «Salta oggi»: the mission is to do again, with the value it had and its place
 * in the plan, and the skip no longer counts in the week. The bonuses the day no longer earns go
 * back with it.
 */
function undoSkip(tx: Db, skipped: EventRow, clock: ActionClock): { reverted: string[] } {
  revert(tx, skipped, clock);
  const where = and(
    eq(missionDays.missionId, skipped.missionId!),
    eq(missionDays.gameDay, skipped.gameDay),
  );
  const { before, planPosition } = skipped.payload as Partial<SkipPayload>;
  // Skips written before T59 have no `before`: a value kept by the skip means a partial mission.
  const value =
    before === undefined
      ? (tx.select().from(missionDays).where(where).get()?.value ?? null)
      : (before?.value ?? null);
  if (value === null) {
    tx.delete(missionDays).where(where).run();
  } else {
    tx.update(missionDays)
      .set({ status: 'partial', value, skipReason: null, updatedAt: clock.now })
      .where(where)
      .run();
  }
  if (typeof planPosition === 'number') {
    restorePriority(tx, skipped.missionId!, skipped.gameDay, planPosition);
  }
  return { reverted: [skipped.id, ...revertDayBonuses(tx, skipped.gameDay, clock)] };
}

/** The opposite changes of a completion that can be undone. */
function undoCompletion(tx: Db, completed: EventRow, clock: ActionClock): { reverted: string[] } {
  revert(tx, completed, clock);
  restoreMissionDay(tx, completed, completed.payload as unknown as CompletionPayload);
  restoreBoss(tx, completed, clock.now);
  const current = tx.select().from(companion).get();
  if (current !== undefined && current.completionsTotal > 0) {
    tx.update(companion)
      .set({ completionsTotal: current.completionsTotal - 1 })
      .where(eq(companion.id, current.id))
      .run();
  }
  return { reverted: [completed.id, ...revertDayBonuses(tx, completed.gameDay, clock)] };
}

/**
 * The opposite changes of a boss step: the step is to do again, the boss gets back the hit points
 * the step really took (`dealt`) and the stat points go back. A victory is never undone
 * (CLAUDE.md, choice 25), so no step of a boss that is no longer active can be undone.
 */
function undoStep(
  tx: Db,
  done: EventRow,
  bossId: string,
  clock: ActionClock,
): { reverted: string[] } {
  const target = tx.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'active') {
    throw new UndoRefusedError('boss_not_active');
  }
  revert(tx, done, clock);
  const { stepId, dealt } = done.payload;
  if (typeof stepId === 'string') {
    tx.update(bossSteps).set({ doneAt: null }).where(eq(bossSteps.id, stepId)).run();
  }
  if (typeof dealt === 'number') {
    healBoss(tx, target.id, dealt, clock.now);
  }
  return { reverted: [done.id] };
}

/**
 * Undoes a completion, a skip or a boss step of today. Refused for an unknown event, an event of
 * another type, an event already undone, after the day change, when the coins to give back were
 * already spent, and for the steps of a defeated boss. Returns the ids of the events undone: the
 * completion or the skip and the bonuses it takes back, or the step.
 */
export function undoEvent(db: Db, eventId: string, clock: ActionClock): { reverted: string[] } {
  return db.transaction((tx) => {
    const completed = tx.select().from(events).where(eq(events.id, eventId)).get();
    if (completed === undefined) {
      throw new RangeError(`Unknown event: ${eventId}`);
    }
    const stepBossId = completed.type === 'boss.step_done' ? completed.bossId : null;
    const ofMission =
      completed.type === 'mission.completed' || completed.type === 'mission.skipped';
    if (stepBossId === null && (!ofMission || completed.missionId === null)) {
      throw new RangeError(
        `Only a completion, a skip or a boss step can be undone: ${completed.type}`,
      );
    }
    if (isReverted(tx, completed.id)) {
      throw new UndoRefusedError('already_undone');
    }
    const today = gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
    if (!canUndo(completed.gameDay, today)) {
      throw new UndoRefusedError('day_changed');
    }
    if (stepBossId !== null) {
      return undoStep(tx, completed, stepBossId, clock);
    }
    try {
      return completed.type === 'mission.skipped'
        ? undoSkip(tx, completed, clock)
        : undoCompletion(tx, completed, clock);
    } catch (error) {
      throw error instanceof NotEnoughCoinsError ? new UndoRefusedError('coins_spent') : error;
    }
  });
}
