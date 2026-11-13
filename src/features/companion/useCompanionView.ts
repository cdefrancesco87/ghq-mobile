import { useMemo } from 'react';

import { getCompanionView, type CompanionView } from '@/db/repositories/companion';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/**
 * The data of the companion sheet, read again after every action like the card of a boss
 * (`useBossView`). Null before the profile exists.
 */
export function useCompanionView(): CompanionView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getCompanionView(db, clock());
    // `hero` and `settings` are dependencies only to read the view again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings]);
}
