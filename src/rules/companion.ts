import { COMPANION, MOOD } from './config';

// The companion grows with the completions and shows a mood (analisi-funzionale.md,
// «Regole di gioco», «Compagno», and section 6). Gifts are a later feature.

/** Stages of the companion, as stored in `companion.stage`. */
export const COMPANION_STAGES = ['egg', 'baby', 'adult'] as const;
export type CompanionStage = (typeof COMPANION_STAGES)[number];

export type Mood = 'happy' | 'normal' | 'sad';

/** Missions of one closed day, from `day_summaries`. */
export interface DayCompletion {
  readonly scheduledCount: number;
  /** Missions done among the scheduled ones. */
  readonly doneCount: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer: ${value}`);
  }
}

/**
 * Stage of the companion: the egg hatches at the first completion and the baby becomes an
 * adult at 150 completions. It never goes back a stage, even when an undo lowers the count.
 *
 * @param current The stage the companion has now.
 */
export function stageFor(
  completionsTotal: number,
  current: CompanionStage = 'egg',
): CompanionStage {
  assertNonNegativeInteger(completionsTotal, 'Total completions');
  if (!COMPANION_STAGES.includes(current)) {
    throw new RangeError(`Unknown companion stage: ${current}`);
  }
  let byCount: CompanionStage = 'egg';
  if (completionsTotal >= COMPANION.adultAtCompletions) {
    byCount = 'adult';
  } else if (completionsTotal >= COMPANION.puppyAtCompletions) {
    byCount = 'baby';
  }
  return COMPANION_STAGES.indexOf(byCount) > COMPANION_STAGES.indexOf(current) ? byCount : current;
}

/**
 * Mood from today's completions and the missions of the last 3 closed days (CLAUDE.md, choice 13):
 * happy if at least one mission is done today; otherwise happy above 70%, sad below 30%, normal in
 * between (borders included) and when no mission was due in the last 3 days.
 *
 * @param lastDays The closed days, oldest first; only the last 3 count.
 * @param todayDoneCount Completions done in the current open day (not yet closed).
 */
export function moodFor(lastDays: readonly DayCompletion[], todayDoneCount = 0): Mood {
  if (todayDoneCount >= 1) {
    return 'happy';
  }
  let scheduled = 0;
  let done = 0;
  for (const day of lastDays.slice(-MOOD.windowDays)) {
    assertNonNegativeInteger(day.scheduledCount, 'Scheduled missions');
    assertNonNegativeInteger(day.doneCount, 'Done missions');
    if (day.doneCount > day.scheduledCount) {
      throw new RangeError(`Done missions (${day.doneCount}) exceed the scheduled ones`);
    }
    scheduled += day.scheduledCount;
    done += day.doneCount;
  }
  if (scheduled === 0) {
    return 'normal';
  }
  const share = done / scheduled;
  if (share > MOOD.happyAbove) {
    return 'happy';
  }
  if (share < MOOD.sadBelow) {
    return 'sad';
  }
  return 'normal';
}
