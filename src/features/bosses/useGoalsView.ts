import { useMemo } from 'react';

import { getGoalsView, type GoalsView } from '@/db/repositories/goalsView';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The data of Obiettivi, read again after every action like Today (`useTodayView`): `runAction`
 * reloads the hero and the settings. Null before the profile exists.
 */
export function useGoalsView(): GoalsView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getGoalsView(db, clock());
    // `settings` is a dependency only to read the view again when a setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings]);
}
