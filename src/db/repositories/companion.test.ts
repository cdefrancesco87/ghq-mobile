import { eq } from 'drizzle-orm';

import { getCompanionView, giveGift, renameCompanion } from '@/db/repositories/companion';
import { completeMission } from '@/db/repositories/completion';
import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem, getShopView } from '@/db/repositories/shop';
import { deleteMission } from '@/db/repositories/missions';
import { getTodayView } from '@/db/repositories/todayView';
import { companion, daySummaries, events } from '@/db/schema';
import type { Db } from '@/db/types';
import type { GameDay } from '@/rules/types';

import {
  at,
  clockAt,
  expectHeroMatchesLog,
  FRIDAY,
  missionId,
  newGame,
  TZ,
} from '../../../test/game';

const NOW = clockAt(FRIDAY, 10);

function renamedEvents(db: ReturnType<typeof newGame>) {
  return db.select().from(events).where(eq(events.type, 'companion.renamed')).all();
}

describe('getCompanionView', () => {
  it('shows the egg of a new game with the default name and its growth', () => {
    const db = newGame(['meditation']);
    expect(getCompanionView(db, NOW)).toEqual({
      stage: 'egg',
      name: null,
      mood: 'normal',
      growth: { stageNumber: 1, stageCount: 3, done: 0, target: 1, left: 1 },
      moodWindow: { days: 3, scheduled: 0, done: 0, percent: null },
      doneToday: 0,
      giftToday: false,
      giftRaised: false,
    });
  });

  it('shows the puppy after the first completion, happy because of today', () => {
    const db = newGame(['meditation']);
    completeMission(db, { missionId: missionId(db, 'meditation'), source: 'app', ...NOW });
    expect(getCompanionView(db, NOW)).toEqual({
      stage: 'baby',
      name: null,
      mood: 'happy',
      growth: { stageNumber: 2, stageCount: 3, done: 1, target: 150, left: 149 },
      moodWindow: { days: 3, scheduled: 0, done: 0, percent: null },
      doneToday: 1,
      giftToday: false,
      giftRaised: false,
    });
  });

  it('does not count today a completion of a mission deleted since, like Today', () => {
    const db = newGame(['meditation']);
    const meditation = missionId(db, 'meditation');
    completeMission(db, { missionId: meditation, source: 'app', ...NOW });
    deleteMission(db, meditation, NOW);
    expect(getCompanionView(db, NOW)).toMatchObject({ stage: 'baby', mood: 'normal' });
  });

  it('shows the adult fully grown', () => {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'adult', completionsTotal: 160 }).run();
    expect(getCompanionView(db, NOW)).toMatchObject({
      stage: 'adult',
      growth: { stageNumber: 3, done: 160, target: null, left: 0 },
    });
  });
});

describe('mood of the companion', () => {
  function closedDay(db: Db, day: number, scheduledCount: number, doneCount: number) {
    db.insert(daySummaries)
      .values({
        gameDay: `2026-11-${String(day).padStart(2, '0')}` as GameDay,
        scheduledCount,
        doneCount,
        scheduledXp: 0,
        missedXp: 0,
        hpLost: 0,
        isRestDay: false,
        fullDay: scheduledCount === doneCount,
        planComplete: false,
        shieldUsed: false,
        closedAt: at(day + 1, 6),
      })
      .run();
  }

  /** A puppy with the given closed days before Monday 9 November. */
  function puppyWith(...days: [scheduled: number, done: number][]) {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'baby', completionsTotal: 20 }).run();
    days.forEach(([scheduled, done], index) => closedDay(db, 6 + index, scheduled, done));
    return db;
  }

  const MONDAY = clockAt(FRIDAY + 3, 10);

  it('is happy above 70% of the last 3 days, with the share for the card', () => {
    expect(getCompanionView(puppyWith([4, 3], [3, 3], [3, 2]), MONDAY)).toMatchObject({
      mood: 'happy',
      moodWindow: { days: 3, scheduled: 10, done: 8, percent: 80 },
      doneToday: 0,
    });
  });

  it('is normal between 30% and 70%', () => {
    expect(getCompanionView(puppyWith([2, 1], [2, 1], [2, 1]), MONDAY)).toMatchObject({
      mood: 'normal',
      moodWindow: { scheduled: 6, done: 3, percent: 50 },
    });
  });

  it('is sad below 30% and happy again after a completion today', () => {
    const db = puppyWith([3, 0], [3, 1], [3, 0]);
    expect(getCompanionView(db, MONDAY)).toMatchObject({
      mood: 'sad',
      moodWindow: { scheduled: 9, done: 1, percent: 11 },
    });

    completeMission(db, { missionId: missionId(db, 'meditation'), source: 'app', ...MONDAY });
    expect(getCompanionView(db, MONDAY)).toMatchObject({
      mood: 'happy',
      moodWindow: { percent: 11 },
      doneToday: 1,
    });
  });
});

