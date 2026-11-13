import { and, count, eq } from 'drizzle-orm';

import {
  growthOf,
  moodWindowOf,
  storedCompanionName,
  type Growth,
  type MoodWindow,
} from '../../rules/companion';
import { companion, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { appendEvent, notDeleted } from './events';
import type { ActionClock } from './hero';
import { gameDayOf, getSetting } from './settings';
import { companionOn, moodDaysBefore, type TodayView } from './todayView';

// The companion sheet (analisi-funzionale.md section 6, US-COMP-01, US-COMP-03; design-sezioni.md
// 6.2, 6.7, 6.9): what it shows and the change of name.

export interface CompanionView extends Readonly<TodayView['companion']> {
  readonly growth: Growth;
  /** The missions of the last 3 closed days, for the mood card (design-sezioni.md 6.3). */
  readonly moodWindow: MoodWindow;
  /** Completions of the open day: one is enough to make the companion happy (choice 13). */
  readonly doneToday: number;
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
  return {
    ...current,
    growth: growthOf(current.stage, total),
    moodWindow: moodWindowOf(moodDaysBefore(db, day)),
    doneToday,
  };
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
