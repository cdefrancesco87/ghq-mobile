import { and, desc, eq, inArray } from 'drizzle-orm';

import { MISSION_DETAIL, STATS_SCREEN } from '../../rules/config';
import { addDays } from '../../rules/gameDay';
import {
  averageValue,
  bucketAverages,
  bucketRate,
  dayMark,
  monthBuckets,
  weekBuckets,
  type Bucket,
  type DayMark,
  type DetailInput,
} from '../../rules/missionDetail';
import { archivedWindow, completionRate } from '../../rules/missionRate';
import type { GameDay } from '../../rules/types';
import { events, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted, type EventType } from './events';
import type { ActionClock } from './hero';
import type { Mission } from './missions';
import { gameDayOf, getSetting } from './settings';
import { rateInputsOf, STATS_PERIODS, type StatsPeriod } from './statsView';

// The detail of a mission (analisi-funzionale.md US-STAT-02, design-sezioni.md 8.5): its rate
// in every period of the selector, the chart of the period, the values of a measurable mission
// and its history from the log.

export interface DayColumn {
  readonly day: GameDay;
  readonly mark: DayMark;
}

export interface RateColumn extends Bucket {
  /** From 0 to 100; null when nothing was expected in the column. */
  readonly rate: number | null;
}

export interface ValueColumn extends Bucket {
  /** The value of the day, or the average of the month; null before the mission existed. */
  readonly value: number | null;
}

/** Settimana: a mark per day; Mese and Anno: the rate by week or by month; tasks: nothing. */
export type PeriodChart =
  | { readonly kind: 'days'; readonly columns: readonly DayColumn[] }
  | { readonly kind: 'rates'; readonly columns: readonly RateColumn[] }
  | { readonly kind: 'none' };

export interface PeriodDetail {
  /** Completion in the period, like the trends of Statistics; null when nothing was expected. */
  readonly rate: number | null;
  readonly chart: PeriodChart;
  /** The values of a measurable mission: by day, by month in period Anno; null otherwise. */
  readonly values: readonly ValueColumn[] | null;
  /** The average value of the days with a value in the period, for a measurable mission. */
  readonly average: number | null;
}

export const HISTORY_TYPES = [
  'mission.completed',
  'mission.progressed',
  'mission.skipped',
  'mission.backfilled',
] as const satisfies readonly EventType[];

export interface HistoryEntry {
  readonly id: string;
  readonly type: (typeof HISTORY_TYPES)[number];
  readonly gameDay: GameDay;
  readonly xp: number;
  readonly coins: number;
  /** The value reached by a measurable mission, if any. */
  readonly value: number | null;
}

export interface MissionDetail {
  readonly mission: Mission;
  readonly today: GameDay;
  readonly periods: Readonly<Record<StatsPeriod, PeriodDetail>>;
  /**
   * The latest entries of the log of the mission, the latest first; undone ones left out, and
   * of the progress of a measurable mission only the last one of a day not completed.
   */
  readonly history: readonly HistoryEntry[];
}

/** The days from `from` to `to`, one column each. */
function dayBuckets(from: GameDay, to: GameDay): Bucket[] {
  const buckets: Bucket[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    buckets.push({ from: day, to: day });
  }
  return buckets;
}

