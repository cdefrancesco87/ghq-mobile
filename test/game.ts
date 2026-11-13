import { eq } from 'drizzle-orm';

import { createProfile } from '@/db/repositories/onboarding';
import { BADGE_LIST } from '@/content/badges';
import { badges, missions } from '@/db/schema';
import type { Db } from '@/db/types';

import { createTestDb, heroTotals, totalsFromLog } from './db';

// A game ready to play for the tests of the repositories: a profile created in Rome on Friday
// 6 November 2026 (UTC+1, day change at 06:00).

/** Minutes east of UTC in Rome in November. */
export const TZ = 60;

/** An instant in Rome on a day of November 2026. */
export const at = (day: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, day, hour - 1, minute);

/** The clock of an action at the given day and hour in Rome. */
export const clockAt = (day: number, hour: number) => ({ now: at(day, hour), tzOffset: TZ });

export const FRIDAY = 6;

export function newGame(templateKeys: string[], day = FRIDAY): Db {
  const db = createTestDb();
  createProfile(
    db,
    { name: 'Claudio', language: 'it', theme: 'minimal', templateKeys },
    clockAt(day, 9),
  );
  return db;
}

export function missionId(db: Db, templateKey: string): string {
  const row = db
    .select({ id: missions.id })
    .from(missions)
    .where(eq(missions.templateKey, templateKey))
    .get();
  if (row === undefined) {
    throw new Error(`No mission from template ${templateKey}`);
  }
  return row.id;
}

/** The hero and the stats always add up to the event log (modello-dati.md, 4.3). */
export function expectHeroMatchesLog(db: Db): void {
  expect(heroTotals(db)).toEqual(totalsFromLog(db));
}

/**
 * Marks every badge as already unlocked, without coins or events: for the tests of other screens,
 * whose gains and moments must not change with the badges (backlog T70).
 */
export function withBadgesUnlocked(db: Db): Db {
  db.insert(badges)
    .values(BADGE_LIST.map((badge) => ({ badgeKey: badge.key, unlockedAt: 0 })))
    .onConflictDoNothing()
    .run();
  return db;
}
