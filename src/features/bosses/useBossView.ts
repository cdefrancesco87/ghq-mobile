import { useMemo } from 'react';

import { getBossView, type BossView } from '@/db/repositories/bossView';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The data of the card of a boss, read again after every action like Obiettivi (`useGoalsView`).
 * Null before the profile exists or when the boss does not exist.
 */
export function useBossView(bossId: string): BossView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getBossView(db, bossId, clock());
    // `hero` and `settings` are dependencies only to read the view again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bossId, hero, settings]);
}
