import { eq, isNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import type { Deltas, GameDay } from '../../rules/types';
import { events, type missions } from '../schema';
import type { Db } from '../types';
import { gameDayOf, getDeviceId, getSetting } from './settings';

// The common brick of every game action: one row in the append-only event log, written in the
// same transaction as the state tables (modello-dati.md, section 4).

/**
 * The event types of the data model (modello-dati.md, 4.2), plus `hero.created`: the creation of
 * the profile, which brings the starting hit points into the log so that the log always adds up
 * to the hero.
 */
export const EVENT_TYPES = [
  'mission.created',
  'mission.updated',
  'mission.paused',
  'mission.resumed',
  'mission.archived',
  'mission.restored',
  'mission.deleted',
  'mission.completed',
  'mission.progressed',
  'mission.skipped',
  'mission.backfilled',
  'event.reverted',
  'day.closed',
  'bonus.full_day',
  'bonus.plan',
  'boss.created',
  'boss.step_done',
  'boss.damaged',
  'boss.defeated',
  'boss.deadline_missed',
  'boss.archived',
  'hero.created',
  'hero.level_up',
  'hero.exhausted',
  'hero.renamed',
  'companion.stage_up',
  'companion.gift',
  'item.bought',
  'item.used',
  'shield.consumed',
  'reward.redeemed',
  'badge.unlocked',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type EventRow = typeof events.$inferSelect;
export type EventSource = EventRow['source'];

export interface EventInput {
  readonly type: EventType;
  /** UTC instant of the action, in milliseconds. */
  readonly occurredAt: number;
  /** Minutes east of UTC at the time of the action (local time = UTC + offset). */
  readonly tzOffset: number;
  readonly source: EventSource;
  /** The same key never counts twice, e.g. `notif:<os_id>`. */
  readonly idemKey?: string | null;
  readonly missionId?: string | null;
  readonly bossId?: string | null;
  readonly itemKey?: string | null;
  /** The event undone by this one. */
  readonly revertsId?: string | null;
  /** Changes really applied to the hero; missing values are 0. */
  readonly deltas?: Partial<Deltas>;
  readonly payload?: Record<string, unknown>;
  /** Version of the format of this event type. */
  readonly v?: number;
  /** The game day, when the action belongs to a given day (closing a past day); otherwise it is
   * computed from `occurredAt`, `tzOffset` and the day change setting. */
  readonly gameDay?: GameDay;
}

export interface AppendResult {
  /** `already_recorded` when an event with the same idempotency key exists: nothing is written. */
  readonly status: 'recorded' | 'already_recorded';
  readonly event: EventRow;
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer: ${value}`);
  }
}

/**
 * Appends an event to the log. Call it inside the transaction of the action (`tx`): if the
 * action fails, the event goes away with it. When the idempotency key is already in the log,
 * nothing is written and the result is `already_recorded`, without errors.
 */
export function appendEvent(tx: Db, input: EventInput): AppendResult {
  if (!EVENT_TYPES.includes(input.type)) {
    throw new RangeError(`Unknown event type: ${input.type}`);
  }
  assertInteger(input.tzOffset, 'The time zone offset');
  const { xp = 0, coins = 0, hp = 0, stats = {} } = input.deltas ?? {};
  for (const [name, value] of Object.entries({ xp, coins, hp, ...stats })) {
    assertInteger(value as number, `The change of ${name}`);
  }

  const inserted = tx
    .insert(events)
    .values({
      id: uuidv7(),
      type: input.type,
      v: input.v ?? 1,
      occurredAt: input.occurredAt,
      tzOffset: input.tzOffset,
      gameDay:
        input.gameDay ?? gameDayOf(input.occurredAt, input.tzOffset, getSetting(tx, 'day_change')),
      source: input.source,
      deviceId: getDeviceId(tx, input.occurredAt),
      missionId: input.missionId ?? null,
      bossId: input.bossId ?? null,
      itemKey: input.itemKey ?? null,
      revertsId: input.revertsId ?? null,
      idemKey: input.idemKey ?? null,
      dXp: xp,
      dCoins: coins,
      dHp: hp,
      dStats: Object.keys(stats).length > 0 ? stats : null,
      payload: input.payload ?? {},
    })
    .onConflictDoNothing({ target: events.idemKey })
    .returning()
    .get();
  if (inserted !== undefined) {
    return { status: 'recorded', event: inserted };
  }
  const existing = tx
    .select()
    .from(events)
    .where(eq(events.idemKey, input.idemKey ?? ''))
    .get();
  if (existing === undefined) {
    throw new Error(
      `The event with idempotency key ${input.idemKey} was neither written nor found`,
    );
  }
  return { status: 'already_recorded', event: existing };
}

/**
 * The condition every screen uses on the missions: deleted missions stay in the database
 * (logical deletion, modello-dati.md 4.5) but never show up.
 */
export function notDeleted(table: typeof missions) {
  return isNull(table.deletedAt);
}
