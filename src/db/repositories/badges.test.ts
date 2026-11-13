import { eq } from 'drizzle-orm';

import { BADGE_LIST } from '@/content/badges';
import { badgeMetrics, getBadgesView, unlockBadges } from '@/db/repositories/badges';
import { completeMission } from '@/db/repositories/completion';
import { getQuestLog } from '@/db/repositories/questLog';
import { undoEvent } from '@/db/repositories/undo';
import { badges, events, hero, heroStats } from '@/db/schema';
import type { Db } from '@/db/types';
import { BADGES } from '@/rules/config';

import { createTestDb } from '../../../test/db';
import {
  at,
  clockAt,
  expectHeroMatchesLog,
  FRIDAY,
  missionId,
  newGame,
  TZ,
} from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome (test/game.ts).

const complete = (db: Db, id: string, day = FRIDAY, hour = 10) =>
  completeMission(db, { missionId: id, source: 'app', now: at(day, hour), tzOffset: TZ });

const coins = (db: Db) => db.select().from(hero).get()?.coins ?? 0;

describe('unlockBadges', () => {
  it('unlocks nothing for a new hero, nor without a profile', () => {
    const db = newGame(['journal']);
    expect(unlockBadges(db, clockAt(FRIDAY, 10)).moments).toEqual([]);
    expect(unlockBadges(createTestDb(), clockAt(FRIDAY, 10)).moments).toEqual([]);
  });

  it('unlocks the first badges with their coins, an event each and the hero adding up', () => {
    const db = newGame(['journal']);
    complete(db, missionId(db, 'journal'));
    const before = coins(db);
    const { moments } = unlockBadges(db, clockAt(FRIDAY, 10));
    // The only mission of the day completes the day and hatches the egg.
    expect(moments.map((event) => event.payload)).toEqual([
      { badge: 'completions_1' },
      { badge: 'fullDays_1' },
      { badge: 'companionStage_1' },
    ]);
    expect(moments.every((event) => event.type === 'badge.unlocked')).toBe(true);
    expect(moments.every((event) => event.dCoins === BADGES.coins)).toBe(true);
    expect(coins(db)).toBe(before + 3 * BADGES.coins);
    expect(db.select().from(badges).all()).toEqual([
      { badgeKey: 'completions_1', unlockedAt: at(FRIDAY, 10) },
      { badgeKey: 'fullDays_1', unlockedAt: at(FRIDAY, 10) },
      { badgeKey: 'companionStage_1', unlockedAt: at(FRIDAY, 10) },
    ]);
    expectHeroMatchesLog(db);
  });

  it('never unlocks a badge twice, also after an undo and a new completion', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    const done = complete(db, id);
    unlockBadges(db, clockAt(FRIDAY, 10));
    expect(unlockBadges(db, clockAt(FRIDAY, 11)).moments).toEqual([]);
    undoEvent(db, done.completion?.eventId ?? '', clockAt(FRIDAY, 11));
    complete(db, id, FRIDAY, 12);
    expect(unlockBadges(db, clockAt(FRIDAY, 12)).moments).toEqual([]);
    expect(db.select().from(events).where(eq(events.type, 'badge.unlocked')).all()).toHaveLength(3);
    expectHeroMatchesLog(db);
  });

  it('unlocks the badges of the streak, the level and the stats', () => {
    const db = newGame(['journal']);
    db.update(hero).set({ streakBest: 8, level: 5 }).run();
    db.update(heroStats).set({ points: 2000 }).where(eq(heroStats.statKey, 'wisdom')).run();
    const keys = unlockBadges(db, clockAt(FRIDAY, 10)).moments.map(
      (event) => (event.payload as { badge: string }).badge,
    );
    expect(keys).toEqual(['streakBest_3', 'streakBest_7', 'level_5', 'statLevelMax_3']);
  });
});

describe('badgeMetrics', () => {
  it('counts the day bonuses that were not undone', () => {
    const db = newGame(['journal']);
    const done = complete(db, missionId(db, 'journal'));
    expect(done.bonuses).toContain('bonus.full_day');
    expect(badgeMetrics(db).fullDays).toBe(1);
    undoEvent(db, done.completion?.eventId ?? '', clockAt(FRIDAY, 11));
    expect(badgeMetrics(db).fullDays).toBe(0);
    expect(badgeMetrics(db).completions).toBe(0);
  });
});

describe('getBadgesView', () => {
  it('gives every badge with its progress, and the unlocked ones with date and coins', () => {
    const db = newGame(['journal']);
    complete(db, missionId(db, 'journal'));
    unlockBadges(db, clockAt(FRIDAY, 10));
    const view = getBadgesView(db);
    expect(view.total).toBe(BADGE_LIST.length);
    expect(view.unlocked).toBe(3);
    const first = view.badges.find((item) => item.badge.key === 'completions_1');
    expect(first).toMatchObject({
      unlockedAt: at(FRIDAY, 10),
      unlockedDay: '2026-11-06',
      coins: BADGES.coins,
    });
    const tenth = view.badges.find((item) => item.badge.key === 'completions_10');
    expect(tenth).toMatchObject({
      unlockedAt: null,
      unlockedDay: null,
      coins: null,
      progress: { current: 1, target: 10, reached: false },
    });
    expect(view.recent.map((item) => item.badge.key)).toEqual([
      'companionStage_1',
      'fullDays_1',
      'completions_1',
    ]);
  });
});

describe('the badges in the Registro', () => {
  it('names the badge of every unlock under «Tutto»', () => {
    const db = newGame(['journal']);
    complete(db, missionId(db, 'journal'));
    unlockBadges(db, clockAt(FRIDAY, 10));
    const entries = getQuestLog(db, clockAt(FRIDAY, 12), { filter: 'all' })
      .days.flatMap((day) => day.entries)
      .filter((entry) => entry.type === 'badge.unlocked');
    expect(entries.map((entry) => [entry.itemKey, entry.coins])).toEqual([
      ['companionStage_1', BADGES.coins],
      ['fullDays_1', BADGES.coins],
      ['completions_1', BADGES.coins],
    ]);
  });
});
