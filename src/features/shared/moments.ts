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
      /** For «Vedi il trofeo» (design-sezioni.md 5.5). */
      readonly bossId: string | null;
      readonly xp: number;
      readonly coins: number;
      /** The quest of the first launch: a smaller victory than a boss (design 1.8). */
      readonly starter: boolean;
    }
  /** The egg hatches at the first completion, with the choice of the name (design 1.8, 6.5). */
  | { readonly kind: 'hatch'; readonly id: string }
  | { readonly kind: 'companion_stage'; readonly id: string; readonly stage: CompanionStage }
  | {
      readonly kind: 'badge';
      readonly id: string;
      /** The key of src/content/badges.ts. */
      readonly badgeKey: string;
      /** The bonus coins of the badge. */
      readonly coins: number;
    };

const MOMENT_ORDER: readonly Moment['kind'][] = [
  'level_up',
  'boss_defeated',
  'hatch',
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
      return {
        kind: 'boss_defeated',
        id,
        bossId: event.bossId,
        xp: event.dXp,
        coins: event.dCoins,
        starter: (payload as { starter?: boolean }).starter === true,
      };
    case 'companion.stage_up': {
      const { to } = payload as { to: CompanionStage };
      return to === 'baby' ? { kind: 'hatch', id } : { kind: 'companion_stage', id, stage: to };
    }
    case 'badge.unlocked':
      return {
        kind: 'badge',
        id,
        badgeKey: (payload as { badge?: string }).badge ?? '',
        coins: event.dCoins,
      };
    default:
      return null;
  }
}

/**
 * Whether the moment waits for a touch instead of going away after 2.5 seconds: the victory has
 * «Vedi il trofeo» and «Continua» (design-sezioni.md 5.5), which must stay in reach, and the
 * hatching asks for the name of the companion (1.8).
 */
export function waitsForTouch(moment: Moment): boolean {
  return moment.kind === 'boss_defeated' || moment.kind === 'hatch';
}

/**
 * Whether the moment is only a notice in the Essential mode, where level and experience stay
 * without full-screen moments and bosses and coins are hidden (design-sezioni.md A9, 1.9): level,
 * victory and badge. The companion keeps its moments, as it stays in that mode.
 */
export function isNoticeInEssential(moment: Moment): boolean {
  return moment.kind === 'level_up' || moment.kind === 'boss_defeated' || moment.kind === 'badge';
}

/** The moments of the events returned by an action; the other events bring none. */
export function momentsFromEvents(events: readonly EventRow[]): Moment[] {
  return events.map(momentOf).filter((moment) => moment !== null);
}

/**
 * The queue with new moments, most important first. The first of a queue that is already moving
 * is on screen and stays there. A moment whose id is already queued or on screen is not added
 * again.
 */
export function addMoments(queue: readonly Moment[], moments: readonly Moment[]): Moment[] {
  const rank = (moment: Moment) => MOMENT_ORDER.indexOf(moment.kind);
  const [current, ...waiting] = queue;
  const seen = new Set(queue.map((moment) => moment.id));
  const fresh: Moment[] = [];
  for (const moment of moments) {
    if (!seen.has(moment.id)) {
      seen.add(moment.id);
      fresh.push(moment);
    }
  }
  const sorted = [...waiting, ...fresh].sort((a, b) => rank(a) - rank(b));
  return current === undefined ? sorted : [current, ...sorted];
}
