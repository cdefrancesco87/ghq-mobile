import { and, asc, eq, inArray } from 'drizzle-orm';

import { STATS_SCREEN } from '../../rules/config';
import { addDays, weekStartOf } from '../../rules/gameDay';
import type { DetailDay } from '../../rules/missionDetail';
import {
  archivedWindow,
  completionCounts,
  completionRate,
  generalPauseSpans,
  pauseSpans,
  rateOf,
  type PauseEvent,
  type RateCounts,
  type RateInput,
} from '../../rules/missionRate';
import type { GameDay } from '../../rules/types';
import { events, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted, type EventType } from './events';
import { getHeatmap, type HeatmapView } from './heatmap';
import { loadHero, type ActionClock } from './hero';
import type { Mission } from './missions';
import { pauseIntervalsOf } from './pause';
import { gameDayOf, getSetting } from './settings';

// The overview of Statistics (analisi-funzionale.md section 8, design-sezioni.md 8.2, 8.4): the
// summary 2×2 with its positive comparisons and the trend of every mission by period. Deleted
// missions never count; skipped and paused days are not expected (`completionCounts`).

export type StatsPeriod = keyof typeof STATS_SCREEN.periodDays;

export const STATS_PERIODS = Object.keys(STATS_SCREEN.periodDays) as StatsPeriod[];

export interface StatsSummary {
  /** The hero streak and its record. */
  readonly streak: number;
  readonly streakBest: number;
  /** Streak now minus the one of 7 days ago; null when it is not known. */
  readonly streakChange: number | null;
  /** Missions completed in this week, from `week_start` to today. */
  readonly weekDone: number;
  /** Against the same days of last week; null when the hero did not play then. */
  readonly weekDoneChange: number | null;
  /** Completion of the last 30 days, from 0 to 100; null when nothing was expected. */
  readonly rate: number | null;
  /** Points against the 30 days before; null when there is no rate to compare. */
  readonly rateChange: number | null;
}

export interface MissionTrend {
  readonly mission: Mission;
  /** Completion in the period, from 0 to 100; null when nothing was expected in it. */
  readonly rate: number | null;
}

export interface StatsView {
  readonly today: GameDay;
  readonly summary: StatsSummary;
  /** The active habits by period, the least constant first and those without a rate last. */
  readonly trends: Readonly<Record<StatsPeriod, readonly MissionTrend[]>>;
  /** The last 12 months by day (8.3). */
  readonly heatmap: HeatmapView;
}

const RATE_EVENTS: EventType[] = [
  'mission.created',
  'mission.paused',
  'mission.resumed',
  'mission.archived',
  'mission.deleted',
];

/** What the rate of a mission needs, but the window; the days carry their values for the charts. */
export interface MissionRateInput {
  readonly mission: Mission;
  /** The game day of the archive, for an archived mission. */
  readonly archivedDay: GameDay | null;
  readonly input: Omit<RateInput, 'lastDay' | 'days'> & { readonly days: readonly DetailDay[] };
}

/** The days, the pauses and the day of creation of the missions, read in two queries. */
export function rateInputsOf(
  db: Db,
  rows: readonly Mission[],
  tzOffset: number,
): MissionRateInput[] {
  const dayChange = getSetting(db, 'day_change');
  const weekStart = getSetting(db, 'week_start');
  const restDays = getSetting(db, 'rest_days');
  const ids = rows.map((row) => row.id);
  const days = db
    .select({
      missionId: missionDays.missionId,
      gameDay: missionDays.gameDay,
      status: missionDays.status,
      value: missionDays.value,
    })
    .from(missionDays)
    .where(inArray(missionDays.missionId, ids))
    .all();
  const log = db
    .select({
      type: events.type,
      missionId: events.missionId,
      gameDay: events.gameDay,
      payload: events.payload,
    })
    .from(events)
    .where(and(inArray(events.missionId, ids), inArray(events.type, RATE_EVENTS)))
    .orderBy(asc(events.seq))
    .all();
  // The days of a general pause are not expected, like those of a paused mission (choice 23).
  const general = generalPauseSpans(pauseIntervalsOf(db));

  return rows.map((mission) => {
    const ownLog = log.filter((event) => event.missionId === mission.id);
    const createdDay =
      ownLog.find((event) => event.type === 'mission.created')?.gameDay ??
      gameDayOf(mission.createdAt, tzOffset, dayChange);
    const archivedDay =
      mission.status === 'archived' && mission.archivedAt !== null
        ? gameDayOf(mission.archivedAt, tzOffset, dayChange)
        : null;
    return {
      mission,
      archivedDay,
      input: {
        mission: { ...mission, createdDay },
        days: days.filter((day) => day.missionId === mission.id),
        pauses: [
          ...pauseSpans(
            ownLog.map((event): PauseEvent => ({
              type: event.type,
              gameDay: event.gameDay,
              until: (event.payload.until as GameDay | null | undefined) ?? null,
            })),
          ),
          ...general,
        ],
        restDays,
        weekStart,
      },
    };
  });
}

