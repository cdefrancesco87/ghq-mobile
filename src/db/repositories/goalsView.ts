import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import { DIFFICULTY_VALUES } from '../../rules/config';
import type { GameDay } from '../../rules/types';
import { boss, bossSteps, events, missions } from '../schema';
import type { Db } from '../types';
import { listActiveBosses, withSteps, type Boss, type BossProgress } from './boss';
import { notDeleted } from './events';
import type { Mission } from './missions';
import { gameDayOf, getSetting } from './settings';
import { listTrophies, type Trophy } from './trophies';

// What Obiettivi and the creation of a boss show (design-sezioni.md 5.1, 5.2). It only reads.

export interface ArchivedGoal extends BossProgress {
  /** The game day of the archiving. */
  readonly archivedDay: GameDay;
}

export interface GoalsView {
  readonly day: GameDay;
  /** The active bosses, from the oldest: at most 3, the quest of the first launch included. */
  readonly active: readonly BossProgress[];
  /** The archived bosses, from the most recent (gap L16: a list to read, nothing to resume). */
  readonly archived: readonly ArchivedGoal[];
  /** The defeated bosses, from the most recent victory (design-sezioni.md 5.7). */
  readonly trophies: readonly Trophy[];
}

export interface LinkableMission {
  readonly mission: Mission;
  /** Damage of one completion to the linked boss. */
  readonly damage: number;
  /** The boss the mission hits now, if any: choosing it moves the mission. */
  readonly boss: Boss | null;
}

export function getGoalsView(db: Db, clock: { now: number; tzOffset: number }): GoalsView {
  const dayChange = getSetting(db, 'day_change');
  const archivedBosses = db
    .select()
    .from(boss)
    .where(eq(boss.status, 'archived'))
    .orderBy(desc(boss.updatedAt))
    .all();
  const archivedEvents =
    archivedBosses.length === 0
      ? []
      : db
          .select()
          .from(events)
          .where(
            and(
              eq(events.type, 'boss.archived'),
              inArray(
                events.bossId,
                archivedBosses.map((item) => item.id),
              ),
            ),
          )
          .orderBy(asc(events.seq))
          .all();
  const archived = withSteps(db, archivedBosses).map((item) => {
    // The last archiving counts; without its event, the last change of the boss.
    const event = archivedEvents.findLast((row) => row.bossId === item.boss.id);
    const archivedDay =
      event === undefined
        ? gameDayOf(item.boss.updatedAt, clock.tzOffset, dayChange)
        : gameDayOf(event.occurredAt, event.tzOffset, dayChange);
    return { ...item, archivedDay };
  });
  return {
    day: gameDayOf(clock.now, clock.tzOffset, dayChange),
    active: withSteps(db, listActiveBosses(db)),
    // Same day: the order of the last change stays (the sort is stable).
    archived: archived.sort((a, b) => b.archivedDay.localeCompare(a.archivedDay)),
    trophies: listTrophies(db, clock),
  };
}

/**
 * «Missioni collegate» of a new boss (design-sezioni.md 5.2): the habits that are not archived,
 * paused ones included, in the order of Habits, with the damage of a completion and the boss
 * they already hit.
 */
export function listLinkableMissions(db: Db): LinkableMission[] {
  const habits = db
    .select()
    .from(missions)
    .where(and(eq(missions.kind, 'habit'), ne(missions.status, 'archived'), notDeleted(missions)))
    .orderBy(asc(missions.sortOrder), asc(missions.createdAt))
    .all();
  const bosses = listActiveBosses(db);
  return habits.map((mission) => ({
    mission,
    damage: DIFFICULTY_VALUES[mission.difficulty].bossDamage,
    boss: bosses.find((item) => item.id === mission.bossId) ?? null,
  }));
}

export interface BossEditStep {
  readonly id: string;
  readonly title: string;
  readonly done: boolean;
}

/** What «Modifica» of a boss starts from (design-sezioni.md 5.3): an active boss only. */
export interface BossEditView {
  readonly boss: Boss;
  /** The steps in their order. */
  readonly steps: readonly BossEditStep[];
  /** Every mission that hits the boss, archived ones included. */
  readonly missionIds: readonly string[];
}

/** The boss to change, null when it is not active: only an active boss can be changed. */
export function getBossEdit(db: Db, bossId: string): BossEditView | null {
  const target = db.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status !== 'active') {
    return null;
  }
  const steps = db
    .select()
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all();
  const linked = db
    .select({ id: missions.id })
    .from(missions)
    .where(and(eq(missions.bossId, bossId), notDeleted(missions)))
    .all();
  return {
    boss: target,
    steps: steps.map((step) => ({ id: step.id, title: step.title, done: step.doneAt !== null })),
    missionIds: linked.map((row) => row.id),
  };
}
