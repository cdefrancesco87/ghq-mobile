import { and, asc, eq, inArray, ne } from 'drizzle-orm';

import { protectedHp } from '../../rules/boss';
import { DIFFICULTY_VALUES } from '../../rules/config';
import type { GameDay } from '../../rules/types';
import { boss, bossSteps, events, missions } from '../schema';
import type { Db } from '../types';
import type { BossProgress } from './boss';
import { notDeleted } from './events';
import type { Mission } from './missions';
import { gameDayOf, getSetting } from './settings';

// What the card of a boss shows (design-sezioni.md 5.3; mockup B3b). It only reads.

export interface BossStepView {
  readonly id: string;
  readonly title: string;
  /** The game day the step was done, null while it is to do. */
  readonly doneDay: GameDay | null;
}

export interface LinkedMissionView {
  readonly mission: Mission;
  /** Damage of one completion. */
  readonly damage: number;
  /** Hit points the completions of the mission really took from this boss, undone ones out. */
  readonly dealt: number;
}

export interface BossView extends BossProgress {
  readonly day: GameDay;
  readonly steps: readonly BossStepView[];
  /** Hit points only the last step can take: the striped part of the bar. */
  readonly protectedHp: number;
  /** The habits that hit the boss, not archived, in the order of Habits. */
  readonly missions: readonly LinkedMissionView[];
  /** The game day of the victory, null while the boss is not defeated. */
  readonly defeatedDay: GameDay | null;
}

/**
 * The hit points taken by each mission. The `boss.damaged` event of a completion has no mission:
 * it comes right after its `mission.completed` event for the same boss, the same pairing as the
 * undo (undo.ts). An undone completion gives its hit points back, so it does not count.
 */
function dealtByMission(db: Db, bossId: string): Map<string, number> {
  const rows = db
    .select()
    .from(events)
    .where(
      and(eq(events.bossId, bossId), inArray(events.type, ['mission.completed', 'boss.damaged'])),
    )
    .orderBy(asc(events.seq))
    .all();
  const completions = rows.filter((row) => row.type === 'mission.completed');
  const reverted =
    completions.length === 0
      ? new Set<string>()
      : new Set(
          db
            .select({ revertsId: events.revertsId })
            .from(events)
            .where(
              and(
                eq(events.type, 'event.reverted'),
                inArray(
                  events.revertsId,
                  completions.map((row) => row.id),
                ),
              ),
            )
            .all()
            .map((row) => row.revertsId),
        );
  const dealt = new Map<string, number>();
  let completion: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (row.type === 'mission.completed') {
      completion = row;
      continue;
    }
    const points = row.payload.dealt;
    if (
      completion !== null &&
      completion.missionId !== null &&
      !reverted.has(completion.id) &&
      typeof points === 'number'
    ) {
      dealt.set(completion.missionId, (dealt.get(completion.missionId) ?? 0) + points);
    }
    completion = null;
  }
  return dealt;
}

/** The card of a boss, whatever its state; null when it does not exist or was deleted. */
export function getBossView(
  db: Db,
  bossId: string,
  clock: { now: number; tzOffset: number },
): BossView | null {
  const target = db.select().from(boss).where(eq(boss.id, bossId)).get();
  if (target === undefined || target.status === 'deleted') {
    return null;
  }
  const dayChange = getSetting(db, 'day_change');
  const rows = db
    .select()
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all();
  // Steps are written with the instant only: the day is that of the time zone of today.
  const steps = rows.map((row) => ({
    id: row.id,
    title: row.title,
    doneDay: row.doneAt === null ? null : gameDayOf(row.doneAt, clock.tzOffset, dayChange),
  }));
  const next = rows.find((row) => row.doneAt === null);
  const stepsLeft = rows.filter((row) => row.doneAt === null).length;
  const dealt = dealtByMission(db, bossId);
  const linked = db
    .select()
    .from(missions)
    .where(and(eq(missions.bossId, bossId), ne(missions.status, 'archived'), notDeleted(missions)))
    .orderBy(asc(missions.sortOrder), asc(missions.createdAt))
    .all();
  return {
    day: gameDayOf(clock.now, clock.tzOffset, dayChange),
    boss: target,
    steps,
    stepsDone: rows.length - stepsLeft,
    stepsTotal: rows.length,
    nextStep: next === undefined ? null : { id: next.id, title: next.title },
    protectedHp: target.status === 'active' ? protectedHp({ hp: target.hp, stepsLeft }) : 0,
    missions: linked.map((mission) => ({
      mission,
      damage: DIFFICULTY_VALUES[mission.difficulty].bossDamage,
      dealt: dealt.get(mission.id) ?? 0,
    })),
    defeatedDay:
      target.defeatedAt === null ? null : gameDayOf(target.defeatedAt, clock.tzOffset, dayChange),
  };
}
