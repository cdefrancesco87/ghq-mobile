import { create } from 'zustand';

// The mission just saved by the editor: Today gives its row a short highlight
// (design-sezioni.md 4.12), then clears it.

export interface HighlightState {
  readonly missionId: string | null;
  readonly highlight: (missionId: string) => void;
  readonly clear: () => void;
}

export const useHighlightStore = create<HighlightState>()((set) => ({
  missionId: null,
  highlight: (missionId) => set({ missionId }),
  clear: () => set({ missionId: null }),
}));
