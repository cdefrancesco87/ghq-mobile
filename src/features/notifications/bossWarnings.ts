import { eq } from 'drizzle-orm';

import type { Boss } from '../../db/repositories/boss';
import { boss } from '../../db/schema';
import type { Db } from '../../db/types';
import { deadlineWarningAt } from '../../rules/boss';
import { afterReminderSyncs } from './scheduler';

// The system notification of the deadline warning of a boss (design-sezioni.md 11.6): «Mancano 3
// giorni per sconfiggere …», one for each deadline of an active boss, at 09:00 of the first day of
// the warning, on the Boss channel; a touch opens the card of the boss. Like `scheduler.ts` it
// depends on no Expo module: the system sits behind `BossWarningScheduler`.

/** The identifiers of these notifications start with this, so they can be told from the others. */
export const BOSS_WARNING_PREFIX = 'boss-warning:';

export interface BossWarningText {
  readonly title: string;
  readonly body: string;
}

export interface BossWarningRequest extends BossWarningText {
  /** Identifier of the notification in the system: the boss and its deadline. */
  readonly id: string;
  readonly bossId: string;
  /** UTC instant in milliseconds. */
  readonly fireAt: number;
}

/** The notifications of the system, as the warnings need them. */
export interface BossWarningScheduler {
  /** The warnings scheduled and still to fire. */
  scheduled(): Promise<readonly (BossWarningText & { readonly id: string })[]>;
  /** Schedules the notification with the identifier of the request. */
  schedule(request: BossWarningRequest): Promise<void>;
  /** Cancels scheduled warnings. */
  cancel(ids: readonly string[]): Promise<void>;
}

export interface BossWarningInput {
  readonly now: number;
  /** Minutes east of UTC. */
  readonly tzOffset: number;
}

export interface BossWarningSync {
  readonly scheduled: number;
  readonly cancelled: number;
}

/** The warnings wanted from `now` on: active bosses whose warning time has not come yet. */
export function plannedBossWarnings(
  db: Db,
  { now, tzOffset }: BossWarningInput,
  textOf: (target: Boss) => BossWarningText,
): BossWarningRequest[] {
  return db
    .select()
    .from(boss)
    .where(eq(boss.status, 'active'))
    .all()
    .flatMap((target) => {
      if (target.deadlineDay === null) {
        return [];
      }
      const fireAt = deadlineWarningAt(target.deadlineDay, tzOffset);
      return fireAt <= now
        ? []
        : [
            {
              id: `${BOSS_WARNING_PREFIX}${target.id}:${target.deadlineDay}`,
              bossId: target.id,
              fireAt,
              ...textOf(target),
            },
          ];
    });
}

async function sync(
  db: Db,
  scheduler: BossWarningScheduler,
  input: BossWarningInput,
  textOf: (target: Boss) => BossWarningText,
): Promise<BossWarningSync> {
  const wanted = new Map(plannedBossWarnings(db, input, textOf).map((item) => [item.id, item]));
  const stale: string[] = [];
  for (const existing of await scheduler.scheduled()) {
    const request = wanted.get(existing.id);
    if (request === undefined) {
      stale.push(existing.id);
    } else if (request.title === existing.title && request.body === existing.body) {
      wanted.delete(existing.id);
    }
    // A changed text is scheduled again with the same identifier, which replaces it.
  }
  if (stale.length > 0) {
    await scheduler.cancel(stale);
  }
  for (const request of wanted.values()) {
    await scheduler.schedule(request);
  }
  return { scheduled: wanted.size, cancelled: stale.length };
}

/**
 * Aligns the warnings of the system with the deadlines of the active bosses: schedules the
 * missing ones, cancels those of a deadline changed or removed and of a boss no longer active. A
 * warning already shown is not scheduled again, so each deadline is warned once. Runs in the
 * queue of the reminders, never together with them or with «Elimina tutti i dati».
 */
export function syncBossWarnings(
  db: Db,
  scheduler: BossWarningScheduler,
  input: BossWarningInput,
  textOf: (target: Boss) => BossWarningText,
): Promise<BossWarningSync> {
  return afterReminderSyncs(() => sync(db, scheduler, input, textOf));
}
