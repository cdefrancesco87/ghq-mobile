import { and, asc, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';

import { WEEKLY_RECAP } from '../../rules/config';
import { addDays, diffDays } from '../../rules/gameDay';
import { heroLevelFromXp } from '../../rules/level';
import { archivedWindow, completionCounts } from '../../rules/missionRate';
import { statTrend, type StatChange, type StatTrend } from '../../rules/statTrend';
import type { GameDay, StatPoints } from '../../rules/types';
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
  'event.reverted',
  'day.closed',
];

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
  const log = db
    .select({
      id: events.id,
      type: events.type,
      gameDay: events.gameDay,
      occurredAt: events.occurredAt,
      missionId: events.missionId,
      bossId: events.bossId,
      revertsId: events.revertsId,
      payload: events.payload,
    })
    .from(events)
    .where(inArray(events.type, LOG_TYPES))
    .orderBy(asc(events.seq))
    .all();
  const reverted = new Set(
    log.filter((row) => row.type === 'event.reverted').map((row) => row.revertsId),
  );
  const kept = log.filter((row) => row.type !== 'event.reverted' && !reverted.has(row.id));
  // The damage of a completion is in the `boss.damaged` of the same action: an undone completion
  // took it back (healBoss).
  const undoneHits = new Set(
    log
      .filter((row) => row.type === 'mission.completed' && reverted.has(row.id))
      .map((row) => `${row.bossId}|${row.occurredAt}`),
  );
  const changes = changesOf(db);
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
      closed.filter((row) => row.gameDay < firstDay).map(streakOf),
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

/** The XP and the stat points changed on each game day, undone events and undos included. */
function changesOf(db: Db): (StatChange & { readonly xp: number })[] {
  return db
    .select({ gameDay: events.gameDay, xp: events.dXp, stats: events.dStats })
    .from(events)
    .where(or(ne(events.dXp, 0), isNotNull(events.dStats)))
    .all()
    .map((row) => ({ gameDay: row.gameDay, xp: row.xp, stats: (row.stats ?? {}) as StatPoints }));
}

/** The level of the stats month by month (design 8.8). */
export function getStatTrend(db: Db, clock: ActionClock): StatTrend {
  const { today, heroDay } = contextOf(db, clock);
  return statTrend(changesOf(db), heroDay, today);
}
