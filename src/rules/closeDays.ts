import { DIFFICULTY_VALUES, HP } from './config';
import { applyHp, hpLoss } from './day';
import { isDueToday, type DueMission } from './frequency';
import { addDays, daysBetween, weekStartOf, weekday, type Weekday } from './gameDay';
import {
  nextHeroStreak,
  nextMissionStreak,
  type DayOutcome,
  type Occurrence,
  type Streak,
} from './streak';
import type { Difficulty, GameDay, GameMode } from './types';

// Closing the game days (modello-dati.md 3.7 and 5; analisi-funzionale.md, «Regole di gioco»,
// «Vita» and «Serie»; CLAUDE.md, choices 3 and 8–11). Every whole day between the last closed
// day and today is closed in order; today stays open. Nothing is written here: the caller saves
// the summaries and applies the changes.

/** The fields of a mission (a row of `missions`) that the close needs. */
export interface CloseMission extends DueMission {
  readonly id: string;
  readonly difficulty: Difficulty;
  /** Game day the mission was created: it does not count on the days before. */
  readonly createdDay: GameDay;
  readonly streak: number;
  readonly streakBest: number;
}

/** A row of `mission_days`. */
export interface CloseMissionDay {
  readonly missionId: string;
  readonly gameDay: GameDay;
  readonly status: 'done' | 'partial' | 'skipped';
}

export interface CloseHero {
  readonly hp: number;
  readonly streak: number;
  readonly streakBest: number;
  /** Game day on which the hero is exhausted (half XP). */
  readonly exhaustedDay: GameDay | null;
}

export interface CloseInventory {
  /** Streak shields owned. */
  readonly shields: number;
}

export interface CloseSettings {
  readonly gameMode: GameMode;
  readonly weekStart: Weekday;
  readonly restDays: readonly Weekday[];
}

/** Days on which the day bonuses were given (and not undone), from the event log. */
export interface CloseBonuses {
  readonly fullDays: readonly GameDay[];
  readonly planDays: readonly GameDay[];
}

export interface CloseDaysInput {
  /** Last day with a row in `day_summaries`. */
  readonly lastClosedDay: GameDay;
  /** Today's game day: it is not closed. */
  readonly today: GameDay;
  readonly missions: readonly CloseMission[];
  readonly missionDays: readonly CloseMissionDay[];
  readonly hero: CloseHero;
  readonly inventory: CloseInventory;
  readonly settings: CloseSettings;
  readonly bonuses?: CloseBonuses;
}

/** A row of `day_summaries`, without `closed_at`. */
export interface DaySummary {
  readonly gameDay: GameDay;
  readonly scheduledCount: number;
  readonly doneCount: number;
  readonly scheduledXp: number;
  readonly missedXp: number;
  readonly hpLost: number;
  readonly isRestDay: boolean;
  readonly fullDay: boolean;
  readonly planComplete: boolean;
  readonly shieldUsed: boolean;
}

export interface MissionStreakChange {
  readonly missionId: string;
  readonly streak: number;
  readonly best: number;
}

export interface ClosedDay {
  readonly summary: DaySummary;
  /** Hit points really changed at the close: the loss, or the return to 13 after exhaustion. */
  readonly hpDelta: number;
  /** Hit points reached 0: the hero is exhausted on the next day. */
  readonly exhaustedNextDay: boolean;
  readonly heroStreak: Streak;
  /** Mission streaks changed by this close. */
  readonly missionStreaks: readonly MissionStreakChange[];
}

export interface CloseDaysResult {
  readonly days: readonly ClosedDay[];
  /** The hero after the last closed day. */
  readonly hero: CloseHero;
  readonly inventory: CloseInventory;
  /** Final streak of every mission changed, in the order of the input. */
  readonly missionStreaks: readonly MissionStreakChange[];
}

