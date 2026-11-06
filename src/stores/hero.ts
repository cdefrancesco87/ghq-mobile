import { create } from 'zustand';

import { loadHero, type Hero } from '../db/repositories/hero';
import { heroStats } from '../db/schema';
import { hasProfile } from '../db/repositories/onboarding';
import type { Db } from '../db/types';
import type { StatKey } from '../rules/types';

// The hero, needed on every screen: the row of `hero` and the points of each stat. It is read
// from the database after every action (stack-tecnologico.md, point 2), never written here.

export interface HeroState {
  /** Null before the profile is created (first launch). */
  readonly hero: Hero | null;
  readonly stats: Readonly<Partial<Record<StatKey, number>>>;
  readonly load: (db: Db) => void;
  readonly reset: () => void;
}

const EMPTY = { hero: null, stats: {} } as const;

export const useHeroStore = create<HeroState>()((set) => ({
  ...EMPTY,
  load: (db) => {
    if (!hasProfile(db)) {
      set(EMPTY);
      return;
    }
    const stats: Partial<Record<StatKey, number>> = {};
    for (const row of db.select().from(heroStats).all()) {
      stats[row.statKey] = row.points;
    }
    set({ hero: loadHero(db), stats });
  },
  reset: () => set(EMPTY),
}));
