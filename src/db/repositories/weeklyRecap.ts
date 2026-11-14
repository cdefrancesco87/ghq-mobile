import {
  and,
  asc,
  between,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  lt,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { STAT_TREND, WEEKLY_RECAP } from '../../rules/config';
import { addDays, diffDays } from '../../rules/gameDay';
import { heroLevelFromXp } from '../../rules/level';
import { archivedWindow, completionCounts } from '../../rules/missionRate';
import { monthStart, statTrend, type StatChange, type StatTrend } from '../../rules/statTrend';
import { STAT_KEYS, type GameDay, type StatKey, type StatPoints } from '../../rules/types';
import {
  beatenRecord,
  recapFirstDay,
  recapLastDay,
  weeklyRecap,
  type RecapRecord,
  type WeeklyRecap,
} from '../../rules/weeklyRecap';
import { boss, companion, events, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted, type EventType } from './events';
import { loadHero, type ActionClock } from './hero';
import { dayChangeOn, gameDayOf, getSetting } from './settings';
import { rateInputsOf } from './statsView';

// The weekly recap of Statistics (analisi-funzionale.md US-STAT-04; design-sezioni.md 8.7; backlog
// T81) and the trend of the stats (8.8), read from the event log. An undone event and its undo
// never count; the bosses deleted and the missions deleted do not either.

export interface WeeklyRecapView {
  /** The first and the last game day of the week, both included. */
  readonly firstDay: GameDay;
  readonly lastDay: GameDay;
  readonly recap: WeeklyRecap;
  /** The name given to the companion, null for the one of the theme: it signs the encouragement. */
  readonly companionName: string | null;
}

const LOG_TYPES: EventType[] = [
  'mission.completed',
  'boss.damaged',
  'boss.step_done',
  'day.closed',
];

const reverts = alias(events, 'reverts');

/** Not undone: no `event.reverted` points at the row `id` (index events_reverts_idx). */
const notReverted = (db: Db, id: SQLiteColumn) =>
  notExists(
    db
      .select({ one: sql`1` })
      .from(reverts)
      .where(and(eq(reverts.revertsId, id), eq(reverts.type, 'event.reverted'))),
  );

/** The best hero streak among the day closes read, 0 when none carries one. */
const HERO_STREAK_MAX = sql<number>`coalesce(max(case when json_type(${events.payload}, '$.heroStreak') in ('integer', 'real') then json_extract(${events.payload}, '$.heroStreak') end), 0)`;

interface Context {
  readonly db: Db;
  readonly today: GameDay;
  readonly heroDay: GameDay;
}

function contextOf(db: Db, clock: ActionClock): Context {
  const dayChange = getSetting(db, 'day_change');
  return {
    db,
    today: gameDayOf(clock.now, clock.tzOffset, dayChange),
    heroDay: gameDayOf(loadHero(db).createdAt, clock.tzOffset, dayChange),
  };
}

/** The last day of the week whose recap is on the Overview now; null before the first one. */
export function currentRecapDay(db: Db, clock: ActionClock): GameDay | null {
  const { today, heroDay } = contextOf(db, clock);
  const dayChange = getSetting(db, 'day_change');
  const setting = getSetting(db, 'weekly_recap');
  return recapLastDay({
    now: clock.now,
    today,
    tzOffset: clock.tzOffset,
    // The time of a game day is read with the day change that started it, as for the evening.
    dayChange: (day) => dayChangeOn(dayChange, addDays(day, -1)),
    weekday: setting.weekday,
    time: setting.time,
    firstDay: heroDay,
  });
}

/**
 * The recaps of the weeks ending on `lastDays`, read in a few queries for all of them. A week
 * before the hero is left out.
 */
export function getWeeklyRecaps(
  db: Db,
  clock: ActionClock,
  lastDays: readonly GameDay[],
): WeeklyRecapView[] {
  const { today, heroDay } = contextOf(db, clock);
  const weeks = lastDays.filter((lastDay) => lastDay >= heroDay);
  if (weeks.length === 0) {
    return [];
  }
  const essential = getSetting(db, 'game_mode') === 'essential';
  const habits = db
    .select()
    .from(missions)
    .where(and(notDeleted(missions), eq(missions.kind, 'habit')))
    .orderBy(asc(missions.sortOrder))
    .all();
  const inputs = rateInputsOf(db, habits, clock.tzOffset);
  const names = new Map(habits.map((mission) => [mission.id, mission]));
  const deletedBosses = new Set(
    db
      .select({ id: boss.id })
      .from(boss)
      .where(eq(boss.status, 'deleted'))
      .all()
      .map((row) => row.id),
  );
  // Only the days of the recaps are read; before them, only the best hero streak counts.
  const since = weeks.map((lastDay) => recapFirstDay(lastDay, heroDay)).sort()[0];
  const until = [...weeks].sort().reverse()[0];
  const kept = db
    .select({
      type: events.type,
      gameDay: events.gameDay,
      occurredAt: events.occurredAt,
      missionId: events.missionId,
      bossId: events.bossId,
      payload: events.payload,
    })
    .from(events)
    .where(
      and(
        inArray(events.type, LOG_TYPES),
        between(events.gameDay, since, until),
        notReverted(db, events.id),
      ),
    )
    .orderBy(asc(events.seq))
    .all();
  const streakBefore =
    db
      .select({ best: HERO_STREAK_MAX })
      .from(events)
      .where(
        and(eq(events.type, 'day.closed'), lt(events.gameDay, since), notReverted(db, events.id)),
      )
      .get()?.best ?? 0;
  // The damage of a completion is in the `boss.damaged` of the same action: an undone completion
  // took it back (healBoss).
  const hitInstants = [
    ...new Set(
      kept
        .filter((row) => row.type === 'boss.damaged' && row.bossId !== null)
        .map((row) => row.occurredAt),
    ),
  ];
  const undoneHits = new Set(
    hitInstants.length === 0
      ? []
      : db
          .select({ bossId: events.bossId, occurredAt: events.occurredAt })
          .from(events)
          .where(
            and(
              eq(events.type, 'mission.completed'),
              inArray(events.occurredAt, hitInstants),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(reverts)
                  .where(and(eq(reverts.revertsId, events.id), eq(reverts.type, 'event.reverted'))),
              ),
            ),
          )
          .all()
          .map((row) => `${row.bossId}|${row.occurredAt}`),
  );
  const changes = changesOf(db, since);
  const companionName = db.select({ name: companion.name }).from(companion).get()?.name ?? null;

  return weeks.map((lastDay) => {
    const firstDay = recapFirstDay(lastDay, heroDay);
    const inWeek = (day: GameDay) => day >= firstDay && day <= lastDay;
    const windowDays = diffDays(firstDay, lastDay) + 1;

    const recapMissions = inputs.map(({ mission, archivedDay, input }) => {
      const window = { lastDay, lastDayClosed: lastDay < today, windowDays };
      const counts = completionCounts({ ...input, ...archivedWindow(window, archivedDay) });
      return { id: mission.id, name: mission.name, ...counts };
    });

    let bossDamage = 0;
    for (const row of kept) {
      if (!inWeek(row.gameDay) || row.bossId === null || deletedBosses.has(row.bossId)) {
        continue;
      }
      const dealt = typeof row.payload.dealt === 'number' ? row.payload.dealt : 0;
      if (row.type === 'boss.step_done') {
        bossDamage += dealt;
      } else if (
        row.type === 'boss.damaged' &&
        !undoneHits.has(`${row.bossId}|${row.occurredAt}`)
      ) {
        bossDamage += dealt;
      }
    }

    const records: RecapRecord[] = [];
    const closed = kept.filter((row) => row.type === 'day.closed' && row.gameDay <= lastDay);
    const streakOf = (row: (typeof kept)[number]) =>
      typeof row.payload.heroStreak === 'number' ? row.payload.heroStreak : 0;
    const heroRecord = beatenRecord(
      [streakBefore, ...closed.filter((row) => row.gameDay < firstDay).map(streakOf)],
      closed.filter((row) => inWeek(row.gameDay)).map(streakOf),
    );
    if (heroRecord !== null) {
      records.push({ missionId: null, name: null, streak: heroRecord });
    }
    // The streak of a habit by day grows at the completion (completion.ts); the weekly missions
    // count their weeks at the closing and are left out.
    const completions = new Map<string, { best: number; streaks: number[] }>();
    for (const row of kept) {
      const mission = row.missionId === null ? undefined : names.get(row.missionId);
      const before = row.payload.streakBefore as { streak: number; best: number } | undefined;
      if (
        row.type !== 'mission.completed' ||
        !inWeek(row.gameDay) ||
        mission === undefined ||
        mission.frequency?.type === 'times_per_week' ||
        before === undefined
      ) {
        continue;
      }
      const entry = completions.get(mission.id) ?? { best: before.best, streaks: [] };
      entry.streaks.push(before.streak + 1);
      completions.set(mission.id, entry);
    }
    for (const [missionId, entry] of completions) {
      const streak = beatenRecord([entry.best], entry.streaks);
      if (streak !== null) {
        records.push({ missionId, name: names.get(missionId)!.name, streak });
      }
    }

    const xpUpTo = (day: GameDay) =>
      changes.filter((change) => change.gameDay <= day).reduce((sum, change) => sum + change.xp, 0);
    const levelsGained =
      heroLevelFromXp(Math.max(0, xpUpTo(lastDay))).level -
      heroLevelFromXp(Math.max(0, xpUpTo(addDays(firstDay, -1)))).level;
    const statPoints = changes
      .filter((change) => inWeek(change.gameDay))
      .reduce(
        (sum, change) =>
          sum + Object.values(change.stats).reduce((all, value) => all + (value ?? 0), 0),
        0,
      );

    return {
      firstDay,
      lastDay,
      companionName,
      recap: weeklyRecap({
        missions: recapMissions,
        bossDamage,
        levelsGained,
        statPoints,
        records,
        essential,
      }),
    };
  });
}

