import {
  completeMission,
  progressMission,
  type CompletionResult,
} from '../../db/repositories/completion';
import type { ActionClock } from '../../db/repositories/hero';
import { gameDayOf, getSetting } from '../../db/repositories/settings';
import type { Db } from '../../db/types';
import { decodeTarget } from './snapshot';

// A touch on the circle of a widget (design-sezioni.md 12.2; US-WID-01): the same completion as
// in Today, with `source: 'widget'` and the target as idempotency key, so a touch that reaches the
// app twice (the event and the list the widget keeps) counts once.

export interface WidgetOutcome {
  /**
   * `ignored`: not a target of this app, or a touch of another day (the widget was not updated
   * yet). `failed`: the mission is not due today any more, or it was skipped.
   */
  readonly outcome: CompletionResult['status'] | 'ignored' | 'failed';
  /** The completion, for the moments and the stores of the app. */
  readonly result: CompletionResult | null;
  readonly cancelledNotificationIds: readonly string[];
}

const NONE = { result: null, cancelledNotificationIds: [] } as const;

export function handleWidgetTarget(db: Db, value: string, clock: ActionClock): WidgetOutcome {
  const target = decodeTarget(value);
  if (target === null) {
    return { outcome: 'ignored', ...NONE };
  }
  const today = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
  if (target.day !== today) {
    return { outcome: 'ignored', ...NONE };
  }
  const input = {
    missionId: target.missionId,
    source: 'widget',
    idemKey: `widget:${value}`,
    now: clock.now,
    tzOffset: clock.tzOffset,
  } as const;
  try {
    const result =
      target.kind === 'complete' ? completeMission(db, input) : progressMission(db, input);
    return {
      outcome: result.status,
      result,
      cancelledNotificationIds: result.cancelledNotificationIds,
    };
  } catch {
    return { outcome: 'failed', ...NONE };
  }
}

/** The touches kept in the props of the widget (`pending`), from every entry, once each. */
export function pendingTargets(entries: readonly unknown[]): string[] {
  const targets = new Set<string>();
  for (const entry of entries) {
    const pending = (entry as { pending?: unknown } | null)?.pending;
    if (Array.isArray(pending)) {
      for (const target of pending) {
        if (typeof target === 'string') {
          targets.add(target);
        }
      }
    }
  }
  return [...targets];
}
