import { useMemo } from 'react';

import { getQuestLog, type QuestLogQuery, type QuestLogView } from '@/db/repositories/questLog';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';

/** The Registro, read again after every action like the overview; null before the profile. */
export function useQuestLog(query: QuestLogQuery): QuestLogView | null {
  const hero = useHeroStore((state) => state.hero);
  const settings = useSettingsStore((state) => state.settings);
  const { filter, missionId, from, to, limit, essential } = query;
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    const { db, clock } = getSession();
    return getQuestLog(db, clock(), { filter, missionId, from, to, limit, essential });
    // `hero` and `settings` are dependencies only to read the log again after an action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero, settings, filter, missionId, from, to, limit, essential]);
}
