import { TALE } from './config';
import { diffDays } from './gameDay';
import type { GameDay, GameMode } from './types';

// The tale of the companion (US-COMP-05; design-sezioni.md 6.14, 11.5): which situation the
// morning bubble tells, which variant of its texts it uses, and the situation of the evening
// summary. The texts live in the language files under `tale.<voice>.<situation>…`.

/** One voice for each companion (racconto-compagno-testi.md, «Voci»). */
export const TALE_VOICES = ['pixel', 'rocky', 'glitchy', 'lumin', 'cloudy'] as const;
export type TaleVoice = (typeof TALE_VOICES)[number];

/** The situations of the morning, in order of priority (design 6.14). */
export const MORNING_SITUATIONS = [
  'pauseReturn',
  'absence',
  'streakRecord',
  'bossDefeated',
  'fullDay',
  'partialDay',
  'emptyDay',
  'restDay',
] as const;
export type TaleSituation = (typeof MORNING_SITUATIONS)[number];

/** The second sentence of the morning, the same set after every situation. */
export const ENCOURAGEMENT = 'encouragement';

export const EVENING_SITUATIONS = ['allDone', 'someLeft', 'noneDone'] as const;
export type EveningSituation = (typeof EVENING_SITUATIONS)[number];

const VOICE_BY_FAMILY: Readonly<Record<string, TaleVoice>> = {
  arcade: 'pixel',
  fantasy: 'rocky',
  cyberpunk: 'glitchy',
  lovecraft: 'lumin',
  minimal: 'cloudy',
};

/** The voice of the companion of a theme of the settings (`minimal-scuro` too). */
export function voiceOf(theme: string): TaleVoice {
  return VOICE_BY_FAMILY[theme.split('-')[0]] ?? 'cloudy';
}

export interface YesterdayTale {
  /** Missions expected yesterday. */
  readonly scheduled: number;
  readonly done: number;
  readonly restDay: boolean;
}

export interface TaleInput {
  readonly today: GameDay;
  /** Today is a day of general pause: the companion does not tell (choice 23). */
  readonly pausedToday: boolean;
  /** Yesterday as closed; null when there is no closed yesterday (the first day of use). */
  readonly yesterday: YesterdayTale | null;
  /** The day the app was opened last before this opening; null if never recorded. */
  readonly lastOpenDay: GameDay | null;
  /** Yesterday was the last day of a general pause. */
  readonly pauseEndedYesterday: boolean;
  readonly bossDefeatedYesterday: boolean;
  /** Yesterday the streak beat its record (`isStreakRecord`). */
  readonly streakRecord: boolean;
  readonly gameMode: GameMode;
}

/** Whole days without opening the app between the last opening and today. */
export function absentDays(lastOpenDay: GameDay | null, today: GameDay): number {
  return lastOpenDay === null ? 0 : Math.max(0, diffDays(lastOpenDay, today) - 1);
}

/**
 * The situation the morning bubble tells, or null when it does not show: the first day of use,
 * a day of general pause, or yesterday nothing expected and no rest day (design 6.14).
 */
export function taleSituation(input: TaleInput): TaleSituation | null {
  const { yesterday } = input;
  if (input.pausedToday || yesterday === null) {
    return null;
  }
  if (input.pauseEndedYesterday) {
    return 'pauseReturn';
  }
  if (absentDays(input.lastOpenDay, input.today) >= TALE.absenceDays) {
    return 'absence';
  }
  if (!yesterday.restDay && yesterday.scheduled === 0) {
    return null;
  }
  if (input.streakRecord) {
    return 'streakRecord';
  }
  if (input.bossDefeatedYesterday && input.gameMode !== 'essential') {
    return 'bossDefeated';
  }
  if (yesterday.scheduled > 0) {
    if (yesterday.done >= yesterday.scheduled) {
      return 'fullDay';
    }
    return yesterday.done > 0 ? 'partialDay' : 'emptyDay';
  }
  return 'restDay';
}

/**
 * «Serie record» (CLAUDE.md, choice 26): the streak of the hero at the close of each day, oldest
 * first, yesterday last. True when yesterday the streak first went above the record that stood
 * when the streak began, and that record was at least `minRecord` days. A streak begins when it
 * leaves 0 (or after it fell); days that keep it without growing continue it.
 */
export function isStreakRecord(
  streaks: readonly number[],
  minRecord: number = TALE.streakRecordMin,
): boolean {
  let best = 0;
  let recordAtStart = 0;
  let previous = 0;
  let fired = false;
  for (const streak of streaks) {
    if (streak > 0 && (previous === 0 || streak < previous)) {
      recordAtStart = best;
    }
    fired = streak > recordAtStart && previous <= recordAtStart && recordAtStart >= minRecord;
    best = Math.max(best, streak);
    previous = streak;
  }
  return fired;
}

/** `tale.<voice>.<situation>`: the group whose last variants are not repeated. */
export function taleGroup(key: string): string {
  return key.split('.').slice(0, 3).join('.');
}

/**
 * A variant among `keys` (all of one situation and voice), at random, avoiding the last 3 used
 * for that situation and voice; when all are among them, the one used least recently (design
 * 6.14). `recent` holds the keys used, oldest first. Null without variants.
 */
export function pickVariant(
  keys: readonly string[],
  recent: readonly string[],
  random: () => number = Math.random,
): string | null {
  if (keys.length === 0) {
    return null;
  }
  const group = taleGroup(keys[0]);
  const used = recent.filter((key) => taleGroup(key) === group);
  const last = used.slice(-TALE.recentPerGroup);
  const fresh = keys.filter((key) => !last.includes(key));
  if (fresh.length > 0) {
    return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
  }
  return [...keys].sort((a, b) => used.lastIndexOf(a) - used.lastIndexOf(b))[0];
}

/** `recent` with `keys` used now, at the end; only the last 3 of each group are kept. */
export function rememberVariants(recent: readonly string[], keys: readonly string[]): string[] {
  const all = [...recent.filter((key) => !keys.includes(key)), ...keys];
  const kept: string[] = [];
  const counts = new Map<string, number>();
  for (let index = all.length - 1; index >= 0; index--) {
    const group = taleGroup(all[index]);
    const count = counts.get(group) ?? 0;
    if (count < TALE.recentPerGroup) {
      kept.unshift(all[index]);
      counts.set(group, count + 1);
    }
  }
  return kept;
}

/** The situation of the evening summary (design 6.14, 11.5); null with nothing expected. */
export function eveningSituation(done: number, scheduled: number): EveningSituation | null {
  if (scheduled <= 0) {
    return null;
  }
  if (done >= scheduled) {
    return 'allDone';
  }
  return done === 0 ? 'noneDone' : 'someLeft';
}

/**
 * The variant of the evening of `day`: the summary is scheduled again after every action, so it
 * keeps one variant for the whole day and changes it from day to day. PROVISIONAL (backlog T91).
 */
export function dailyVariant(keys: readonly string[], day: GameDay): string | null {
  if (keys.length === 0) {
    return null;
  }
  const index = diffDays('1970-01-01', day) % keys.length;
  return keys[(index + keys.length) % keys.length];
}
