import type { BadgeDefinition, BadgeMetric } from '@/rules/badges';

// The badges (analisi-funzionale.md US-PROF-02: at least 20 in the MVP; design-sezioni.md 9.6),
// in the order of the grid. The key goes into the database: never change one once released.
// Names and conditions are in the language files (`badges.name`, `badges.condition`): a badge
// with its own name has `badges.name.<key>`, the others take the name of their metric.
//
// DRAFT to be reviewed by Claudio (CLAUDE.md, choice 7): list, thresholds and names.

/** The levels of a stat that unlock its three badges (statistiche-eroe.md: «proposta di soglie»). */
export const STAT_BADGE_LEVELS: readonly number[] = [3, 6, 10];

const THRESHOLDS: Readonly<Record<BadgeMetric, readonly number[]>> = {
  completions: [1, 10, 50, 100, 250, 500, 1000],
  streakBest: [3, 7, 14, 30, 60, 100, 365],
  bossesDefeated: [1, 3, 10, 25],
  level: [5, 10, 20, 30, 50],
  fullDays: [1, 10, 50],
  plans: [1, 10, 50],
  companionStage: [1, 2],
  // The badges of the stats (backlog T84): levels 3, 6 and 10, as proposed in statistiche-eroe.md.
  stat_strength: STAT_BADGE_LEVELS,
  stat_constitution: STAT_BADGE_LEVELS,
  stat_intelligence: STAT_BADGE_LEVELS,
  stat_wisdom: STAT_BADGE_LEVELS,
  stat_charisma: STAT_BADGE_LEVELS,
  stat_discipline: STAT_BADGE_LEVELS,
};

/** The badges with a name of their own, instead of the one of their metric. */
export const NAMED_BADGES: ReadonlySet<string> = new Set([
  'completions_1',
  'bossesDefeated_1',
  'fullDays_1',
  'plans_1',
  'companionStage_1',
  'companionStage_2',
]);

export const BADGE_LIST: readonly BadgeDefinition[] = (
  Object.entries(THRESHOLDS) as [BadgeMetric, readonly number[]][]
).flatMap(([metric, targets]) =>
  targets.map((target) => ({ key: `${metric}_${target}`, metric, target })),
);
