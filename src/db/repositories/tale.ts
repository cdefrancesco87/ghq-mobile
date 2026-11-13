import { and, asc, desc, eq, lte } from 'drizzle-orm';

import type { Mood } from '../../rules/companion';
import { addDays } from '../../rules/gameDay';
import { isPausedDay } from '../../rules/pause';
import {
  ENCOURAGEMENT,
  absentDays,
  isStreakRecord,
  pickVariant,
  rememberVariants,
  taleSituation,
  voiceOf,
  type TaleSituation,
  type TaleVoice,
} from '../../rules/tale';
import type { GameDay } from '../../rules/types';
import { boss, daySummaries, events, hero } from '../schema';
import type { Db } from '../types';
import type { ActionClock } from './hero';
import { getGeneralPause } from './pause';
import { gameDayOf, getSetting, setSetting } from './settings';

// The morning bubble of the companion (US-COMP-05; design-sezioni.md 2.2, 6.14): at the first
// opening of the game day the app chooses what the companion tells about yesterday, remembers the
// opening and the texts used, and does not tell again until tomorrow.

export interface TaleBubble {
  readonly day: GameDay;
  readonly situation: TaleSituation;
  readonly mood: Mood;
  readonly voice: TaleVoice;
  /** The keys of the texts: the sentence about yesterday, then the encouragement for today. */
  readonly keys: readonly string[];
  /** The numbers and names the texts can use (`racconto-compagno-testi.md`, placeholders). */
  readonly params: {
    readonly done: number;
    readonly scheduled: number;
    readonly streak: number;
    /** Days of absence or of pause, for the two situations of the return. */
    readonly days: number;
    /** The boss defeated yesterday; the name of the starter quest is an i18n key. */
    readonly boss: { readonly name: string; readonly starter: boolean } | null;
  };
}

export interface TaleOpening {
  /** The mood the companion shows now: the texts of the morning have one variant per mood. */
  readonly mood: Mood;
  /** The keys of the variants of a group of texts, e.g. `tale.cloudy.fullDay.happy`. */
  readonly variants: (group: string) => readonly string[];
  readonly random?: () => number;
}

/** The days of general pause that ended with `day`, counted backwards. */
function pausedDaysUntil(db: Db, day: GameDay): number {
  const rows = db
    .select({ gameDay: daySummaries.gameDay, isPaused: daySummaries.isPaused })
    .from(daySummaries)
    .where(lte(daySummaries.gameDay, day))
    .orderBy(desc(daySummaries.gameDay))
    .all();
  let count = 0;
  let expected = day;
  for (const row of rows) {
    if (row.gameDay !== expected || !row.isPaused) {
      break;
    }
    count++;
    expected = addDays(expected, -1);
  }
  return count;
}

/** The streak of the hero at the close of every day up to `day`, oldest first. */
function closedStreaks(db: Db, day: GameDay): number[] {
  return db
    .select({ payload: events.payload })
    .from(events)
    .where(and(eq(events.type, 'day.closed'), lte(events.gameDay, day)))
    .orderBy(asc(events.gameDay), asc(events.seq))
    .all()
    .map((row) => {
      const streak = (row.payload as { heroStreak?: unknown } | null)?.heroStreak;
      return typeof streak === 'number' ? streak : 0;
    });
}

function defeatedOn(db: Db, day: GameDay): TaleBubble['params']['boss'] {
  const row = db
    .select({ name: boss.name, kind: boss.kind })
    .from(events)
    .innerJoin(boss, eq(boss.id, events.bossId))
    .where(and(eq(events.type, 'boss.defeated'), eq(events.gameDay, day)))
    .orderBy(desc(events.seq))
    .get();
  return row === undefined ? null : { name: row.name, starter: row.kind === 'starter' };
}

/**
 * Records an opening of the app and gives the morning bubble when this is the first opening of
 * the game day and the companion has something to tell; null otherwise (already shown today,
 * no profile, first day, general pause, nothing expected yesterday, design 6.14). The day of
 * the opening is saved every time, in pause and on the first day too.
 */
export function openTale(
  db: Db,
  clock: ActionClock,
  { mood, variants, random }: TaleOpening,
): TaleBubble | null {
  return db.transaction((tx) => {
    const today = gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
    const tale = getSetting(tx, 'tale');
    const opened = { ...tale, last_open_day: today };
    const player = tx.select().from(hero).get();
    if (tale.shown_day === today || player === undefined) {
      setSetting(tx, 'tale', opened, clock.now);
      return null;
    }
    const yesterday = addDays(today, -1);
    const pause = getGeneralPause(tx);
    const pausedToday = pause !== null && isPausedDay(today, [pause]);
    const summary = tx.select().from(daySummaries).where(eq(daySummaries.gameDay, yesterday)).get();
    const defeated = defeatedOn(tx, yesterday);
    const situation = taleSituation({
      today,
      pausedToday,
      yesterday:
        summary === undefined
          ? null
          : {
              scheduled: summary.scheduledCount,
              done: summary.doneCount,
              restDay: summary.isRestDay,
            },
      lastOpenDay: tale.last_open_day,
      pauseEndedYesterday: summary?.isPaused === true && !pausedToday,
      bossDefeatedYesterday: defeated !== null,
      streakRecord: summary !== undefined && isStreakRecord(closedStreaks(tx, yesterday)),
      gameMode: getSetting(tx, 'game_mode'),
    });
    const voice = voiceOf(getSetting(tx, 'theme'));
    const about =
      situation === null
        ? null
        : pickVariant(variants(`tale.${voice}.${situation}.${mood}`), tale.recent, random);
    if (situation === null || about === null) {
      setSetting(tx, 'tale', opened, clock.now);
      return null;
    }
    const encouragement = pickVariant(
      variants(`tale.${voice}.${ENCOURAGEMENT}.${mood}`),
      tale.recent,
      random,
    );
    const keys = encouragement === null ? [about] : [about, encouragement];
    setSetting(
      tx,
      'tale',
      { shown_day: today, last_open_day: today, recent: rememberVariants(tale.recent, keys) },
      clock.now,
    );
    return {
      day: today,
      situation,
      mood,
      voice,
      keys,
      params: {
        done: summary?.doneCount ?? 0,
        scheduled: summary?.scheduledCount ?? 0,
        streak: player.streak,
        days:
          situation === 'pauseReturn'
            ? pausedDaysUntil(tx, yesterday)
            : absentDays(tale.last_open_day, today),
        boss: situation === 'bossDefeated' ? defeated : null,
      },
    };
  });
}
