import { useEffect, useRef, useState } from 'react';

import type { BossProgress } from '@/db/repositories/boss';
import type { BossHit } from './BossCard';

/** How long the number of the damage stays beside the bar (design-sezioni.md 5.4). */
export const DAMAGE_MS = 1500;

/**
 * The control of the next step of a boss card, in Today and in Obiettivi: completes the step once
 * (a second tap before the data is read again would send it twice) and keeps the last hit for the
 * number of the damage and the shake of the sprite.
 *
 * @param complete Completes the step and gives the hit points taken, or null if nothing was saved.
 * @param data The data the cards come from: a new value means the screen was read again.
 */
export function useBossStep(complete: (item: BossProgress) => number | null, data: unknown) {
  const [hit, setHit] = useState<(BossHit & { readonly bossId: string }) | null>(null);
  const lastTap = useRef<{ readonly data: unknown; readonly stepId: string } | null>(null);

  useEffect(() => {
    if (hit === null) {
      return undefined;
    }
    const timer = setTimeout(() => setHit(null), DAMAGE_MS);
    return () => clearTimeout(timer);
  }, [hit]);

  const completeStep = (item: BossProgress) => {
    const stepId = item.nextStep?.id;
    if (stepId === undefined) {
      return;
    }
    const last = lastTap.current;
    if (last !== null && last.data === data && last.stepId === stepId) {
      return;
    }
    lastTap.current = { data, stepId };
    const dealt = complete(item);
    if (dealt === null) {
      // Nothing was saved: the same step can be tried again.
      lastTap.current = null;
    } else {
      setHit((last) => ({ bossId: item.boss.id, dealt, key: (last?.key ?? 0) + 1 }));
    }
  };

  return {
    hitOf: (bossId: string): BossHit | null => (hit?.bossId === bossId ? hit : null),
    completeStep,
  };
}
