import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';

import { COMPANION_STAGES, moodFor, type CompanionStage, type Mood } from '../../rules/companion';
import { addDays, weekday } from '../../rules/gameDay';
import { xpToNext } from '../../rules/level';
import type { GameDay } from '../../rules/types';
import {
  boss,
  bossSteps,
  companion,
  daySummaries,
  dayPlan,
  events,
  missionDays,
  missions as missionsTable,
} from '../schema';
import type { Db } from '../types';
import type { Boss } from './boss';
import { loadHero, type Hero } from './hero';
import { listTodayMissions, type Mission } from './missions';
import { gameDayOf, getSetting } from './settings';

// Everything the upper part of Today shows, read with one call (T39; design-sezioni.md 2.1–2.8).
// It only reads: the actions stay in the other repositories.

export type TodayMissionState = 'todo' | 'done' | 'skipped';

export interface TodayMission {
  readonly mission: Mission;
  /** A measurable mission partly done is still `todo`, with its `value`. */
  readonly state: TodayMissionState;
  /** UTC instant of the completion, for a done mission. */
  readonly doneAt: number | null;
  /** Value reached today by a measurable mission. */
  readonly value: number | null;
  /** A task due before today and not done yet («Scaduta», CLAUDE.md choice 10). */
  readonly overdue: boolean;
}

export interface TodayBoss {
  readonly boss: Boss;
  readonly stepsDone: number;
  readonly stepsTotal: number;
  readonly nextStep: { readonly id: string; readonly title: string } | null;
}

export interface TodayNotices {
  /** The hero has half XP today (CLAUDE.md, choice 3). */
  readonly exhausted: boolean;
  /** A shield saved the streak at the close of yesterday. */
  readonly shieldUsedYesterday: boolean;
  /** Coins stolen today by bosses whose deadline has passed. */
  readonly coinsStolen: readonly {
    readonly bossId: string;
    readonly bossName: string;
    readonly coins: number;
  }[];
  /** The stage the companion reached today, if it grew. */
  readonly companionGrewTo: CompanionStage | null;
  /** Missions whose pause ended today. */
  readonly resumedMissionIds: readonly string[];
}

export interface TodayView {
  readonly day: GameDay;
  readonly restDay: boolean;
  readonly hero: Hero;
  /** XP needed from the start of the current level to the next one. */
  readonly xpToNext: number;
  readonly companion: {
    readonly stage: CompanionStage;
    /** Null means the default name of the theme. */
    readonly name: string | null;
    readonly mood: Mood;
  };
  /** In the order of `listTodayMissions`. */
  readonly missions: readonly TodayMission[];
  /** Ids of the priorities of the day, in their order. */
  readonly plan: readonly string[];
  /** Active bosses, the nearest deadline first and those without one last. */
  readonly bosses: readonly TodayBoss[];
  readonly doneCount: number;
  readonly totalCount: number;
  readonly notices: TodayNotices;
}

function activeBosses(db: Db): TodayBoss[] {
  const active = db.select().from(boss).where(eq(boss.status, 'active')).all();
  if (active.length === 0) {
    return [];
  }
  const steps = db
    .select()
    .from(bossSteps)
    .where(
      inArray(
        bossSteps.bossId,
        active.map((item) => item.id),
      ),
    )
    .orderBy(asc(bossSteps.position))
    .all();
  return active
    .map((item) => {
      const own = steps.filter((step) => step.bossId === item.id);
      const next = own.find((step) => step.doneAt === null);
      return {
        boss: item,
        stepsDone: own.filter((step) => step.doneAt !== null).length,
        stepsTotal: own.length,
        nextStep: next === undefined ? null : { id: next.id, title: next.title },
      };
    })
    .sort((a, b) => {
      const left = a.boss.deadlineDay;
      const right = b.boss.deadlineDay;
      if (left === right) {
        return a.boss.createdAt - b.boss.createdAt;
      }
      if (left === null) {
        return 1;
      }
      if (right === null) {
        return -1;
      }
      return left < right ? -1 : 1;
    });
}

