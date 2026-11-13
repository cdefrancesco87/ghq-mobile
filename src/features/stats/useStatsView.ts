import { useMemo } from 'react';

import { getStatsView, type StatsView } from '@/db/repositories/statsView';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The overview of Statistics, read again after every action like Habits (`useHabitsView`). Null
 * before the profile exists.
 */
export function useStatsView(): StatsView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getStatsView(db, clock());
    // `hero` and `settings` are dependencies only to read the view again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings]);
}