const NO_COUNTS: RateCounts = { expected: 0, done: 0 };

function add(a: RateCounts, b: RateCounts): RateCounts {
  return { expected: a.expected + b.expected, done: a.done + b.done };
}

/** The overview of Statistics, read in a few queries. */
export function getStatsView(db: Db, clock: ActionClock): StatsView {
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(clock.now, clock.tzOffset, dayChange);
  const weekStart = getSetting(db, 'week_start');
  const hero = loadHero(db);
  const heroDay = gameDayOf(hero.createdAt, clock.tzOffset, dayChange);

  const rows = db
    .select()
    .from(missions)
    .where(notDeleted(missions))
    .orderBy(asc(missions.sortOrder))
    .all();
  const inputs = rateInputsOf(db, rows, clock.tzOffset);
  const days = inputs.flatMap(({ input }) => input.days);

  /** All the missions together, over the 30 days ending on `lastDay`. */
  const totalRate = (lastDay: GameDay, lastDayClosed: boolean) => {
    let sum = NO_COUNTS;
    for (const { archivedDay, input } of inputs) {
      const window = { lastDay, lastDayClosed, windowDays: STATS_SCREEN.rateWindowDays };
      sum = add(sum, completionCounts({ ...input, ...archivedWindow(window, archivedDay) }));
    }
    return rateOf(sum);
  };
  const rate = totalRate(today, false);
  const previousRate = totalRate(addDays(today, -STATS_SCREEN.rateWindowDays), true);

  const thisWeek = weekStartOf(today, weekStart);
  const lastWeek = addDays(thisWeek, -7);
  const doneBetween = (from: GameDay, to: GameDay) =>
    days.filter((day) => day.status === 'done' && day.gameDay >= from && day.gameDay <= to).length;
  const weekDone = doneBetween(thisWeek, today);
  const weekDoneChange =
    heroDay < thisWeek ? weekDone - doneBetween(lastWeek, addDays(today, -7)) : null;

  const trendsFor = (period: StatsPeriod): MissionTrend[] =>
    inputs
      .filter(({ mission }) => mission.kind === 'habit' && mission.status !== 'archived')
      .map(({ mission, input }) => ({
        mission,
        rate: completionRate({
          ...input,
          lastDay: today,
          windowDays: STATS_SCREEN.periodDays[period],
        }),
      }))
      // Stable: equal rates keep the order of the missions.
      .sort((a, b) => (a.rate ?? Infinity) - (b.rate ?? Infinity));

  return {
    today,
    summary: {
      streak: hero.streak,
      streakBest: hero.streakBest,
      streakChange: streakChange(db, today, hero.streak),
      weekDone,
      weekDoneChange,
      rate,
      rateChange: rate !== null && previousRate !== null ? rate - previousRate : null,
    },
    trends: Object.fromEntries(
      STATS_PERIODS.map((period) => [period, trendsFor(period)]),
    ) as Record<StatsPeriod, MissionTrend[]>,
    heatmap: getHeatmap(db, clock),
  };
}

/**
 * The hero streak now (closed up to yesterday) minus the one closed 7 days earlier, from the
 * `day.closed` events; null when that day was never closed.
 */
function streakChange(db: Db, today: GameDay, streak: number): number | null {
  const then = addDays(today, -1 - STATS_SCREEN.streakCompareDays);
  const closed = db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.type, 'day.closed'), eq(events.gameDay, then)))
    .get();
  const before = closed?.payload.heroStreak;
  return typeof before === 'number' ? streak - before : null;
}
