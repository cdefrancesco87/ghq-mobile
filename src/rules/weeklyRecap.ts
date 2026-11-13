import { WEEKLY_RECAP } from './config';
import { addDays, diffDays, weekday, type Weekday } from './gameDay';
import { eveningSummaryAt } from './notifications';
import { isPausedDay, type PauseInterval } from './pause';
import { quietHoursEnd, type QuietInterval } from './reminders';
import type { GameDay } from './types';

// The weekly recap of Statistics (analisi-funzionale.md US-STAT-04; design-sezioni.md 8.7, 10.6;
// backlog T81): only the successes of the week, at most four lines. A week covers the
// `WEEKLY_RECAP.weekDays` game days ending on the day of the recap (Sunday by default), and its
// card stays at the top of the Overview from the time of the recap to the same time a week later.

/** When the recap comes: the day of the week and the time of the Settings. */
export interface RecapTime {
  /** 1 = Monday … 7 = Sunday. */
  readonly weekday: Weekday;
  /** HH:MM. */
  readonly time: string;
}

export interface RecapClock extends RecapTime {
  /** UTC instant in milliseconds. */
  readonly now: number;
  /** The game day of `now`. */
  readonly today: GameDay;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
  /** The day change valid on a game day (HH:MM). */
  readonly dayChange: (day: GameDay) => string;
}

/** UTC instant of the recap of the week ending on `day`; a time before the day change is the
 * night after, as for the evening summary. */
export function recapAt(
  day: GameDay,
  input: Pick<RecapClock, 'time' | 'tzOffset' | 'dayChange'>,
): number {
  return eveningSummaryAt({
    day,
    time: input.time,
    dayChange: input.dayChange(day),
    tzOffset: input.tzOffset,
  });
}

/**
 * The last day of the week whose recap is shown now: the latest day of the recap whose time has
 * come. Null before the first recap of the hero, created at `firstDay`.
 */
export function recapLastDay(input: RecapClock & { readonly firstDay: GameDay }): GameDay | null {
  const { today } = input;
  let day = addDays(today, -((weekday(today) - input.weekday + 7) % 7));
  if (recapAt(day, input) > input.now) {
    day = addDays(day, -7);
  }
  return day < input.firstDay ? null : day;
}

export interface NextRecapInput extends RecapClock {
  readonly quietHours: readonly QuietInterval[];
  /** The general pause in progress or scheduled (CLAUDE.md, choice 23), or null. */
  readonly pause: PauseInterval | null;
}

/**
 * UTC instant of the next recap notification after `now`, after the end of «Non disturbare». A
 * day of general pause sends no notification (choice 23): the recap goes to the first week
 * after the pause, and none is scheduled while a pause without an end holds its day.
 */
export function nextRecapAt(input: NextRecapInput): number | null {
  const { today } = input;
  let day = addDays(today, (input.weekday - weekday(today) + 7) % 7);
  if (recapAt(day, input) <= input.now) {
    day = addDays(day, 7);
  }
  const { pause } = input;
  if (pause !== null && isPausedDay(day, [pause])) {
    if (pause.untilDay === null) {
      return null;
    }
    day = addDays(day, Math.ceil((diffDays(day, pause.untilDay) + 1) / 7) * 7);
  }
  return quietHoursEnd(recapAt(day, input), input.tzOffset, input.quietHours);
}

/** A habit in the week: its expected occurrences and those done (`completionCounts`). */
export interface RecapMission {
  readonly id: string;
  readonly name: string;
  readonly expected: number;
  readonly done: number;
}

/** A streak that went above its record in the week: the hero's (no name) or a mission's. */
export interface RecapRecord {
  readonly missionId: string | null;
  readonly name: string | null;
  /** The longest streak reached in the week. */
  readonly streak: number;
}

export interface WeeklyRecapInput {
  readonly missions: readonly RecapMission[];
  /** Hit points taken from the bosses in the week. */
  readonly bossDamage: number;
  readonly levelsGained: number;
  /** Stat points gained in the week, all the stats together. */
  readonly statPoints: number;
  readonly records: readonly RecapRecord[];
  /** The Essential mode keeps only the most constant mission and the records (design 8.11). */
  readonly essential: boolean;
}

export interface WeeklyRecap {
  /** The habit done most often in proportion, with at least one completion. */
  readonly mostConsistent: RecapMission | null;
  /** Null when no damage, and always in the Essential mode. */
  readonly bossDamage: number | null;
  /** Levels and stat points gained; null when neither. */
  readonly progress: { readonly levels: number; readonly statPoints: number } | null;
  /** The hero first, then the missions by streak. */
  readonly records: readonly RecapRecord[];
  /** The week went badly: the card closes with a line of the companion (design 8.7). */
  readonly encouragement: boolean;
}

/** The share done, -1 when nothing was expected (a done task counts 1 of 1 anyway). */
const shareOf = (mission: RecapMission) =>
  mission.expected === 0 ? -1 : mission.done / mission.expected;

/** The content of the recap: only what went well (design 8.7). */
export function weeklyRecap(input: WeeklyRecapInput): WeeklyRecap {
  let mostConsistent: RecapMission | null = null;
  for (const mission of input.missions) {
    if (mission.done <= 0) {
      continue;
    }
    if (
      mostConsistent === null ||
      shareOf(mission) > shareOf(mostConsistent) ||
      (shareOf(mission) === shareOf(mostConsistent) && mission.done > mostConsistent.done)
    ) {
      mostConsistent = mission;
    }
  }
  const levels = Math.max(0, input.levelsGained);
  const statPoints = Math.max(0, input.statPoints);
  const bossDamage = input.essential || input.bossDamage <= 0 ? null : input.bossDamage;
  const progress =
    input.essential || (levels === 0 && statPoints === 0) ? null : { levels, statPoints };
  const records = [...input.records].sort(
    (a, b) => Number(a.missionId !== null) - Number(b.missionId !== null) || b.streak - a.streak,
  );

  const expected = input.missions.reduce((sum, mission) => sum + mission.expected, 0);
  const done = input.missions.reduce((sum, mission) => sum + mission.done, 0);
  const empty =
    mostConsistent === null && bossDamage === null && progress === null && records.length === 0;
  const encouragement = empty || (expected > 0 && done / expected < WEEKLY_RECAP.goodWeekShare);

  return { mostConsistent, bossDamage, progress, records, encouragement };
}

/** The first day of the week of a recap: `weekDays` days ending on `lastDay`, not before the hero. */
export function recapFirstDay(lastDay: GameDay, heroDay: GameDay): GameDay {
  const first = addDays(lastDay, 1 - WEEKLY_RECAP.weekDays);
  return first < heroDay ? heroDay : first;
}

/**
 * The longest streak in the week, when it went above the best before the week and that best was
 * at least `WEEKLY_RECAP.recordMin`. `before` and `during` are streaks reached before and in the
 * week; null when no record was beaten.
 */
export function beatenRecord(before: readonly number[], during: readonly number[]): number | null {
  const best = Math.max(0, ...before);
  const top = Math.max(0, ...during);
  return top > best && best >= WEEKLY_RECAP.recordMin ? top : null;
}
