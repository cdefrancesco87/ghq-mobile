// The badges (analisi-funzionale.md US-PROF-02; design-sezioni.md 9.6): a condition on one number
// of the hero, reached once and kept. The list lives in src/content/badges.ts; the coins in
// BADGES of config.ts. Pure functions: the numbers come from the repository.

import { STAT_KEYS, type StatKey } from './types';

/** The numbers a badge can count. */
export const BADGE_METRICS = [
  /** Missions completed in all (the counter of the companion, backfills included). */
  'completions',
  /** The best streak of the hero. */
  'streakBest',
  'bossesDefeated',
  /** The level of the hero. */
  'level',
  /** Days with the «giornata completa» bonus. */
  'fullDays',
  /** Days with the bonus of the day Plan. */
  'plans',
  /** Stage of the companion: 0 egg, 1 puppy, 2 adult. */
  'companionStage',
  // The level of each stat (backlog T84; statistiche-eroe.md «Badge delle statistiche»).
  'stat_strength',
  'stat_constitution',
  'stat_intelligence',
  'stat_wisdom',
  'stat_charisma',
  'stat_discipline',
] as const;
export type BadgeMetric = (typeof BADGE_METRICS)[number];

/** The metric that counts the level of a stat. */
export function statBadgeMetric(stat: StatKey): BadgeMetric {
  return `stat_${stat}`;
}

/** The stat of a badge of the stats; null for the other badges. */
export function statOfBadge(badge: BadgeDefinition): StatKey | null {
  return STAT_KEYS.find((stat) => badge.metric === statBadgeMetric(stat)) ?? null;
}

export type BadgeMetrics = Readonly<Record<BadgeMetric, number>>;

export interface BadgeDefinition {
  /** Stored in `badges.badge_key`: never change it once released. */
  readonly key: string;
  readonly metric: BadgeMetric;
  /** The badge unlocks when the metric reaches this value. */
  readonly target: number;
}

export interface BadgeProgress {
  /** The metric, from 0 up to the target. */
  readonly current: number;
  readonly target: number;
  readonly reached: boolean;
}

/** The metrics of a new hero. */
export const NO_PROGRESS: BadgeMetrics = Object.fromEntries(
  BADGE_METRICS.map((metric) => [metric, 0]),
) as Record<BadgeMetric, number>;

/** How far a badge is: «Serie di 30 giorni · 23 di 30». */
export function badgeProgress(badge: BadgeDefinition, metrics: BadgeMetrics): BadgeProgress {
  const value = Math.max(0, metrics[badge.metric]);
  return {
    current: Math.min(value, badge.target),
    target: badge.target,
    reached: value >= badge.target,
  };
}

/**
 * The keys of the badges to unlock now: condition met and not unlocked before, in the order of
 * `definitions`. A badge already unlocked never comes back, even if its number went down.
 */
export function checkBadges(
  definitions: readonly BadgeDefinition[],
  metrics: BadgeMetrics,
  unlocked: Iterable<string>,
): string[] {
  const done = new Set(unlocked);
  return definitions
    .filter((badge) => !done.has(badge.key) && badgeProgress(badge, metrics).reached)
    .map((badge) => badge.key);
}
