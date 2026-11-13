import { and, count, eq } from 'drizzle-orm';

import { isGiftKey, type GiftKey } from '../../content/shop';
import {
  growthOf,
  moodFor,
  moodWindowOf,
  storedCompanionName,
  type Growth,
  type Mood,
  type MoodWindow,
} from '../../rules/companion';
import { companion, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { appendEvent, notDeleted } from './events';
import type { ActionClock } from './hero';
import { gameDayOf, getSetting } from './settings';
import { addToInventory, owned } from './shop';
import { companionOn, giftGivenOn, moodDaysBefore, type TodayView } from './todayView';

// The companion sheet (analisi-funzionale.md section 6, US-COMP-01, US-COMP-03, US-COMP-04;
// design-sezioni.md 6.2, 6.7, 6.8, 6.9): what it shows, the change of name and the gifts.

export interface CompanionView extends Readonly<TodayView['companion']> {
  readonly growth: Growth;
  /** The missions of the last 3 closed days, for the mood card (design-sezioni.md 6.3). */
  readonly moodWindow: MoodWindow;
  /** Completions of the open day: one is enough to make the companion happy (choice 13). */
  readonly doneToday: number;
  /** A gift was given today: the mood is one level up until the change of day (US-COMP-04). */
  readonly giftToday: boolean;
  /** The gift of today really changed the mood (it was not happy already). */
  readonly giftRaised: boolean;
}

/** The companion on the game day of `clock`: stage, stored name, mood with its reason, growth. */
export function getCompanionView(db: Db, clock: { now: number; tzOffset: number }): CompanionView {
  const day = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
  const doneToday =
    db
      .select({ value: count() })
      .from(missionDays)
      .innerJoin(missions, eq(missions.id, missionDays.missionId))
      .where(
        and(eq(missionDays.gameDay, day), eq(missionDays.status, 'done'), notDeleted(missions)),
      )
      .get()?.value ?? 0;
  const current = companionOn(db, day, doneToday);
  const total = db.select().from(companion).get()?.completionsTotal ?? 0;
  const lastDays = moodDaysBefore(db, day);
  const giftToday = giftGivenOn(db, day);
  return {
    ...current,
    growth: growthOf(current.stage, total),
    moodWindow: moodWindowOf(lastDays),
    doneToday,
    giftToday,
    giftRaised: giftToday && moodFor(lastDays, doneToday) !== current.mood,
  };
}

/** What a gift did: the mood before and after it (the same when the companion was happy). */
export interface GiftResult {
  readonly before: Mood;
  readonly after: Mood;
}

/**
 * Gives a gift of the inventory to the companion (US-COMP-04, design-sezioni.md 6.8): one gift less
 * and the `companion.gift` event, which raises the mood one level until the change of day. It can
 * be given even when the companion is already happy (6.8 ★): it cheers, the mood stays. No coins,
 * XP or hit points: the hero does not change.
 *
 * @throws RangeError for an unknown gift, a gift not owned, or the egg, which has no mood yet.
 */
export function giveGift(db: Db, giftKey: GiftKey, clock: ActionClock): GiftResult {
  if (!isGiftKey(giftKey)) {
    throw new RangeError(`Unknown gift: ${String(giftKey)}`);
  }
  return db.transaction((tx) => {
    if (owned(tx, giftKey) === 0) {
      throw new RangeError(`There is no ${giftKey} in the inventory`);
    }
    const day = gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
    const before = getCompanionView(tx, clock);
    if (before.stage === 'egg') {
      throw new RangeError('The egg cannot receive a gift');
    }
    addToInventory(tx, giftKey, -1);
    appendEvent(tx, {
      type: 'companion.gift',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      gameDay: day,
      itemKey: giftKey,
      payload: { moodBefore: before.mood },
    });
    return { before: before.mood, after: getCompanionView(tx, clock).mood };
  });
}

/**
 * Renames the companion (US-COMP-03) with the `companion.renamed` event. An empty name, or the
 * default of the theme in use, stores null, so that the name keeps following the theme
 * (design-sezioni.md 6.9). Nothing is written when the name does not change.
 *
 * @param themeDefault The default name of the companion in the theme in use.
 * @returns The stored name: null for the default of the theme.
 * @throws RangeError when the name is longer than 20 characters.
 */
export function renameCompanion(
  db: Db,
  typed: string,
  themeDefault: string,
  clock: ActionClock,
): string | null {
  const name = storedCompanionName(typed, themeDefault);
  return db.transaction((tx) => {
    const before = tx.select({ name: companion.name }).from(companion).get()?.name ?? null;
    if (before === name) {
      return name;
    }
    tx.update(companion).set({ name }).where(eq(companion.id, 'companion')).run();
    appendEvent(tx, {
      type: 'companion.renamed',
      occurredAt: clock.now,
      tzOffset: clock.tzOffset,
      source: clock.source ?? 'app',
      payload: { from: before, to: name },
    });
    return name;
  });
}