/** How one mission ends a day: its occurrences done and missed, and its streak change. */
interface MissionResult {
  readonly mission: CloseMission;
  readonly done: number;
  readonly missed: number;
  /** Null when the close does not touch the streak of the mission. */
  readonly occurrence: Occurrence | null;
}

function isActiveOn(mission: CloseMission, day: GameDay): boolean {
  if (mission.deletedAt !== null || mission.status === 'archived' || mission.createdDay > day) {
    return false;
  }
  return !(
    mission.status === 'paused' &&
    (mission.pausedUntil === null || day < mission.pausedUntil)
  );
}

function missionResult(
  mission: CloseMission,
  day: GameDay,
  rows: readonly CloseMissionDay[],
  weekStart: Weekday,
): MissionResult | null {
  if (!isActiveOn(mission, day)) {
    return null;
  }
  const completedDays = rows.filter((row) => row.status === 'done').map((row) => row.gameDay);
  const status = rows.find((row) => row.gameDay === day)?.status;
  const doneToday = status === 'done';
  const frequency = mission.frequency;

  // «N volte a settimana» (choices 9, 15, 16, 17): judged on the last day of the week.
  if (frequency?.type === 'times_per_week') {
    const start = weekStartOf(day, weekStart);
    if (addDays(start, 6) !== day) {
      return doneToday ? { mission, done: 1, missed: 0, occurrence: null } : null;
    }
    // The first partial week starts after the week boundary (choice 16).
    const isFirstPartialWeek = mission.createdDay > start;
    const rangeStart: GameDay = isFirstPartialWeek ? mission.createdDay : start;

    const doneInWeek = new Set(completedDays.filter((d) => d >= rangeStart && d <= day)).size;
    // Each skip in the week reduces the required count by 1, minimum 0 (choice 17).
    const skipsInWeek = rows.filter(
      (row) => row.status === 'skipped' && row.gameDay >= rangeStart && row.gameDay <= day,
    ).length;
    const effectiveTimes = Math.max(0, frequency.times - skipsInWeek);

    if (isFirstPartialWeek) {
      // No HP loss in the first partial week; streak grows only if N is reached (choice 16).
      return {
        mission,
        done: doneToday ? 1 : 0,
        missed: 0,
        occurrence: doneInWeek >= effectiveTimes ? 'done' : null,
      };
    }

    const missed = Math.max(0, effectiveTimes - doneInWeek);
    return {
      mission,
      done: doneToday ? 1 : 0,
      missed,
      occurrence: missed > 0 ? 'missed' : 'done',
    };
  }

  // A mission completed on the day always counts, e.g. an overdue task.
  if (doneToday) {
    return { mission, done: 1, missed: 0, occurrence: null };
  }
  if (status === 'skipped' || !isDueToday(mission, day, { weekStart, completedDays })) {
    return null;
  }
  // An overdue task stays in Oggi without penalties (choice 10); tasks have no streak.
  if (mission.kind === 'task') {
    return mission.dueDay === day ? { mission, done: 0, missed: 1, occurrence: null } : null;
  }
  return { mission, done: 0, missed: 1, occurrence: 'missed' };
}

/**
 * Closes every whole game day between `lastClosedDay` and `today`. Rest days and days without
 * missions due keep the hero streak; the first day with missions due and no completion uses a
 * shield, if any, which saves every streak of that day. Hit points reaching 0 make the hero
 * exhausted on the next day, and at the close of that day they go back to 13.
 */
