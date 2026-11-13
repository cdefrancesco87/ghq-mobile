import { eq } from 'drizzle-orm';

import { backfillDays, backfillDeltas, canBackfill } from '../../rules/backfill';
import type { GameDay } from '../../rules/types';
import { daySummaries } from '../schema';
import type { Db } from '../types';
import { damageBoss } from './boss';
import { countCompletion, missionDayOf, writeMissionDay } from './completion';
import { appendEvent } from './events';
import { getHeatmapDay } from './heatmap';
import { changeHero, recordLevelUp, type ActionClock } from './hero';
import type { Mission } from './missions';
import { withMoments, type WithMoments } from './moments';
import { gameDayOf, getSetting } from './settings';

// The forgotten completion (US-STAT-03; design-sezioni.md 8.3 and 8.6; modello-dati.md 4.2): a
// mission expected on one of the 7 days before today and not done is completed afterwards, with
// the `mission.backfilled` event on that day. It gives no hit points back and does not touch the
// streaks of the hero and of the mission, nor the bonuses of the day (BACKFILL in config.ts).

export interface BackfillDay {
  readonly day: GameDay;
  /** The missions missed that day, in the order of the missions. */
  readonly missions: readonly Mission[];
}

export interface BackfillInput {
  readonly missionId: string;
  readonly day: GameDay;
  /** UTC instant of the action, in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC (local time = UTC + offset). */
  readonly tzOffset: number;
}

export interface BackfillResult extends WithMoments {
  readonly eventId: string;
  readonly xp: number;
  readonly coins: number;
}

function todayOf(db: Db, clock: ActionClock): GameDay {
  return gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
}

function missedOn(db: Db, clock: ActionClock, day: GameDay): Mission[] {
  return getHeatmapDay(db, clock, day)
    .missions.filter((item) => item.mark === 'missed')
    .map((item) => item.mission);
}

/**
 * The missions that can still be completed afterwards: those missed on the 7 days before today,
 * the latest day first, only the days with at least one. With `onlyDay`, that day alone.
 */
export function listBackfillCandidates(
  db: Db,
  clock: ActionClock,
  onlyDay?: GameDay,
): BackfillDay[] {
  const today = todayOf(db, clock);
  const days =
    onlyDay === undefined ? backfillDays(today) : canBackfill(onlyDay, today) ? [onlyDay] : [];
  return days
    .map((day) => ({ day, missions: missedOn(db, clock, day) }))
    .filter((item) => item.missions.length > 0);
}

/**
 * Completes afterwards a mission missed on one of the 7 days before today, in one transaction:
 * base XP, coins and stat points, the mission done on its day (also in the summary of the day),
 * one more completion for the companion. Hit points, streaks, bonuses of the day and the linked
 * boss stay as they are. It throws for a day out of the window or a mission not missed that day.
 */
export function backfillCompletion(db: Db, input: BackfillInput): BackfillResult {
  return db.transaction((tx) => {
    const clock: ActionClock = { now: input.now, tzOffset: input.tzOffset, source: 'backfill' };
    const today = todayOf(tx, clock);
    if (!canBackfill(input.day, today)) {
      throw new RangeError(`The day cannot be corrected: ${input.day}`);
    }
    const mission = missedOn(tx, clock, input.day).find((item) => item.id === input.missionId);
    if (mission === undefined) {
      throw new RangeError(`The mission was not missed on ${input.day}: ${input.missionId}`);
    }
    return withMoments(tx, () => {
      const rewards = backfillDeltas(mission);
      const change = changeHero(tx, rewards, input.now);
      const before = missionDayOf(tx, mission.id, input.day);
      const value = mission.goalType === 'none' ? null : mission.goalTarget;
      const { event } = appendEvent(tx, {
        type: 'mission.backfilled',
        occurredAt: input.now,
        tzOffset: input.tzOffset,
        source: 'backfill',
        missionId: mission.id,
        bossId: mission.bossId,
        gameDay: input.day,
        deltas: change.deltas,
        payload: {
          value,
          before: before === undefined ? null : { status: before.status, value: before.value },
        },
      });
      recordLevelUp(tx, change, clock);
      writeMissionDay(tx, {
        missionId: mission.id,
        gameDay: input.day,
        status: 'done',
        value,
        doneAt: input.now,
        source: 'backfill',
        updatedAt: input.now,
      });
      const summary = tx
        .select()
        .from(daySummaries)
        .where(eq(daySummaries.gameDay, input.day))
        .get();
      if (summary !== undefined) {
        tx.update(daySummaries)
          .set({ doneCount: Math.min(summary.doneCount + 1, summary.scheduledCount) })
          .where(eq(daySummaries.gameDay, input.day))
          .run();
      }
      countCompletion(tx, clock);
      if (mission.bossId !== null && rewards.bossDamage > 0) {
        damageBoss(tx, mission.bossId, rewards.bossDamage, clock);
      }
      return { eventId: event.id, xp: change.deltas.xp, coins: change.deltas.coins };
    });
  });
}
