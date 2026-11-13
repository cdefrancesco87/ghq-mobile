import { create } from 'zustand';

import type { HabitFilter } from '@/features/habits/filters';

// The filter chosen in Habits stays when the user comes back to the screen (design-sezioni.md
// 3.3), as long as the app is open.

export interface HabitsUiState {
  readonly filter: HabitFilter;
  readonly setFilter: (filter: HabitFilter) => void;
}

export const useHabitsUiStore = create<HabitsUiState>()((set) => ({
  filter: 'all',
  setFilter: (filter) => set({ filter }),
}));