export function closeDays(input: CloseDaysInput): CloseDaysResult {
  const { missions, settings } = input;
  const fullDays = new Set(input.bonuses?.fullDays);
  const planDays = new Set(input.bonuses?.planDays);
  const rowsByMission = new Map<string, CloseMissionDay[]>();
  for (const row of input.missionDays) {
    rowsByMission.set(row.missionId, [...(rowsByMission.get(row.missionId) ?? []), row]);
  }

  let hero = input.hero;
  let shields = input.inventory.shields;
  const missionStreaks = new Map<string, Streak>(
    missions.map((mission) => [mission.id, { streak: mission.streak, best: mission.streakBest }]),
  );
  const changed = new Set<string>();
  const days: ClosedDay[] = [];

  for (const day of daysBetween(input.lastClosedDay, input.today)) {
    const isRestDay = settings.restDays.includes(weekday(day));
    // On a rest day no mission is due (design 10.5), except times_per_week on the last day of the
    // week which is always evaluated even when that day is a rest day (choice 15).
    const isLastDayOfWeek = addDays(weekStartOf(day, settings.weekStart), 6) === day;
    const results = missions.flatMap((mission) => {
      if (isRestDay && !(isLastDayOfWeek && mission.frequency?.type === 'times_per_week')) {
        return [];
      }
      const result = missionResult(
        mission,
        day,
        rowsByMission.get(mission.id) ?? [],
        settings.weekStart,
      );
      return result === null ? [] : [result];
    });

    let scheduledCount = 0;
    let doneCount = 0;
    let scheduledXp = 0;
    let missedXp = 0;
    for (const { mission, done, missed } of results) {
      const xp = DIFFICULTY_VALUES[mission.difficulty].xp;
      scheduledCount += done + missed;
      doneCount += done;
      scheduledXp += (done + missed) * xp;
      missedXp += missed * xp;
    }

    // A day without missions due works as a rest day (choice 11).
    const shieldUsed = !isRestDay && scheduledCount > 0 && doneCount === 0 && shields > 0;
    let outcome: DayOutcome;
    if (isRestDay || scheduledCount === 0) {
      outcome = 'rest';
    } else if (doneCount > 0) {
      outcome = 'done';
    } else {
      outcome = shieldUsed ? 'missed_with_shield' : 'missed';
    }
    if (shieldUsed) {
      shields -= 1;
    }
    const heroStreak = nextHeroStreak({ streak: hero.streak, best: hero.streakBest }, outcome);

    const dayStreaks: MissionStreakChange[] = [];
    for (const { mission, occurrence } of results) {
      if (occurrence === null) {
        continue;
      }
      const before = missionStreaks.get(mission.id)!;
      const after = nextMissionStreak(
        before,
        occurrence === 'missed' && shieldUsed ? 'missed_with_shield' : occurrence,
      );
      if (after.streak !== before.streak || after.best !== before.best) {
        missionStreaks.set(mission.id, after);
        changed.add(mission.id);
        dayStreaks.push({ missionId: mission.id, ...after });
      }
    }

    // On a rest day the only results are the weekly evaluations of its last day: the rest protects
    // the missions on fixed days, not the debt of the week (choice 15).
    const hpLost = hpLoss({ scheduledXp, missedXp, isRestDay: false, gameMode: settings.gameMode });
    // Choice 3: the close of the exhausted day gives back 13 hit points.
    const wasExhausted = hero.exhaustedDay === day;
    const hp = wasExhausted ? HP.afterExhaustion : applyHp(hero.hp, -hpLost);
    const exhaustedNextDay = !wasExhausted && hp === 0;

    days.push({
      summary: {
        gameDay: day,
        scheduledCount,
        doneCount,
        scheduledXp,
        missedXp,
        hpLost,
        isRestDay,
        fullDay: fullDays.has(day),
        planComplete: planDays.has(day),
        shieldUsed,
      },
      hpDelta: hp - hero.hp,
      exhaustedNextDay,
      heroStreak,
      missionStreaks: dayStreaks,
    });
    hero = {
      hp,
      streak: heroStreak.streak,
      streakBest: heroStreak.best,
      exhaustedDay: exhaustedNextDay ? addDays(day, 1) : hero.exhaustedDay,
    };
  }

  return {
    days,
    hero,
    inventory: { shields },
    missionStreaks: missions
      .filter((mission) => changed.has(mission.id))
      .map((mission) => ({ missionId: mission.id, ...missionStreaks.get(mission.id)! })),
  };
}
