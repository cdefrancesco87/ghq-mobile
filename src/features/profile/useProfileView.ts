import { useMemo } from 'react';

import {
  getProfileView,
  getStatDetail,
  type ProfileView,
  type StatDetail,
} from '@/db/repositories/profile';
import { getBadgesView, type BadgesView } from '@/db/repositories/badges';
import type { StatKey } from '@/rules/types';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The data of the Profile, read again after every action like Obiettivi (`useGoalsView`):
 * `runAction` reloads the hero and the settings. Null before the profile exists.
 */
export function useProfileView(): ProfileView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getProfileView(db, clock());
    // `settings` is a dependency only to read the view again when a setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings]);
}

/** The detail of the stat open in the sheet; null when no sheet is open. */
export function useStatDetail(stat: StatKey | null): StatDetail | null {
  const hero = useHeroStore((state) => state.hero);
  return useMemo(() => {
    if (hero === null || stat === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getStatDetail(db, stat, clock());
  }, [hero, stat]);
}

/** The badges, read again after every action like the Profile. Null before the profile exists. */
export function useBadgesView(): BadgesView | null {
  const hero = useHeroStore((state) => state.hero);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    return getBadgesView(getSession().db);
  }, [hero]);
}
