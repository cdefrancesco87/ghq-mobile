import { elapsedMinutes, timerEndsAt } from '../../rules/timer';
import type { GameDay } from '../../rules/types';
import type { Db } from '../types';
import { missionDayOf, progressMission, type CompletionResult } from './completion';
import { listTodayMissions, type Mission } from './missions';
import { forgetMissionTimer, gameDayOf, getSetting, writeMissionTimers } from './settings';

// The timers of the duration missions (design-sezioni.md 2.5; backlog T79). A running timer is
// only the instant of its start, kept in the settings, so it survives the closing of the app;
// a pause saves the minutes counted in the value of the day, like an increment of a quantity
// goal, and the end completes the mission. Starting a timer is not a game action: it writes no
// event. A timer belongs to its game day: on another day it is forgotten, with nothing saved.

export interface TimerClock {
  /** UTC instant in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

export interface TimerInput extends TimerClock {
  readonly missionId: string;
}

export interface StopTimerInput extends TimerInput {
  /** The same key never counts twice. */
  readonly idemKey?: string | null;
}

function todayOf(db: Db, { now, tzOffset }: TimerClock): GameDay {
  return gameDayOf(now, tzOffset, getSetting(db, 'day_change'));
}

/** The timers running on `day`: the instant of the start by mission id. */
export function timersOn(db: Db, day: GameDay): Map<string, number> {
  const timers = new Map<string, number>();
  for (const [missionId, timer] of Object.entries(getSetting(db, 'mission_timers'))) {
    if (timer.game_day === day) {
      timers.set(missionId, timer.started_at);
    }
  }
  return timers;
}

/** Writes the timers of `day` only: those of other days are forgotten at every write. */
function saveTimers(db: Db, day: GameDay, timers: ReadonlyMap<string, number>, now: number): void {
  writeMissionTimers(
    db,
    Object.fromEntries(
      [...timers].map(([missionId, startedAt]) => [
        missionId,
        { game_day: day, started_at: startedAt },
      ]),
    ),
    now,
  );
}

/** A duration mission due today and still to do, or null. */
function timedMission(db: Db, missionId: string, day: GameDay) {
  const mission = listTodayMissions(db, day).find((candidate) => candidate.id === missionId);
  if (
    mission === undefined ||
    mission.goalType !== 'duration' ||
    mission.goalTarget === null ||
    mission.goalTarget <= 0
  ) {
    return null;
  }
  const row = missionDayOf(db, missionId, day);
  if (row?.status === 'done' || row?.status === 'skipped') {
    return null;
  }
  return { mission: mission as Mission & { goalTarget: number }, value: row?.value ?? 0 };
}

/**
 * The play of a duration mission (design 2.5): the timer starts now, or keeps the start it has
 * when it is already running. It gives the instant of the end, for the notification. It throws for
 * a mission without a duration goal, not due today, done or skipped.
 */
export function startTimer(db: Db, input: TimerInput): { endsAt: number } {
  return db.transaction((tx) => {
    const day = todayOf(tx, input);
    const timed = timedMission(tx, input.missionId, day);
    if (timed === null) {
      throw new RangeError(`The mission has no timer to start today: ${input.missionId}`);
    }
    const timers = timersOn(tx, day);
    const startedAt = timers.get(input.missionId) ?? input.now;
    timers.set(input.missionId, startedAt);
    saveTimers(tx, day, timers, input.now);
    return {
      endsAt: timerEndsAt({ startedAt, target: timed.mission.goalTarget, value: timed.value }),
    };
  });
}

/**
 * Stops the timer of a mission: the minutes counted are added to the value of the day, at most
 * those missing from the target, so a timer reaching the end completes the mission once (a pause,
 * or the end seen at the next opening of the app). Null when nothing was saved: no timer, a
 * timer of another day, a mission no longer to do, or less than the precision of the minutes.
 */
export function stopTimer(db: Db, input: StopTimerInput): CompletionResult | null {
  return db.transaction((tx) => {
    const day = todayOf(tx, input);
    const timers = timersOn(tx, day);
    const startedAt = timers.get(input.missionId);
    timers.delete(input.missionId);
    saveTimers(tx, day, timers, input.now);
    const timed = startedAt === undefined ? null : timedMission(tx, input.missionId, day);
    if (startedAt === undefined || timed === null) {
      return null;
    }
    const missing = timed.mission.goalTarget - timed.value;
    const elapsed = elapsedMinutes(startedAt, input.now);
    const amount = Math.min(elapsed, missing);
    if (amount <= 0) {
      return null;
    }
    return progressMission(tx, {
      missionId: input.missionId,
      source: 'app',
      idemKey: input.idemKey ?? null,
      now: input.now,
      tzOffset: input.tzOffset,
      amount,
    });
  });
}

/** Forgets the timer of a mission without saving its minutes (a mission skipped or completed). */
export const discardTimer = forgetMissionTimer;
