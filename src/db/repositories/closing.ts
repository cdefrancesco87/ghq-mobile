import { and, desc, eq, gt, gte, inArray, like, lt, or } from 'drizzle-orm';

import { closeDays, type CloseMission, type DaySummary } from '../../rules/closeDays';
import { addDays, weekStartOf } from '../../rules/gameDay';
import type { GameDay } from '../../rules/types';
import { daySummaries, events, hero, inventory, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { changeHero, loadHero, type ActionClock } from './hero';
import { gameDayOf, getSetting, pendingWeekRules, promoteWeekRules } from './settings';

// The day change (modello-dati.md 3.7 and 5): every whole game day not closed yet is closed by
// closeDays (src/rules/closeDays.ts) and saved here, in one transaction. A day with a row in
// `day_summaries` is never closed again, so the closing can run at every start of the app.

const SYSTEM = 'system' as const;

/** The game day of the first event of a type, e.g. the creation of the hero or of a mission. */
function creationDays(tx: Db, type: 'hero.created' | 'mission.created'): Map<string, GameDay> {
  const rows = tx
    .select({ missionId: events.missionId, gameDay: events.gameDay })
    .from(events)
    .where(eq(events.type, type))
    .all();
  const days = new Map<string, GameDay>();
  for (const row of rows) {
    const key = row.missionId ?? type;
    if (!days.has(key)) {
      days.set(key, row.gameDay);
    }
  }
  return days;
}

/** The last closed day, or the day before the first launch when no day was closed yet. */
function lastClosedDay(tx: Db): GameDay | null {
  const last = tx
    .select({ gameDay: daySummaries.gameDay })
    .from(daySummaries)
    .orderBy(desc(daySummaries.gameDay))
    .get();
  if (last !== undefined) {
    return last.gameDay;
  }
  const firstDay = creationDays(tx, 'hero.created').get('hero.created');
  return firstDay === undefined ? null : addDays(firstDay, -1);
}

/** Days of the bonuses given and not undone, after `from` and before `to`. */
function bonusDays(tx: Db, from: GameDay, to: GameDay) {
  const given = tx
    .select({ id: events.id, type: events.type, gameDay: events.gameDay })
    .from(events)
    .where(and(like(events.type, 'bonus.%'), gt(events.gameDay, from), lt(events.gameDay, to)))
    .all();
  const reverted = new Set(
    tx
      .select({ revertsId: events.revertsId })
      .from(events)
      .where(
        and(
          eq(events.type, 'event.reverted'),
          inArray(
            events.revertsId,
            given.map((row) => row.id),
          ),
        ),
      )
      .all()
      .map((row) => row.revertsId),
  );
  const kept = given.filter((row) => !reverted.has(row.id));
  return {
    fullDays: kept.filter((row) => row.type === 'bonus.full_day').map((row) => row.gameDay),
    planDays: kept.filter((row) => row.type === 'bonus.plan').map((row) => row.gameDay),
  };
}

/**
 * Closes every whole game day between the last closed day and today (today stays open): it
 * writes `day_summaries`, the `day.closed` events with the hit points lost, `shield.consumed`
 * and `hero.exhausted`, and saves the hero, the shields and the streaks. Running it again
 * changes nothing. Returns the summaries of the days closed now.
 */
export function closePendingDays(db: Db, clock: ActionClock): DaySummary[] {
  return db.transaction((tx) => {
    const today = gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
    // A change of the week rules counts from its day: the days before it close with the old
    // rules, then the change is put in force for the days after it.
    const pending = pendingWeekRules(tx);
    const before =
      pending !== null && pending.from_day <= today ? closeUntil(tx, clock, pending.from_day) : [];
    promoteWeekRules(tx, today, clock.now);
    return [...before, ...closeUntil(tx, clock, today)];
  });
}

/** Closes the days before `today` not closed yet, with the week rules in force. */
function closeUntil(tx: Db, clock: ActionClock, today: GameDay): DaySummary[] {
  const lastClosed = lastClosedDay(tx);
  if (lastClosed === null || addDays(lastClosed, 1) >= today) {
    return [];
  }
  const settings = {
    gameMode: getSetting(tx, 'game_mode'),
    weekStart: getSetting(tx, 'week_start'),
    restDays: getSetting(tx, 'rest_days'),
  };
  const created = creationDays(tx, 'mission.created');
  const rows = tx.select().from(missions).all();
  const closeMissions: CloseMission[] = rows.map((mission) => ({
    ...mission,
    createdDay:
      created.get(mission.id) ??
      gameDayOf(mission.createdAt, clock.tzOffset, getSetting(tx, 'day_change')),
  }));
  // The days that can still matter: the weeks of the days to close for the habits counted per
  // week, every completion for the tasks.
  const taskIds = rows.filter((mission) => mission.kind === 'task').map((mission) => mission.id);
  const days = tx
    .select({
      missionId: missionDays.missionId,
      gameDay: missionDays.gameDay,
      status: missionDays.status,
    })
    .from(missionDays)
    .where(
      and(
        lt(missionDays.gameDay, today),
        or(
          gte(missionDays.gameDay, weekStartOf(addDays(lastClosed, 1), settings.weekStart)),
          inArray(missionDays.missionId, taskIds),
        ),
      ),
    )
    .all();
  const current = loadHero(tx);
  const shields =
    tx.select().from(inventory).where(eq(inventory.itemKey, 'shield')).get()?.quantity ?? 0;

  const result = closeDays({
    lastClosedDay: lastClosed,
    today,
    missions: closeMissions,
    missionDays: days,
    hero: current,
    inventory: { shields },
    settings,
    bonuses: bonusDays(tx, lastClosed, today),
  });

  const base = { occurredAt: clock.now, tzOffset: clock.tzOffset, source: SYSTEM } as const;
  for (const day of result.days) {
    const { gameDay } = day.summary;
    tx.insert(daySummaries)
      .values({ ...day.summary, closedAt: clock.now })
      .run();
    const change = changeHero(tx, { hp: day.hpDelta }, clock.now);
    appendEvent(tx, {
      ...base,
      type: 'day.closed',
      gameDay,
      idemKey: `day.closed:${gameDay}`,
      deltas: change.deltas,
      payload: {
        scheduledCount: day.summary.scheduledCount,
        doneCount: day.summary.doneCount,
        missedXp: day.summary.missedXp,
        hpLost: day.summary.hpLost,
        heroStreak: day.heroStreak.streak,
      },
    });
    if (day.summary.shieldUsed) {
      appendEvent(tx, { ...base, type: 'shield.consumed', gameDay, itemKey: 'shield' });
    }
    if (day.exhaustedNextDay) {
      appendEvent(tx, {
        ...base,
        type: 'hero.exhausted',
        gameDay,
        payload: { exhaustedDay: addDays(gameDay, 1) },
      });
    }
  }

  tx.update(hero)
    .set({
      streak: result.hero.streak,
      streakBest: result.hero.streakBest,
      exhaustedDay: result.hero.exhaustedDay,
      updatedAt: clock.now,
    })
    .where(eq(hero.id, current.id))
    .run();
  if (result.inventory.shields !== shields) {
    tx.update(inventory)
      .set({ quantity: result.inventory.shields })
      .where(eq(inventory.itemKey, 'shield'))
      .run();
  }
  for (const change of result.missionStreaks) {
    tx.update(missions)
      .set({ streak: change.streak, streakBest: change.best })
      .where(eq(missions.id, change.missionId))
      .run();
  }
  return result.days.map((day) => day.summary);
}
