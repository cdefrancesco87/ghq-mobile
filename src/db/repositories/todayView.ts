import { and, asc, desc, eq, inArray, lt } from 'drizzle-orm';

import { COMPANION_STAGES, moodFor, type CompanionStage, type Mood } from '../../rules/companion';
import { completionDeltas } from '../../rules/completion';
import { skipsLeft } from '../../rules/day';
import { addDays, weekday } from '../../rules/gameDay';
import { xpToNext } from '../../rules/level';
import type { GameDay } from '../../rules/types';
import {
  boss,
  companion,
  daySummaries,
  dayPlan,
  events,
  missionDays,
  missionReminders,
  missions as missionsTable,
} from '../schema';
import type { Db } from '../types';
import { listActiveBosses, withSteps, type BossProgress } from './boss';
import { bonusGiven, skipsThisWeek, type SkipReason } from './completion';
import { loadHero, type Hero } from './hero';
import { listTodayMissions, type Mission } from './missions';
import { gameDayOf, getSetting, weekRulesOn } from './settings';
import { notDeleted } from './events';

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
  /** `HH:MM` of the earliest reminder, the time of the mission in the list. */
  readonly time: string | null;
  /** The XP a completion gives now (streak multiplier, exhausted day). */
  readonly xp: number;
  /** The `mission.completed` event of today not undone, for «Annulla completamento». */
  readonly completionEventId: string | null;
  /** «Salta oggi» still possible this week (US-OGGI-06); a skipped mission counts its own skip. */
  readonly skipsLeft: number;
  /** Why the mission was skipped today. */
  readonly skipReason: SkipReason | null;
  /** The `mission.skipped` event of today not undone, for «Annulla salto». */
  readonly skipEventId: string | null;
}

export type TodayBoss = BossProgress;

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
  /** Missions whose pause ended today (design-sezioni.md 3.6). */
  readonly resumedMissions: readonly { readonly id: string; readonly name: string }[];
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
  /**
   * In the order of the list (design-sezioni.md 2.5): overdue tasks, then the missions with a
   * time by time, then the others in the order of `listTodayMissions`.
   */
  readonly missions: readonly TodayMission[];
  /** Ids of the priorities of the day, in their order. */
  readonly plan: readonly string[];
  /** The bonus of the plan was given today and no undo took it back (design-sezioni.md 2.3). */
  readonly planBonus: boolean;
  /** Active bosses, the nearest deadline first and those without one last. */
  readonly bosses: readonly TodayBoss[];
  /** The full-day bonus was given today and no undo took it back (design-sezioni.md 2.7). */
  readonly fullDay: boolean;
  readonly doneCount: number;
  /** Missions of today without the skipped ones, which do not count in the day (design 8.3). */
  readonly totalCount: number;
  readonly notices: TodayNotices;
}

