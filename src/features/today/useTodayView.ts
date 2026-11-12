import { useMemo } from 'react';

import { getTodayView, type TodayView } from '@/db/repositories/todayView';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The data of Today. It is read again after every action: `runAction` reloads the hero and the
 * settings, which are the dependencies here. Null before the profile exists.
 */
export function useTodayView(): TodayView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getTodayView(db, clock());
    // `settings` is a dependency only to read the view again when a setting changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings]);
}