describe('gifts for the companion', () => {
  const MONDAY = clockAt(FRIDAY + 3, 10);

  /** A puppy with the given closed days before Monday 9 November, some coins and gifts bought. */
  function sadPuppy() {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'baby', completionsTotal: 20 }).run();
    [6, 7, 8].forEach((day) =>
      db
        .insert(daySummaries)
        .values({
          gameDay: `2026-11-0${day}` as GameDay,
          scheduledCount: 3,
          doneCount: 0,
          scheduledXp: 0,
          missedXp: 0,
          hpLost: 0,
          isRestDay: false,
          fullDay: false,
          planComplete: false,
          shieldUsed: false,
          closedAt: at(day + 1, 6),
        })
        .run(),
    );
    const change = changeHero(db, { coins: 100 }, at(9, 7));
    appendEvent(db, {
      type: 'day.closed',
      occurredAt: at(9, 7),
      tzOffset: TZ,
      source: 'system',
      gameDay: '2026-11-08',
      deltas: change.deltas,
    });
    buyItem(db, 'cookie', MONDAY);
    buyItem(db, 'ball', MONDAY);
    return db;
  }

  it('gives a gift: one less in the inventory, the event, the mood one level up', () => {
    const db = sadPuppy();
    expect(getCompanionView(db, MONDAY)).toMatchObject({ mood: 'sad', giftToday: false });

    expect(giveGift(db, 'cookie', MONDAY)).toEqual({ before: 'sad', after: 'normal' });
    expect(getShopView(db).gifts.find((gift) => gift.key === 'cookie')?.owned).toBe(0);
    const gifts = db.select().from(events).where(eq(events.type, 'companion.gift')).all();
    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toMatchObject({
      itemKey: 'cookie',
      gameDay: '2026-11-09',
      dXp: 0,
      dCoins: 0,
      dHp: 0,
    });
    expect(getCompanionView(db, MONDAY)).toMatchObject({
      mood: 'normal',
      giftToday: true,
      giftRaised: true,
    });
    expect(getTodayView(db, MONDAY).companion.mood).toBe('normal');
    expectHeroMatchesLog(db);
  });

  it('raises the mood one level a day, whatever the number of gifts', () => {
    const db = sadPuppy();
    giveGift(db, 'cookie', MONDAY);
    expect(giveGift(db, 'ball', MONDAY)).toEqual({ before: 'normal', after: 'normal' });
  });

  it('keeps the mood up until the change of day, then it follows the last 3 days again', () => {
    const db = sadPuppy();
    giveGift(db, 'cookie', clockAt(FRIDAY + 3, 23));
    // Still Monday's game day until 06:00 of Tuesday.
    expect(getCompanionView(db, clockAt(FRIDAY + 4, 5)).mood).toBe('normal');
    expect(getCompanionView(db, clockAt(FRIDAY + 4, 7))).toMatchObject({
      giftToday: false,
      giftRaised: false,
    });
  });

  it('can be given to a happy companion, which cheers while the mood stays', () => {
    const db = sadPuppy();
    completeMission(db, { missionId: missionId(db, 'meditation'), source: 'app', ...MONDAY });
    expect(giveGift(db, 'cookie', MONDAY)).toEqual({ before: 'happy', after: 'happy' });
    expect(getCompanionView(db, MONDAY)).toMatchObject({ giftToday: true, giftRaised: false });
    expectHeroMatchesLog(db);
  });

  it('refuses a gift not owned, an unknown gift and a gift to the egg', () => {
    const db = sadPuppy();
    expect(() => giveGift(db, 'candy', MONDAY)).toThrow(RangeError);
    expect(() => giveGift(db, 'potion' as never, MONDAY)).toThrow(RangeError);
    db.update(companion).set({ stage: 'egg' }).run();
    expect(() => giveGift(db, 'cookie', MONDAY)).toThrow(RangeError);
    expect(getShopView(db).gifts.find((gift) => gift.key === 'cookie')?.owned).toBe(1);
    expect(db.select().from(events).where(eq(events.type, 'companion.gift')).all()).toEqual([]);
  });
});

