import { useMemo } from 'react';

import {
  getCurrentWeeklyRecap,
  getPastWeeklyRecaps,
  getStatTrend,
  type WeeklyRecapView,
} from '@/db/repositories/weeklyRecap';
import type { StatTrend } from '@/rules/statTrend';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/** Reads `read` again after every action, like `useStatsView`; null before the profile exists. */
function useAfterActions<T>(read: () => T, enabled = true): T | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(
    () => (hero === null || !enabled ? null : read()),
    // `hero` and `settings` are dependencies only to read again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hero, settings, enabled],
  );
}

/** The recap at the top of the Overview (design 8.7), or null outside its time. */
export function useWeeklyRecap(): WeeklyRecapView | null {
  return useAfterActions(() => {
    const { db, clock } = getSession();
    return getCurrentWeeklyRecap(db, clock());
  });
}

/** The recaps of the weeks before, for the Registro; read only while `enabled`. */
export function usePastWeeklyRecaps(enabled: boolean): readonly WeeklyRecapView[] {
  return (
    useAfterActions(() => {
      const { db, clock } = getSession();
      return getPastWeeklyRecaps(db, clock());
    }, enabled) ?? []
  );
}

/** The level of the stats month by month (design 8.8). */
export function useStatTrend(): StatTrend | null {
  return useAfterActions(() => {
    const { db, clock } = getSession();
    return getStatTrend(db, clock());
  });
}
