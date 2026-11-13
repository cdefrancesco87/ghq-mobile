import { useMemo } from 'react';

import { listBackfillCandidates, type BackfillDay } from '@/db/repositories/backfill';
import type { GameDay } from '@/rules/types';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The missions that can be completed afterwards (US-STAT-03), read again after every action: of
 * the 7 days before today, or of `day` alone. Null without a profile, or when `day` is null.
 */
export function useBackfillCandidates(day?: GameDay | null): readonly BackfillDay[] | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null || day === null) {
      return null;
    }
    const { db, clock } = getSession();
    return listBackfillCandidates(db, clock(), day);
    // `hero` and `settings` are dependencies only to read the days again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings, day]);
}
