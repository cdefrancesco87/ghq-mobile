import { useEffect } from 'react';

import { completeStarterStatsStep, starterStatsStepId } from '@/db/repositories/boss';
import { useMomentQueue } from '@/features/shared/MomentQueue';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';

/**
 * Opening Statistiche does the last step of the quest of the first launch (design-sezioni.md
 * 1.8). Its victory shows when the hero is back on Today, which shows the waiting moments.
 */
export function useStarterStatsStep(): void {
  const ready = useHeroStore((state) => state.hero !== null);
  const { enqueueLater } = useMomentQueue();
  useEffect(() => {
    if (!ready || starterStatsStepId(getSession().db) === null) {
      return;
    }
    const result = runAction((db, clock) => completeStarterStatsStep(db, clock));
    enqueueLater(result.moments);
  }, [enqueueLater, ready]);
}