/** The detail of a mission that is not deleted, or null. */
export function getMissionDetail(
  db: Db,
  clock: ActionClock,
  missionId: string,
): MissionDetail | null {
  const mission = db
    .select()
    .from(missions)
    .where(and(eq(missions.id, missionId), notDeleted(missions)))
    .get();
  if (mission === undefined) {
    return null;
  }
  const today = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
  const [{ archivedDay, input }] = rateInputsOf(db, [mission], clock.tzOffset);
  const detailInput: DetailInput = input;
  const measurable = mission.goalType !== 'none';
  const firstDay = (period: StatsPeriod) => addDays(today, 1 - STATS_SCREEN.periodDays[period]);

  /** A day counts for the values from the creation to the archive. */
  const valueOf = (day: GameDay): number | null => {
    if (day < input.mission.createdDay || (archivedDay !== null && day > archivedDay)) {
      return null;
    }
    return input.days.find((row) => row.gameDay === day)?.value ?? 0;
  };

  const chartOf = (period: StatsPeriod): PeriodChart => {
    if (mission.kind === 'task') {
      return { kind: 'none' };
    }
    if (period === 'week') {
      return {
        kind: 'days',
        columns: dayBuckets(firstDay('week'), today).map(({ from }) => ({
          day: from,
          mark: dayMark(detailInput, from, today, archivedDay),
        })),
      };
    }
    const buckets =
      period === 'month'
        ? weekBuckets(today, MISSION_DETAIL.monthWeeks, input.weekStart)
        : monthBuckets(today, MISSION_DETAIL.yearMonths);
    return {
      kind: 'rates',
      columns: buckets.map((bucket) => ({
        ...bucket,
        rate: bucketRate(detailInput, bucket, today, archivedDay),
      })),
    };
  };

  const valuesOf = (period: StatsPeriod): ValueColumn[] | null => {
    if (!measurable) {
      return null;
    }
    if (period === 'year') {
      const buckets = monthBuckets(today, MISSION_DETAIL.yearMonths);
      const averages = bucketAverages(detailInput, buckets);
      return buckets.map((bucket, index) => ({ ...bucket, value: averages[index] }));
    }
    return dayBuckets(firstDay(period), today).map((bucket) => ({
      ...bucket,
      value: valueOf(bucket.from),
    }));
  };

  const periodOf = (period: StatsPeriod): PeriodDetail => ({
    rate: completionRate({
      ...input,
      ...archivedWindow(
        { lastDay: today, lastDayClosed: false, windowDays: STATS_SCREEN.periodDays[period] },
        archivedDay,
      ),
    }),
    chart: chartOf(period),
    values: valuesOf(period),
    average: measurable ? averageValue(detailInput, firstDay(period), today) : null,
  });

  return {
    mission,
    today,
    periods: Object.fromEntries(
      STATS_PERIODS.map((period) => [period, periodOf(period)]),
    ) as Record<StatsPeriod, PeriodDetail>,
    history: historyOf(db, missionId),
  };
}

function historyOf(db: Db, missionId: string): HistoryEntry[] {
  const rows = db
    .select({
      id: events.id,
      type: events.type,
      gameDay: events.gameDay,
      revertsId: events.revertsId,
      dXp: events.dXp,
      dCoins: events.dCoins,
      payload: events.payload,
    })
    .from(events)
    .where(
      and(
        eq(events.missionId, missionId),
        inArray(events.type, [...HISTORY_TYPES, 'event.reverted']),
      ),
    )
    .orderBy(desc(events.seq))
    .all();
  const reverted = new Set(rows.map((row) => row.revertsId).filter((id) => id !== null));
  const kept = rows.filter(
    (row): row is typeof row & { type: HistoryEntry['type'] } =>
      row.type !== 'event.reverted' && !reverted.has(row.id),
  );
  // Every tap of a measurable mission is a progress: a day keeps only where it got to, and
  // nothing when it was completed.
  const settled = new Set(
    kept.filter((row) => row.type !== 'mission.progressed').map((row) => row.gameDay),
  );
  const progressed = new Set<GameDay>();
  return kept
    .filter((row) => {
      if (row.type !== 'mission.progressed') {
        return true;
      }
      if (settled.has(row.gameDay) || progressed.has(row.gameDay)) {
        return false;
      }
      progressed.add(row.gameDay);
      return true;
    })
    .slice(0, MISSION_DETAIL.historyMax)
    .map((row) => ({
      id: row.id,
      type: row.type,
      gameDay: row.gameDay,
      xp: row.dXp,
      coins: row.dCoins,
      value: typeof row.payload.value === 'number' ? row.payload.value : null,
    }));
}
