import type { EventRow } from '@/db/repositories/events';
import type { CompanionStage } from '@/rules/companion';
import { titleIndex } from '@/rules/level';

// The full-screen moments (design-sezioni.md A7) and their queue. The order of importance is that
// of the list in A7; change it here.

export type Moment =
  | {
      readonly kind: 'level_up';
      readonly id: string;
      readonly level: number;
      /** The title earned with this level, if it changed. */
      readonly titleIndex: number | null;
    }
  | {
      readonly kind: 'boss_defeated';
      readonly id: string;
      readonly xp: number;
      readonly coins: number;
    }
  | { readonly kind: 'companion_stage'; readonly id: string; readonly stage: CompanionStage }
  | { readonly kind: 'badge'; readonly id: string };

const MOMENT_ORDER: readonly Moment['kind'][] = [
  'level_up',
  'boss_defeated',
  'companion_stage',
  'badge',
];

function momentOf(event: EventRow): Moment | null {
  const { id, payload } = event;
  switch (event.type) {
    case 'hero.level_up': {
      const { from, to } = payload as { from: number; to: number };
      const title = titleIndex(to);
      return {
        kind: 'level_up',
        id,
        level: to,
        titleIndex: title > titleIndex(from) ? title : null,
      };
    }
    case 'boss.defeated':
      return { kind: 'boss_defeated', id, xp: event.dXp, coins: event.dCoins };
    case 'companion.stage_up':
      return { kind: 'companion_stage', id, stage: (payload as { to: CompanionStage }).to };
    case 'badge.unlocked':
      return { kind: 'badge', id };
    default:
      return null;
  }
}

/** The moments of the events returned by an action; the other events bring none. */
export function momentsFromEvents(events: readonly EventRow[]): Moment[] {
  return events.map(momentOf).filter((moment) => moment !== null);
}

/**
 * The queue with new moments, most important first. The first of a queue that is already moving
 * is on screen and stays there.
 */
export function addMoments(queue: readonly Moment[], moments: readonly Moment[]): Moment[] {
  const rank = (moment: Moment) => MOMENT_ORDER.indexOf(moment.kind);
  const [current, ...waiting] = queue;
  const sorted = [...waiting, ...moments].sort((a, b) => rank(a) - rank(b));
  return current === undefined ? sorted : [current, ...sorted];
}
