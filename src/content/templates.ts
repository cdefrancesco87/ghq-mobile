import type { Frequency } from '../rules/frequency';
import type { Difficulty, StatKey } from '../rules/types';

// The mission templates of the first launch and of the editor library (US-ONB-03, design 1.5 and
// 4.11). Names and descriptions are in the language files, under the key of the template.
//
// DRAFT to be reviewed by Claudio (CLAUDE.md, choice 7): the templates and their stats come from
// the examples of statistiche-eroe.md («Le sei statistiche»); reading, meditation and study take
// the difficulty of the examples in xp-e-monete.md; categories, frequencies, the other
// difficulties and the goals are a proposal.

/** From 1 to 5 templates at the first launch (US-ONB-03). */
export const MIN_TEMPLATES = 1;
export const MAX_TEMPLATES = 5;

export const TEMPLATE_CATEGORIES = ['health', 'mind', 'work_study', 'home'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Goal of a template; `increment` is the value of one tap (`goal_step` of the mission). */
export type TemplateGoal =
  | { readonly type: 'none' }
  | {
      readonly type: 'quantity';
      readonly target: number;
      readonly unit: 'liter' | 'page' | 'step';
      readonly increment: number;
    }
  /** Minutes, with the timer. */
  | { readonly type: 'duration'; readonly target: number; readonly increment: number };

export interface MissionTemplate {
  readonly key: string;
  readonly category: TemplateCategory;
  readonly frequency: Frequency;
  readonly difficulty: Difficulty;
  /** Primary stat. */
  readonly stat: StatKey;
  readonly goal: TemplateGoal;
  /** Selected already at the first launch (design 1.5). */
  readonly recommended: boolean;
  /** Health data that can complete the mission by itself. */
  readonly healthMetric?: 'steps';
}

const DAILY: Frequency = { type: 'daily' };
const WORKDAYS: Frequency = { type: 'weekdays', days: [1, 2, 3, 4, 5] };
const NO_GOAL: TemplateGoal = { type: 'none' };

export const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  // Health
  {
    key: 'drink_water',
    category: 'health',
    frequency: DAILY,
    difficulty: 'easy',
    stat: 'constitution',
    goal: { type: 'quantity', target: 2, unit: 'liter', increment: 0.25 },
    recommended: true,
  },
  {
    key: 'healthy_meal',
    category: 'health',
    frequency: DAILY,
    difficulty: 'easy',
    stat: 'constitution',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'bed_by_eleven',
    category: 'health',
    frequency: DAILY,
    difficulty: 'medium',
    stat: 'constitution',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'run',
    category: 'health',
    frequency: { type: 'times_per_week', times: 3 },
    difficulty: 'medium',
    stat: 'strength',
    goal: { type: 'duration', target: 30, increment: 5 },
    recommended: false,
  },
  {
    key: 'steps',
    category: 'health',
    frequency: DAILY,
    difficulty: 'medium',
    stat: 'strength',
    goal: { type: 'quantity', target: 10000, unit: 'step', increment: 1000 },
    recommended: false,
    healthMetric: 'steps',
  },
  {
    key: 'gym',
    category: 'health',
    frequency: { type: 'times_per_week', times: 3 },
    difficulty: 'hard',
    stat: 'strength',
    goal: NO_GOAL,
    recommended: false,
  },
  // Mind
  {
    key: 'read_pages',
    category: 'mind',
    frequency: DAILY,
    difficulty: 'medium',
    stat: 'intelligence',
    goal: { type: 'quantity', target: 20, unit: 'page', increment: 5 },
    recommended: true,
  },
  {
    key: 'meditation',
    category: 'mind',
    frequency: DAILY,
    difficulty: 'medium',
    stat: 'wisdom',
    goal: { type: 'duration', target: 10, increment: 5 },
    recommended: true,
  },
  {
    key: 'journal',
    category: 'mind',
    frequency: DAILY,
    difficulty: 'easy',
    stat: 'wisdom',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'no_social_evening',
    category: 'mind',
    frequency: DAILY,
    difficulty: 'medium',
    stat: 'wisdom',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'call_friend',
    category: 'mind',
    frequency: { type: 'times_per_week', times: 1 },
    difficulty: 'easy',
    stat: 'charisma',
    goal: NO_GOAL,
    recommended: false,
  },
  // Work and study
  {
    key: 'study_hour',
    category: 'work_study',
    frequency: WORKDAYS,
    difficulty: 'hard',
    stat: 'intelligence',
    goal: { type: 'duration', target: 60, increment: 15 },
    recommended: false,
  },
  {
    key: 'english_lesson',
    category: 'work_study',
    frequency: { type: 'weekdays', days: [2, 4] },
    difficulty: 'medium',
    stat: 'intelligence',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'inbox_zero',
    category: 'work_study',
    frequency: WORKDAYS,
    difficulty: 'medium',
    stat: 'discipline',
    goal: NO_GOAL,
    recommended: false,
  },
  // Home
  {
    key: 'family_dinner',
    category: 'home',
    frequency: { type: 'weekdays', days: [7] },
    difficulty: 'easy',
    stat: 'charisma',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'tidy_desk',
    category: 'home',
    frequency: { type: 'weekdays', days: [5] },
    difficulty: 'easy',
    stat: 'discipline',
    goal: NO_GOAL,
    recommended: false,
  },
  {
    key: 'track_expenses',
    category: 'home',
    frequency: DAILY,
    difficulty: 'easy',
    stat: 'discipline',
    goal: NO_GOAL,
    recommended: false,
  },
];