describe('evolution of the companion', () => {
  it('becomes an adult at the 150th completion, with the moment and the notice in Today', () => {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'baby', completionsTotal: 149 }).run();
    expect(getCompanionView(db, NOW).growth).toMatchObject({ done: 149, target: 150, left: 1 });

    const result = completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...NOW,
    });

    expect(result.moments.map((event) => [event.type, event.payload])).toEqual([
      ['companion.stage_up', { from: 'baby', to: 'adult' }],
    ]);
    expect(getCompanionView(db, NOW)).toMatchObject({
      stage: 'adult',
      growth: { stageNumber: 3, done: 150, target: null, left: 0 },
    });
    expect(getTodayView(db, NOW).notices.companionGrewTo).toBe('adult');
    // The notice stays for the day of the change only.
    expect(getTodayView(db, clockAt(FRIDAY + 1, 10)).notices.companionGrewTo).toBeNull();
  });
});

describe('renameCompanion', () => {
  it('stores the chosen name and logs it', () => {
    const db = newGame(['meditation']);
    expect(renameCompanion(db, '  Fiocco ', 'Cloudy', NOW)).toBe('Fiocco');
    expect(db.select().from(companion).get()?.name).toBe('Fiocco');
    const [event] = renamedEvents(db);
    expect(event).toMatchObject({
      occurredAt: NOW.now,
      tzOffset: NOW.tzOffset,
      source: 'app',
      gameDay: '2026-11-06',
      payload: { from: null, to: 'Fiocco' },
      dXp: 0,
      dCoins: 0,
    });
    expect(getCompanionView(db, NOW).name).toBe('Fiocco');
    expectHeroMatchesLog(db);
  });

  it('goes back to the default of the theme with an empty name or the default itself', () => {
    const db = newGame(['meditation']);
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(renameCompanion(db, '   ', 'Cloudy', NOW)).toBeNull();
    expect(db.select().from(companion).get()?.name).toBeNull();
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(renameCompanion(db, 'Cloudy', 'Cloudy', NOW)).toBeNull();
    expect(renamedEvents(db).map((event) => event.payload)).toEqual([
      { from: null, to: 'Fiocco' },
      { from: 'Fiocco', to: null },
      { from: null, to: 'Fiocco' },
      { from: 'Fiocco', to: null },
    ]);
  });

  it('writes nothing when the name does not change', () => {
    const db = newGame(['meditation']);
    renameCompanion(db, 'Cloudy', 'Cloudy', NOW);
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    renameCompanion(db, ' Fiocco', 'Cloudy', NOW);
    expect(renamedEvents(db)).toHaveLength(1);
  });

  it('refuses a name longer than 20 characters and changes nothing', () => {
    const db = newGame(['meditation']);
    expect(() => renameCompanion(db, 'A'.repeat(21), 'Cloudy', NOW)).toThrow(RangeError);
    expect(db.select().from(companion).get()?.name).toBeNull();
    expect(renamedEvents(db)).toEqual([]);
  });

  it('keeps a chosen name when the theme changes, while the default follows the theme', () => {
    const db = newGame(['meditation']);
    // Default in Minimal: the name stays null, so Arcade shows its own default.
    renameCompanion(db, 'Cloudy', 'Cloudy', NOW);
    expect(getCompanionView(db, NOW).name).toBeNull();
    // Chosen in Minimal, then the user moves to Arcade and types the Arcade default: back to null.
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(getCompanionView(db, NOW).name).toBe('Fiocco');
    renameCompanion(db, 'Pixel', 'Pixel', NOW);
    expect(getCompanionView(db, NOW).name).toBeNull();
  });
});
