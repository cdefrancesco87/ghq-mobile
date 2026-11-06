// Hero and mission streaks (analisi-funzionale.md, «Regole di gioco», «Serie»).

/** A streak and its record, as stored in `streak` and `streak_best`. */
export interface Streak {
  readonly streak: number;
  readonly best: number;
}

/** How a closed day ends for the hero streak. */
export const DAY_OUTCOMES = ['done', 'rest', 'missed', 'missed_with_shield'] as const;
export type DayOutcome = (typeof DAY_OUTCOMES)[number];

/** How one day ends for the streak of a mission. */
export const OCCURRENCES = [
  'done',
  'skipped',
  'missed',
  'missed_with_shield',
  'not_scheduled',
] as const;
export type Occurrence = (typeof OCCURRENCES)[number];

type Change = 'grow' | 'keep' | 'break';

/**
 * Hero streak: days in a row with at least one completion. A rest day keeps it without growing
 * it, and so does a missed day saved by a shield.
 */
const HERO_CHANGES: Record<DayOutcome, Change> = {
  done: 'grow',
  rest: 'keep',
  missed: 'break',
  missed_with_shield: 'keep',
};

/**
 * Mission streak: scheduled occurrences completed in a row. «Salta oggi» neither breaks nor
 * grows it, a shield saves it on a missed occurrence, and unscheduled days do not count.
 */
const MISSION_CHANGES: Record<Occurrence, Change> = {
  done: 'grow',
  skipped: 'keep',
  missed: 'break',
  missed_with_shield: 'keep',
  not_scheduled: 'keep',
};

function advance(state: Streak, change: Change): Streak {
  for (const value of [state.streak, state.best]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`Streaks must be non-negative integers: ${value}`);
    }
  }
  const streak = change === 'grow' ? state.streak + 1 : change === 'break' ? 0 : state.streak;
  return { streak, best: Math.max(state.best, streak) };
}

/** The hero streak after a closed day. */
export function nextHeroStreak(state: Streak, outcome: DayOutcome): Streak {
  if (!DAY_OUTCOMES.includes(outcome)) {
    throw new RangeError(`Unknown day outcome: ${outcome}`);
  }
  return advance(state, HERO_CHANGES[outcome]);
}

/** The streak of a mission after one day. */
export function nextMissionStreak(state: Streak, occurrence: Occurrence): Streak {
  if (!OCCURRENCES.includes(occurrence)) {
    throw new RangeError(`Unknown occurrence: ${occurrence}`);
  }
  return advance(state, MISSION_CHANGES[occurrence]);
}
