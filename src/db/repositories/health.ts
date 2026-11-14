import { and, count, eq, isNotNull, ne } from 'drizzle-orm';

import { healthAmount, type HealthMetric } from '../../rules/health';
import type { GameDay } from '../../rules/types';
import { events, missions } from '../schema';
import type { Db } from '../types';
import { missionDayOf, progressMission, type CompletionResult } from './completion';
import { notDeleted } from './events';
import { listTodayMissions } from './missions';
import { dayChangeOn, gameDayOf, getSetting } from './settings';

// The missions linked to Apple Salute or Health Connect (design-sezioni.md 12.7): which ones to
// read, and the reading written as a progress with the source «health».

export interface HealthClock {
  /** UTC instant in milliseconds. */
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

export interface HealthMissionToRead {
  readonly missionId: string;
  readonly metric: HealthMetric;
  readonly day: GameDay;
  /** Local `HH:MM` when that game day started. */
  readonly dayChange: string;
  /** The value already reached today. */
  readonly value: number;
  readonly name: string;
  readonly target: number;
  readonly unit: string;
}

/** Some mission not archived is linked: the background task is needed. */
export function hasHealthMissions(db: Db): boolean {
  return (
    db
      .select({ id: missions.id })
      .from(missions)
      .where(
        and(
          notDeleted(missions),
          ne(missions.status, 'archived'),
          isNotNull(missions.healthMetric),
        ),
      )
      .get() !== undefined
  );
}

/** The linked missions due today and still to do (not done, not skipped). */
export function healthMissionsToRead(db: Db, clock: HealthClock): HealthMissionToRead[] {
  const setting = getSetting(db, 'day_change');
  const day = gameDayOf(clock.now, clock.tzOffset, setting);
  return listTodayMissions(db, day).flatMap((mission) => {
    if (mission.healthMetric === null) {
      return [];
    }
    const row = missionDayOf(db, mission.id, day);
    if (row?.status === 'done' || row?.status === 'skipped') {
      return [];
    }
    return [
      {
        missionId: mission.id,
        metric: mission.healthMetric,
        day,
        dayChange: dayChangeOn(setting, day),
        value: row?.value ?? 0,
        name: mission.name,
        target: mission.goalTarget ?? 0,
        unit: mission.goalUnit ?? '',
      },
    ];
  });
}

export interface HealthValueInput extends HealthClock {
  readonly missionId: string;
  /** The value read for today, already in the unit of the goal (`healthValue`). */
  readonly value: number;
  /** The game day of the reading: a reading of a day already closed changes nothing. */
  readonly day?: GameDay;
}

/**
 * Brings a linked mission to the value read: only the difference is added, and the goal reached
 * completes it once (`progressMission`). The key names mission, day, value and the events of the
 * mission that day, so the same reading from the app and the background task counts once, and
 * again after an undo. Null when nothing changes: a reading not higher than the value of the
 * day, a mission done or skipped today.
 */
export function recordHealthValue(db: Db, input: HealthValueInput): CompletionResult | null {
  const day = gameDayOf(input.now, input.tzOffset, getSetting(db, 'day_change'));
  if (input.day !== undefined && input.day !== day) {
    return null;
  }
  const mission = listTodayMissions(db, day).find((item) => item.id === input.missionId);
  if (mission === undefined || mission.healthMetric === null) {
    throw new RangeError(`The mission is not linked to the health data today: ${input.missionId}`);
  }
  const row = missionDayOf(db, mission.id, day);
  if (row?.status === 'done' || row?.status === 'skipped') {
    return null;
  }
  const amount = healthAmount(row?.value ?? 0, input.value);
  if (amount <= 0) {
    return null;
  }
  // The events of the mission on the day so far: an undo adds one, so a reading equal to one
  // already used before the undo gets a new key, while the same reading twice keeps it.
  const written =
    db
      .select({ value: count() })
      .from(events)
      .where(and(eq(events.missionId, mission.id), eq(events.gameDay, day)))
      .get()?.value ?? 0;
  const result = progressMission(db, {
    missionId: mission.id,
    amount,
    source: 'health',
    idemKey: `health:${mission.id}|${day}|${input.value}|${written}`,
    now: input.now,
    tzOffset: input.tzOffset,
  });
  return result.status === 'already_recorded' ? null : result;
}
