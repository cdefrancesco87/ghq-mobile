import { useMemo } from 'react';

import { getMissionDetail, type MissionDetail } from '@/db/repositories/missionDetail';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The detail of a mission, read again after every action like the overview (`useStatsView`).
 * Null before the profile exists and for a mission deleted or unknown.
 */
export function useMissionDetail(missionId: string): MissionDetail | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getMissionDetail(db, clock(), missionId);
    // `hero` and `settings` are dependencies only to read the view again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings, missionId]);
}