/** Events of a type on a game day; neither of these two types is ever undone. */
function eventsOfDay(db: Db, type: 'boss.deadline_missed' | 'companion.stage_up', day: GameDay) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.type, type), eq(events.gameDay, day)))
    .orderBy(asc(events.seq))
    .all();
}

function notices(db: Db, day: GameDay, exhaustedDay: GameDay | null): TodayNotices {
  const yesterday = db
    .select({ shieldUsed: daySummaries.shieldUsed })
    .from(daySummaries)
    .where(eq(daySummaries.gameDay, addDays(day, -1)))
    .get();
  const thefts = eventsOfDay(db, 'boss.deadline_missed', day);
  const robbed = thefts.length === 0 ? [] : db.select().from(boss).all();
  const growth = eventsOfDay(db, 'companion.stage_up', day).at(-1)?.payload?.to;
  return {
    exhausted: exhaustedDay === day,
    shieldUsedYesterday: yesterday?.shieldUsed ?? false,
    coinsStolen: thefts.map((event) => ({
      bossId: event.bossId ?? '',
      bossName: robbed.find((item) => item.id === event.bossId)?.name ?? '',
      coins: -event.dCoins,
    })),
    companionGrewTo: (COMPANION_STAGES as readonly unknown[]).includes(growth)
      ? (growth as CompanionStage)
      : null,
    resumedMissionIds: db
      .select({ id: missionsTable.id })
      .from(missionsTable)
      .where(and(eq(missionsTable.status, 'paused'), eq(missionsTable.pausedUntil, day)))
      .all()
      .map((row) => row.id),
  };
}

/** The data of Today for the game day of `clock` (US-OGGI-01). */
export function getTodayView(db: Db, clock: { now: number; tzOffset: number }): TodayView {
  const day = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
  const current = loadHero(db);
  const list = listTodayMissions(db, day);
  const rows =
    list.length === 0
      ? []
      : db
          .select()
          .from(missionDays)
          .where(
            and(
              eq(missionDays.gameDay, day),
              inArray(
                missionDays.missionId,
                list.map((mission) => mission.id),
              ),
            ),
          )
          .all();
  const today = list.map((mission): TodayMission => {
    const row = rows.find((item) => item.missionId === mission.id);
    const state: TodayMissionState =
      row?.status === 'done' ? 'done' : row?.status === 'skipped' ? 'skipped' : 'todo';
    return {
      mission,
      state,
      doneAt: state === 'done' ? (row?.doneAt ?? null) : null,
      value: row?.value ?? null,
      overdue:
        mission.kind === 'task' &&
        state !== 'done' &&
        mission.dueDay !== null &&
        mission.dueDay < day,
    };
  });
  const doneCount = today.filter((item) => item.state === 'done').length;
  const lastDays = db
    .select({ scheduledCount: daySummaries.scheduledCount, doneCount: daySummaries.doneCount })
    .from(daySummaries)
    .where(lt(daySummaries.gameDay, day))
    .orderBy(desc(daySummaries.gameDay))
    .limit(3)
    .all()
    .reverse();
  const pet = db.select().from(companion).get();
  return {
    day,
    restDay: getSetting(db, 'rest_days').includes(weekday(day)),
    hero: current,
    xpToNext: xpToNext(current.level),
    companion: {
      stage: pet?.stage ?? 'egg',
      name: pet?.name ?? null,
      mood: moodFor(lastDays, doneCount),
    },
    missions: today,
    plan: db
      .select({ missionId: dayPlan.missionId })
      .from(dayPlan)
      .where(eq(dayPlan.gameDay, day))
      .orderBy(asc(dayPlan.position))
      .all()
      .map((row) => row.missionId),
    bosses: activeBosses(db),
    doneCount,
    totalCount: today.length,
    notices: notices(db, day, current.exhaustedDay),
  };
}
