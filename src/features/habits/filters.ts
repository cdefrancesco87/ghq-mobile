export const HABIT_FILTERS = ['all', 'habits', 'tasks', 'archived'] as const;
export type HabitFilter = (typeof HABIT_FILTERS)[number];