/** The recap on the Overview now, or null before the first one. */
export function getCurrentWeeklyRecap(db: Db, clock: ActionClock): WeeklyRecapView | null {
  const lastDay = currentRecapDay(db, clock);
  return lastDay === null ? null : (getWeeklyRecaps(db, clock, [lastDay])[0] ?? null);
}

/** The recaps before the one on the Overview, the latest first (design 8.7: in the Registro). */
export function getPastWeeklyRecaps(db: Db, clock: ActionClock): WeeklyRecapView[] {
  const current = currentRecapDay(db, clock);
  if (current === null) {
    return [];
  }
  const lastDays = Array.from({ length: WEEKLY_RECAP.pastWeeks }, (_, index) =>
    addDays(current, -7 * (index + 1)),
  );
  return getWeeklyRecaps(db, clock, lastDays);
}

/**
 * The XP and the stat points changed on each game day from `since`, undone events and undos
 * included, summed in SQL; everything before `since` is summed into one change on the day before
 * it. Exact for every sum up to a day from the day before `since` on.
 */
function changesOf(db: Db, since: GameDay): (StatChange & { readonly xp: number })[] {
  const changed = or(ne(events.dXp, 0), isNotNull(events.dStats))!;
  const sums = {
    xp: sql<number>`coalesce(sum(${events.dXp}), 0)`,
    ...(Object.fromEntries(
      STAT_KEYS.map((stat) => [
        stat,
        sql<number>`coalesce(sum(json_extract(${events.dStats}, ${`$.${stat}`})), 0)`,
      ]),
    ) as Record<StatKey, SQL<number>>),
  };
  const toChange = (gameDay: GameDay, row: { xp: number } & Record<StatKey, number>) => ({
    gameDay,
    xp: row.xp,
    stats: Object.fromEntries(STAT_KEYS.map((stat) => [stat, row[stat]])) as StatPoints,
  });
  const before = db
    .select(sums)
    .from(events)
    .where(and(changed, lt(events.gameDay, since)))
    .get();
  const days = db
    .select({ gameDay: events.gameDay, ...sums })
    .from(events)
    .where(and(changed, gte(events.gameDay, since)))
    .groupBy(events.gameDay)
    .all();
  return [
    ...(before === undefined ? [] : [toChange(addDays(since, -1), before)]),
    ...days.map((row) => toChange(row.gameDay, row)),
  ];
}

/** The level of the stats month by month (design 8.8). */
export function getStatTrend(db: Db, clock: ActionClock): StatTrend {
  const { today, heroDay } = contextOf(db, clock);
  // The trend reads the levels at the end of the months on the chart and at the start of the
  // months of the sentence: nothing before the earliest of them.
  const since = [
    monthStart(today, STAT_TREND.chartMonths - 1),
    monthStart(today, STAT_TREND.sentenceMonths - 1),
  ].sort()[0];
  return statTrend(changesOf(db, since), heroDay, today);
}
