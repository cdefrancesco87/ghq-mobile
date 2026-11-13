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
  /** A day of general pause: it never enters the window of the mood (choice 23). */
  readonly isPaused?: boolean;
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

/** The missions of the window of the mood, for the mood card (design-sezioni.md 6.3). */
export interface MoodWindow {
  /** Closed days the window looks at. */
  readonly days: number;
  readonly scheduled: number;
  readonly done: number;
  /** Share of the missions done, in percent rounded for the text; null when none was due. */
  readonly percent: number | null;
}

/**
 * Sums the missions of the last 3 closed days, the window of the mood. The days of general pause
 * never count: the window goes back to the last 3 days not paused (choice 23).
 *
 * @param lastDays The closed days, oldest first; only the last 3 not paused count.
 */
export function moodWindowOf(lastDays: readonly DayCompletion[]): MoodWindow {
  let scheduled = 0;
  let done = 0;
  for (const day of lastDays.filter((item) => item.isPaused !== true).slice(-MOOD.windowDays)) {
    assertNonNegativeInteger(day.scheduledCount, 'Scheduled missions');
    assertNonNegativeInteger(day.doneCount, 'Done missions');
    if (day.doneCount > day.scheduledCount) {
      throw new RangeError(`Done missions (${day.doneCount}) exceed the scheduled ones`);
    }
    scheduled += day.scheduledCount;
    done += day.doneCount;
  }
  return {
    days: MOOD.windowDays,
    scheduled,
    done,
    percent: scheduled === 0 ? null : Math.round((done / scheduled) * 100),
  };
}

/**
 * Mood from today's completions and the missions of the last 3 closed days (CLAUDE.md, choice 13):
 * happy if at least one mission is done today; otherwise happy above 70%, sad below 30%, normal in
 * between (borders included) and when no mission was due in the last 3 days. The days of general
 * pause stay out of the window, so during a pause only a completion today changes it (choice 23).
 *
 * @param lastDays The closed days, oldest first; only the last 3 not paused count.
 * @param todayDoneCount Completions done in the current open day (not yet closed).
 */
export function moodFor(lastDays: readonly DayCompletion[], todayDoneCount = 0): Mood {
  const { scheduled, done } = moodWindowOf(lastDays);
  if (todayDoneCount >= 1) {
    return 'happy';
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

/** The growth bar of the companion sheet (design-sezioni.md 6.2): «87 di 150 missioni». */
export interface Growth {
  /** «stadio 2 di 3». */
  readonly stageNumber: number;
  readonly stageCount: number;
  /** Completions counted towards the next stage, never beyond its threshold. */
  readonly done: number;
  /** Completions that open the next stage; null when the companion is fully grown. */
  readonly target: number | null;
  /** Completions still missing for the next stage. */
  readonly left: number;
}

/**
 * Where the companion is on its way to the next stage. The stage is the stored one, which never
 * goes back: after an undo the count may be below the threshold already passed, so it is clamped.
 */
export function growthOf(stage: CompanionStage, completionsTotal: number): Growth {
  assertNonNegativeInteger(completionsTotal, 'Total completions');
  const index = COMPANION_STAGES.indexOf(stage);
  if (index < 0) {
    throw new RangeError(`Unknown companion stage: ${stage}`);
  }
  const base = { stageNumber: index + 1, stageCount: COMPANION_STAGES.length };
  if (stage === 'adult') {
    return { ...base, done: completionsTotal, target: null, left: 0 };
  }
  const target = stage === 'egg' ? COMPANION.puppyAtCompletions : COMPANION.adultAtCompletions;
  const done = Math.min(completionsTotal, target);
  return { ...base, done, target, left: target - done };
}

/**
 * The name shown: the one chosen by the user, or the default of the theme in use, so that a
 * default name follows the theme and a chosen one stays (design-sezioni.md 6.9).
 *
 * @param stored `companion.name`: null means the default of the theme.
 */
export function companionName(stored: string | null, themeDefault: string): string {
  return stored ?? themeDefault;
}

/**
 * The value to store for a typed name: trimmed; null, the default of the theme, when it is empty
 * or the default name itself, so that it keeps following the theme.
 */
export function storedCompanionName(typed: string, themeDefault: string): string | null {
  const name = typed.trim();
  if (name.length > COMPANION.nameMaxLength) {
    throw new RangeError(`The companion name is longer than ${COMPANION.nameMaxLength}: ${name}`);
  }
  return name === '' || name === themeDefault.trim() ? null : name;
}
