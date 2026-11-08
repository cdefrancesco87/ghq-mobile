import { and, gt, inArray, max } from 'drizzle-orm';

import { events } from '../schema';
import type { Db } from '../types';
import type { EventRow } from './events';

// The events a screen shows as a full-screen moment (design-sezioni.md A7).

export const MOMENT_EVENT_TYPES = [
  'hero.level_up',
  'boss.defeated',
  'companion.stage_up',
  'badge.unlocked',
] as const;

/** What an action made happen, for the moment queue of the screens. */
export interface WithMoments {
  /** The moment events written by the action, in the order they happened. */
  readonly moments: readonly EventRow[];
}

/** Runs part of an action inside its transaction and adds the moment events it wrote. */
export function withMoments<T extends object>(tx: Db, action: () => T): T & WithMoments {
  const before =
    tx
      .select({ seq: max(events.seq) })
      .from(events)
      .get()?.seq ?? 0;
  const result = action();
  const moments = tx
    .select()
    .from(events)
    .where(and(gt(events.seq, before), inArray(events.type, MOMENT_EVENT_TYPES)))
    .orderBy(events.seq)
    .all();
  return { ...result, moments };
}
