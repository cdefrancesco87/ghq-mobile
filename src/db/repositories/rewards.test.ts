import { eq } from 'drizzle-orm';

import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import {
  archiveReward,
  createReward,
  listRewards,
  redeemReward,
  updateReward,
} from '@/db/repositories/rewards';
import { events, hero, rewards } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, expectHeroMatchesLog, newGame, TZ } from '../../../test/game';

const NOW = clockAt(6, 10);

/** Coins changed like a game action does: state and event together. */
function giveCoins(db: Db, coins: number): void {
  const change = changeHero(db, { coins }, at(6, 8));
  appendEvent(db, {
    type: 'day.closed',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

const coinsOf = (db: Db) => db.select().from(hero).get()?.coins;
const redemptions = (db: Db) =>
  db.select().from(events).where(eq(events.type, 'reward.redeemed')).all();

describe('createReward', () => {
  it('stores the name without spaces around and the size, with the price of the size', () => {
    const db = newGame(['journal']);
    const id = createReward(db, { name: '  Un episodio della tua serie ', size: 'medium' }, NOW);
    expect(db.select().from(rewards).all()).toEqual([
      {
        id,
        name: 'Un episodio della tua serie',
        size: 'medium',
        createdAt: NOW.now,
        archivedAt: null,
      },
    ]);
    expect(listRewards(db).rewards).toEqual([
      { id, name: 'Un episodio della tua serie', size: 'medium', price: 250 },
    ]);
  });

  it('refuses an empty name, a name over 40 characters and an unknown size', () => {
    const db = newGame(['journal']);
    expect(() => createReward(db, { name: ' ', size: 'small' }, NOW)).toThrow(RangeError);
    expect(() => createReward(db, { name: 'a'.repeat(41), size: 'small' }, NOW)).toThrow(
      RangeError,
    );
    expect(() => createReward(db, { name: 'Pizza', size: 'huge' as never }, NOW)).toThrow(
      RangeError,
    );
    expect(db.select().from(rewards).all()).toEqual([]);
  });
});

describe('listRewards', () => {
  it('has no limit and loads 50 rewards in pages, by price', () => {
    const db = newGame(['journal']);
    const sizes = ['epic', 'small', 'large', 'medium'] as const;
    for (let index = 0; index < 50; index += 1) {
      createReward(
        db,
        { name: `Premio ${index}`, size: sizes[index % sizes.length] },
        clockAt(6, 10),
      );
    }
    const first = listRewards(db, { limit: 20 });
    expect(first.rewards).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    const all = listRewards(db, { limit: 60 });
    expect(all.rewards).toHaveLength(50);
    expect(all.hasMore).toBe(false);
    const prices = all.rewards.map((reward) => reward.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    // The same price keeps the order of creation.
    expect(all.rewards.slice(0, 3).map((reward) => reward.name)).toEqual([
      'Premio 1',
      'Premio 5',
      'Premio 9',
    ]);
  });

  it('leaves out the deleted rewards', () => {
    const db = newGame(['journal']);
    const kept = createReward(db, { name: 'Cinema', size: 'large' }, NOW);
    const gone = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    archiveReward(db, gone, NOW);
    expect(listRewards(db).rewards.map((reward) => reward.id)).toEqual([kept]);
  });
});

describe('redeemReward', () => {
  it('spends the price and writes the redemption in the log with name and price copied', () => {
    const db = newGame(['journal']);
    giveCoins(db, 300);
    const id = createReward(db, { name: 'Un episodio della tua serie', size: 'medium' }, NOW);
    expect(redeemReward(db, id, clockAt(6, 11))).toEqual({ coins: 50 });
    expect(coinsOf(db)).toBe(50);
    const [event] = redemptions(db);
    expect(event).toMatchObject({
      dCoins: -250,
      occurredAt: at(6, 11),
      payload: { rewardId: id, name: 'Un episodio della tua serie', size: 'medium', price: 250 },
    });
    // The reward stays for the next redemptions.
    expect(listRewards(db).rewards).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('refuses a redemption without enough coins and changes nothing', () => {
    const db = newGame(['journal']);
    giveCoins(db, 99);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    expect(() => redeemReward(db, id, NOW)).toThrow(RangeError);
    expect(coinsOf(db)).toBe(99);
    expect(redemptions(db)).toEqual([]);
    expectHeroMatchesLog(db);
  });

  it('refuses a deleted or unknown reward', () => {
    const db = newGame(['journal']);
    giveCoins(db, 500);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    archiveReward(db, id, NOW);
    expect(() => redeemReward(db, id, NOW)).toThrow(RangeError);
    expect(() => redeemReward(db, 'nope', NOW)).toThrow(RangeError);
    expect(coinsOf(db)).toBe(500);
  });
});

describe('updateReward', () => {
  it('changes name and size: the new price counts only for the next redemptions', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1000);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    redeemReward(db, id, NOW);
    updateReward(db, id, { name: ' Pizza fuori ', size: 'large' });
    expect(listRewards(db).rewards).toEqual([
      { id, name: 'Pizza fuori', size: 'large', price: 600 },
    ]);
    redeemReward(db, id, NOW);
    expect(redemptions(db).map((event) => [event.payload.name, event.payload.price])).toEqual([
      ['Pizza', 100],
      ['Pizza fuori', 600],
    ]);
    expect(coinsOf(db)).toBe(300);
    expectHeroMatchesLog(db);
  });

  it('refuses a wrong name and a deleted reward', () => {
    const db = newGame(['journal']);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    expect(() => updateReward(db, id, { name: '', size: 'small' })).toThrow(RangeError);
    archiveReward(db, id, NOW);
    expect(() => updateReward(db, id, { name: 'Cinema', size: 'small' })).toThrow(RangeError);
  });
});

describe('archiveReward', () => {
  it('deletes the reward from the shop and keeps the past redemptions in the log', () => {
    const db = newGame(['journal']);
    giveCoins(db, 200);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, NOW);
    redeemReward(db, id, NOW);
    archiveReward(db, id, clockAt(6, 12));
    expect(db.select().from(rewards).get()?.archivedAt).toBe(at(6, 12));
    expect(listRewards(db).rewards).toEqual([]);
    expect(redemptions(db)).toHaveLength(1);
    expect(coinsOf(db)).toBe(100);
    expect(() => archiveReward(db, id, NOW)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });
});
