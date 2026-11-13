import { and, asc, eq, gte, lte } from 'drizzle-orm';

import { HEATMAP } from '../../rules/config';
import { addDays, weekStartOf } from '../../rules/gameDay';
import {
  heatmapLevel,
  heatmapWeeks,
  type HeatmapCell,
  type HeatmapLevel,
} from '../../rules/heatmap';
import { dayMark, type DayMark } from '../../rules/missionDetail';
import { completionCounts, rateOf } from '../../rules/missionRate';
import { isPausedDay } from '../../rules/pause';
import type { GameDay } from '../../rules/types';
import { daySummaries, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted } from './events';
import { loadHero, type ActionClock } from './hero';
import { listTodayMissions, type Mission } from './missions';
import { pauseIntervalsOf } from './pause';
import { gameDayOf, getSetting } from './settings';
import { rateInputsOf } from './statsView';

// The heatmap of Statistics (design-sezioni.md 8.3): the closed days from `day_summaries`, today
// from the missions of Today and `mission_days`. Skipped missions are not in the day.

export interface HeatmapWeek {
  readonly start: GameDay;
  readonly cells: readonly HeatmapCell[];
}

export interface HeatmapView {
  readonly today: GameDay;
  readonly weeks: readonly HeatmapWeek[];
  /** A closed day had missions expected: false in the first days (mockup D29). */
  readonly anyDay: boolean;
}

/** What a mission was on the day of the sheet: today a mission not done yet is `open`. */
export type HeatmapMark = Exclude<DayMark, 'off'>;

export interface HeatmapDay {
  readonly day: GameDay;
  readonly done: number;
  readonly scheduled: number;
  /** From 0 to 100 rounded down; null with no missions expected. */
  readonly rate: number | null;
  readonly level: HeatmapLevel;
  /** The missions of the day that still exist, in the order of the missions. */
  readonly missions: readonly { readonly mission: Mission; readonly mark: HeatmapMark }[];
}

function todayOf(db: Db, clock: ActionClock): GameDay {
  return gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
}

/** The missions of today without the skipped ones, and those done. */
function todayCounts(db: Db, today: GameDay) {
  const rows = db.select().from(missionDays).where(eq(missionDays.gameDay, today)).all();
  const status = new Map(rows.map((row) => [row.missionId, row.status]));
  const listed = listTodayMissions(db, today);
  const counted = listed.filter((mission) => status.get(mission.id) !== 'skipped');
  return {
    listed,
    status,
    scheduled: counted.length,
    done: counted.filter((mission) => status.get(mission.id) === 'done').length,
  };
}

/** The strip of the last 12 months, read in a few queries. */
export function getHeatmap(db: Db, clock: ActionClock): HeatmapView {
  const today = todayOf(db, clock);
  const hero = loadHero(db);
  const heroDay = gameDayOf(hero.createdAt, clock.tzOffset, getSetting(db, 'day_change'));
  const columns = heatmapWeeks(today, HEATMAP.weeks, getSetting(db, 'week_start'));
  const summaries = db
    .select({
      gameDay: daySummaries.gameDay,
      scheduled: daySummaries.scheduledCount,
      done: daySummaries.doneCount,
      paused: daySummaries.isPaused,
    })
    .from(daySummaries)
    .where(and(gte(daySummaries.gameDay, columns[0].start), lte(daySummaries.gameDay, today)))
    .all();
  const byDay = new Map(summaries.map((row) => [row.gameDay, row]));
  const now = todayCounts(db, today);
  const pausedToday = isPausedDay(today, pauseIntervalsOf(db));

  const levelOf = (day: GameDay): HeatmapLevel => {
    if (day === today) {
      return heatmapLevel(now.done, now.scheduled, pausedToday);
    }
    const summary = byDay.get(day);
    return summary === undefined
      ? null
      : heatmapLevel(summary.done, summary.scheduled, summary.paused);
  };

  return {
    today,
    weeks: columns.map(({ start, days }) => ({
      start,
      cells: days.map((day) => {
        const inRange = day >= heroDay;
        return { day, level: inRange ? levelOf(day) : null, inRange };
      }),
    })),
    anyDay: summaries.some((row) => row.scheduled > 0),
  };
}

/** The sheet of a day of the heatmap: its counts and its missions done, missed and skipped. */
export function getHeatmapDay(db: Db, clock: ActionClock, day: GameDay): HeatmapDay {
  const today = todayOf(db, clock);
  if (day === today) {
    const now = todayCounts(db, today);
    return {
      day,
      done: now.done,
      scheduled: now.scheduled,
      rate: rateOf({ expected: now.scheduled, done: now.done }),
      level: heatmapLevel(now.done, now.scheduled, isPausedDay(today, pauseIntervalsOf(db))),
      missions: now.listed.map((mission) => {
        const status = now.status.get(mission.id);
        const mark: HeatmapMark =
          status === 'done' ? 'done' : status === 'skipped' ? 'skipped' : 'open';
        return { mission, mark };
      }),
    };
  }

  const summary = db.select().from(daySummaries).where(eq(daySummaries.gameDay, day)).get();
  const done = summary?.doneCount ?? 0;
  const scheduled = summary?.scheduledCount ?? 0;
  const rows = db
    .select()
    .from(missions)
    .where(notDeleted(missions))
    .orderBy(asc(missions.sortOrder))
    .all();
  const weekStart = getSetting(db, 'week_start');
  const lastOfWeek = addDays(weekStartOf(day, weekStart), 6) === day;
  const marked = rateInputsOf(db, rows, clock.tzOffset).flatMap(
    ({ mission, archivedDay, input }) => {
      let mark = dayMark(input, day, today, archivedDay);
      // A week of «N volte a settimana» is judged on its last day (CLAUDE.md, choice 9).
      if (
        mark === 'off' &&
        lastOfWeek &&
        day < today &&
        mission.frequency?.type === 'times_per_week' &&
        (archivedDay === null || archivedDay > day)
      ) {
        const counts = completionCounts({
          ...input,
          lastDay: day,
          lastDayClosed: true,
          windowDays: 7,
        });
        if (counts.done < counts.expected) {
          mark = 'missed';
        }
      }
      return mark === 'off' || mark === 'open' ? [] : [{ mission, mark }];
    },
  );
  return {
    day,
    done,
    scheduled,
    rate: rateOf({ expected: scheduled, done }),
    level: summary === undefined ? null : heatmapLevel(done, scheduled, summary.isPaused),
    missions: marked,
  };
}
