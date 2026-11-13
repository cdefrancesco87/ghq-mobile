import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { REWARD_SIZES, REWARDS } from '../../rules/config';
import { rewardName, rewardPrice, type RewardSize } from '../../rules/rewards';
import { rewards } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import { changeHero, loadHero, type ActionClock } from './hero';

// Personal rewards (US-NEG-03; modello-dati.md 3.9; design-sezioni.md 7.6): created by the
// user, redeemed with the coins as many times as wanted, never in the inventory. Only the
// redemption is a game action with its event; deleting archives the row and keeps the log.

export interface RewardInput {
  readonly name: string;
  readonly size: RewardSize;
}

/** A reward of the shop, with the price of its size. */
export interface RewardView {
  readonly id: string;
  readonly name: string;
  readonly size: RewardSize;
  readonly price: number;
}

export interface RewardsPage {
  readonly rewards: readonly RewardView[];
  /** More rewards beyond the limit: the list asks for them while scrolling. */
  readonly hasMore: boolean;
}

/** The price order: the sizes from the smallest, then the order of creation. */
const SIZE_ORDER = sql`CASE ${rewards.size} ${sql.raw(
  REWARD_SIZES.map((size, index) => `WHEN '${size}' THEN ${index}`).join(' '),
)} END`;

function activeReward(tx: Db, id: string) {
  const row = tx
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, id), isNull(rewards.archivedAt)))
    .get();
  if (row === undefined) {
    throw new RangeError(`No reward to use: ${id}`);
  }
  return row;
}

/** Creates a reward; the price comes from the size. Returns its id. */
export function createReward(db: Db, input: RewardInput, clock: ActionClock): string {
  const name = rewardName(input.name);
  rewardPrice(input.size);
  const id = uuidv7();
  db.insert(rewards).values({ id, name, size: input.size, createdAt: clock.now }).run();
  return id;
}

/** Changes name and size: the new price counts from the next redemption (7.6). */
export function updateReward(db: Db, id: string, input: RewardInput): void {
  const name = rewardName(input.name);
  rewardPrice(input.size);
  db.transaction((tx) => {
    activeReward(tx, id);
    tx.update(rewards).set({ name, size: input.size }).where(eq(rewards.id, id)).run();
  });
}

/** «Elimina»: the reward leaves the shop, its past redemptions stay in the log. */
export function archiveReward(db: Db, id: string, clock: ActionClock): void {
  db.transaction((tx) => {
    activeReward(tx, id);
    tx.update(rewards).set({ archivedAt: clock.now }).where(eq(rewards.id, id)).run();
  });
}

/** The rewards not deleted, by price, up to `limit`. */
export function listRewards(db: Db, options: { readonly limit?: number } = {}): RewardsPage {
  const limit = options.limit ?? REWARDS.pageSize;
  const rows = db
    .select({ id: rewards.id, name: rewards.name, size: rewards.size })
    .from(rewards)
    .where(isNull(rewards.archivedAt))
    .orderBy(SIZE_ORDER, asc(rewards.createdAt), asc(rewards.id))
    .limit(limit + 1)
    .all();
  return {
    rewards: rows.slice(0, limit).map((row) => ({ ...row, price: rewardPrice(row.size) })),
    hasMore: rows.length > limit,
  };
}

/**
 * Redeems a reward: spends its price and writes `reward.redeemed` with name, size and price
 * copied, so the log stays right after a change or a deletion. Refused without enough coins.
 * Returns the balance after.
 */
export function redeemReward(db: Db, id: string, clock: ActionClock): { coins: number } {
  return db.transaction((tx) => {
    const reward = activeReward(tx, id);
    const price = rewardPrice(reward.size);
    if (loadHero(tx).coins < price) {
      throw new RangeError(`Not enough coins for the reward ${id}: ${price} needed`);
    }
    const change = changeHero(tx, { coins: -price }, clock.now);
    appendEvent(tx, {
      type: 'reward.redeemed',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      deltas: change.deltas,
      payload: { rewardId: reward.id, name: reward.name, size: reward.size, price },
    });
    return { coins: loadHero(tx).coins };
  });
}