function activeBosses(db: Db): TodayBoss[] {
  return withSteps(db, listActiveBosses(db)).sort((a, b) => {
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
    resumedMissions: db
      .select({ id: missionsTable.id, name: missionsTable.name })
      .from(missionsTable)
      .where(
        and(
          notDeleted(missionsTable),
          eq(missionsTable.status, 'paused'),
          eq(missionsTable.pausedUntil, day),
        ),
      )
      .orderBy(asc(missionsTable.sortOrder))
      .all(),
  };
}

/** The earliest reminder time of each mission. */
function missionTimes(db: Db, ids: readonly string[]): Map<string, string> {
  const times = new Map<string, string>();
  const rows = db
    .select({ missionId: missionReminders.missionId, time: missionReminders.time })
    .from(missionReminders)
    .where(inArray(missionReminders.missionId, ids))
    .all();
  for (const { missionId, time } of rows) {
    const earliest = times.get(missionId);
    if (time !== null && (earliest === undefined || time < earliest)) {
      times.set(missionId, time);
    }
  }
  return times;
}

/** The last completion, or skip, of each mission on the day that no undo has taken back. */
function missionEvents(
  db: Db,
  type: 'mission.completed' | 'mission.skipped',
  day: GameDay,
): Map<string, string> {
  const completed = db
    .select({ id: events.id, missionId: events.missionId })
    .from(events)
    .where(and(eq(events.type, type), eq(events.gameDay, day)))
    .orderBy(asc(events.seq))
    .all();
  if (completed.length === 0) {
    return new Map();
  }
  const reverted = new Set(
    db
      .select({ revertsId: events.revertsId })
      .from(events)
      .where(
        and(
          eq(events.type, 'event.reverted'),
          inArray(
            events.revertsId,
            completed.map((event) => event.id),
          ),
        ),
      )
      .all()
      .map((row) => row.revertsId),
  );
  const byMission = new Map<string, string>();
  for (const event of completed) {
    if (event.missionId !== null && !reverted.has(event.id)) {
      byMission.set(event.missionId, event.id);
    }
  }
  return byMission;
}

/** Overdue tasks first, then by time, then the missions without a time (design 2.5). */
function listOrder(a: TodayMission, b: TodayMission): number {
  if (a.overdue !== b.overdue) {
    return a.overdue ? -1 : 1;
  }
  if (a.time === b.time) {
    return 0;
  }
  if (a.time === null) {
    return 1;
  }
  if (b.time === null) {
    return -1;
  }
  return a.time < b.time ? -1 : 1;
}

/**
 * The companion on `day` with `doneCount` missions done that day: its mood follows choice 13 of
 * CLAUDE.md (a completion today, otherwise the last 3 closed days).
 */
export function companionOn(db: Db, day: GameDay, doneCount: number): TodayView['companion'] {
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
    stage: pet?.stage ?? 'egg',
    name: pet?.name ?? null,
    mood: moodFor(lastDays, doneCount),
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
  const times =
    list.length === 0
      ? new Map<string, string>()
      : missionTimes(
          db,
          list.map((m) => m.id),
        );
  const completions = missionEvents(db, 'mission.completed', day);
  const skips = missionEvents(db, 'mission.skipped', day);
  const skipped = skipsThisWeek(
    db,
    list.map((mission) => mission.id),
    day,
  );
  const today = list
    .map((mission): TodayMission => {
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
        time: times.get(mission.id) ?? null,
        xp: completionDeltas({
          difficulty: mission.difficulty,
          heroStreak: current.streak,
          exhausted: current.exhaustedDay === day,
          statPrimary: mission.statPrimary,
          statSecondary: mission.statSecondary,
        }).xp,
        completionEventId: state === 'done' ? (completions.get(mission.id) ?? null) : null,
        skipsLeft: skipsLeft(skipped.get(mission.id) ?? 0),
        skipReason: state === 'skipped' ? ((row?.skipReason as SkipReason | null) ?? null) : null,
        skipEventId: state === 'skipped' ? (skips.get(mission.id) ?? null) : null,
      };
    })
    .sort(listOrder);
  const doneCount = today.filter((item) => item.state === 'done').length;
  return {
    day,
    restDay: weekRulesOn(db, day).restDays.includes(weekday(day)),
    hero: current,
    xpToNext: xpToNext(current.level),
    companion: companionOn(db, day, doneCount),
    missions: today,
    plan: db
      .select({ missionId: dayPlan.missionId })
      .from(dayPlan)
      .where(eq(dayPlan.gameDay, day))
      .orderBy(asc(dayPlan.position))
      .all()
      .map((row) => row.missionId),
    planBonus: bonusGiven(db, 'bonus.plan', day),
    fullDay: bonusGiven(db, 'bonus.full_day', day),
    bosses: activeBosses(db),
    doneCount,
    totalCount: today.filter((item) => item.state !== 'skipped').length,
    notices: notices(db, day, current.exhaustedDay),
  };
}
