import { useMemo } from 'react';

import { getHeatmapDay, type HeatmapDay } from '@/db/repositories/heatmap';
import type { GameDay } from '@/rules/types';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/** The sheet of a day of the heatmap, read again after every action; null without a day. */
export function useHeatmapDay(day: GameDay | null): HeatmapDay | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null || day === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getHeatmapDay(db, clock(), day);
    // `hero` and `settings` are dependencies only to read the day again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings, day]);
}
