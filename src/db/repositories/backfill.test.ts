import { and, eq } from 'drizzle-orm';

import { backfillCompletion, listBackfillCandidates } from '@/db/repositories/backfill';
import { closePendingDays } from '@/db/repositories/closing';
import { completeMission, skipMission } from '@/db/repositories/completion';
import { getQuestLog } from '@/db/repositories/questLog';
import { deleteMission } from '@/db/repositories/missions';
import { companion, daySummaries, events, hero, missionDays, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { DIFFICULTY_VALUES } from '@/rules/config';
import type { GameDay } from '@/rules/types';

import { at, clockAt, expectHeroMatchesLog, missionId, newGame, TZ } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome; "today" is Monday 16 November, so the days
// that can be corrected go from 9 to 15 November.

const DAILY = ['journal', 'no_social_evening'];
const TODAY = 16;

function complete(db: Db, key: string, day: number) {
  closePendingDays(db, clockAt(day, 9));
  completeMission(db, {
    missionId: missionId(db, key),
    source: 'app',
    now: at(day, 10),
    tzOffset: TZ,
  });
}

/** Journal done on the 6th, 8th and 14th; the rest of the days closed up to today. */
function game(): Db {
  const db = newGame(DAILY);
  complete(db, 'journal', 6);
  complete(db, 'journal', 8);
  complete(db, 'journal', 14);
  closePendingDays(db, clockAt(TODAY, 9));
  return db;
}

const backfill = (db: Db, key: string, day: GameDay) =>
  backfillCompletion(db, {
    missionId: missionId(db, key),
    day,
    now: at(TODAY, 11),
    tzOffset: TZ,
  });

const heroRow = (db: Db) => db.select().from(hero).get()!;

describe('listBackfillCandidates', () => {
  it('lists the missions expected and not done in the 7 days before today, the latest first', () => {
    const db = game();
    const days = listBackfillCandidates(db, clockAt(TODAY, 11));
    expect(days.map((item) => item.day)).toEqual([
      '2026-11-15',
      '2026-11-14',
      '2026-11-13',
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
      '2026-11-09',
    ]);
    const names = (day: GameDay) =>
      days.find((item) => item.day === day)?.missions.map((mission) => mission.templateKey);
    expect(names('2026-11-15' as GameDay)).toEqual(['journal', 'no_social_evening']);
    expect(names('2026-11-14' as GameDay)).toEqual(['no_social_evening']);
  });

  it('leaves out the skipped missions, the deleted ones and the days with nothing left', () => {
    const db = newGame(DAILY);
    closePendingDays(db, clockAt(15, 9));
    skipMission(db, {
      missionId: missionId(db, 'journal'),
      reason: 'rest',
      now: at(15, 10),
      tzOffset: TZ,
    });
    completeMission(db, {
      missionId: missionId(db, 'no_social_evening'),
      source: 'app',
      now: at(15, 11),
      tzOffset: TZ,
    });
    closePendingDays(db, clockAt(TODAY, 9));
    expect(listBackfillCandidates(db, clockAt(TODAY, 11)).map((item) => item.day)).not.toContain(
      '2026-11-15',
    );
    deleteMission(db, missionId(db, 'journal'), clockAt(TODAY, 10));
    const days = listBackfillCandidates(db, clockAt(TODAY, 11));
    expect(days.flatMap((item) => item.missions.map((mission) => mission.templateKey))).toEqual(
      Array(6).fill('no_social_evening'),
    );
  });

  it('gives only the days of the 7 after the start of the game', () => {
    const db = newGame(DAILY);
    closePendingDays(db, clockAt(8, 9));
    expect(listBackfillCandidates(db, clockAt(8, 11)).map((item) => item.day)).toEqual([
      '2026-11-07',
      '2026-11-06',
    ]);
  });

  it('can read a single day', () => {
    const db = game();
    expect(
      listBackfillCandidates(db, clockAt(TODAY, 11), '2026-11-14' as GameDay).map(
        (item) => item.day,
      ),
    ).toEqual(['2026-11-14']);
    expect(listBackfillCandidates(db, clockAt(TODAY, 11), '2026-11-08' as GameDay)).toEqual([]);
  });
});

describe('backfillCompletion', () => {
  it('gives base XP and coins without the streak multiplier, and no hit points back', () => {
    const db = game();
    // A long streak of the hero would give ×1.2 to a completion of today.
    db.update(hero).set({ streak: 30 }).run();
    const before = heroRow(db);
    const mission = db
      .select()
      .from(missions)
      .where(eq(missions.id, missionId(db, 'no_social_evening')))
      .get()!;
    const values = DIFFICULTY_VALUES[mission.difficulty];
    const result = backfill(db, 'no_social_evening', '2026-11-12' as GameDay);
    expect(result.xp).toBe(values.xp);
    expect(result.coins).toBe(values.coins);
    const after = heroRow(db);
    expect(after.xpTotal - before.xpTotal).toBe(values.xp);
    expect(after.coins - before.coins).toBe(values.coins);
    expect(after.hp).toBe(before.hp);
    expect(after.streak).toBe(30);
    expectHeroMatchesLog(db);
  });

  it('writes the event on the corrected day and marks the mission done there', () => {
    const db = game();
    const id = missionId(db, 'no_social_evening');
    const result = backfill(db, 'no_social_evening', '2026-11-12' as GameDay);
    const event = db.select().from(events).where(eq(events.id, result.eventId)).get()!;
    expect(event).toMatchObject({
      type: 'mission.backfilled',
      source: 'backfill',
      gameDay: '2026-11-12',
      missionId: id,
      occurredAt: at(TODAY, 11),
      dHp: 0,
    });
    const row = db
      .select()
      .from(missionDays)
      .where(and(eq(missionDays.missionId, id), eq(missionDays.gameDay, '2026-11-12' as GameDay)))
      .get();
    expect(row).toMatchObject({ status: 'done', source: 'backfill' });
    const summary = db
      .select()
      .from(daySummaries)
      .where(eq(daySummaries.gameDay, '2026-11-12' as GameDay))
      .get();
    expect(summary).toMatchObject({ doneCount: 1, scheduledCount: 2, hpLost: expect.any(Number) });
    // It is no longer a candidate, and the Registro shows it on its day.
    const days = listBackfillCandidates(db, clockAt(TODAY, 11));
    expect(days.find((item) => item.day === '2026-11-12')?.missions).toHaveLength(1);
    const log = getQuestLog(db, clockAt(TODAY, 11), { filter: 'completions' });
    expect(log.days.find((day) => day.day === '2026-11-12')?.entries[0]).toMatchObject({
      type: 'mission.backfilled',
    });
  });

  it('does not repair a broken streak of the mission', () => {
    const db = game();
    const id = missionId(db, 'journal');
    const before = db.select().from(missions).where(eq(missions.id, id)).get()!;
    backfill(db, 'journal', '2026-11-13' as GameDay);
    backfill(db, 'journal', '2026-11-15' as GameDay);
    const after = db.select().from(missions).where(eq(missions.id, id)).get()!;
    expect(after.streak).toBe(before.streak);
    expect(after.streakBest).toBe(before.streakBest);
  });

  it('counts for the companion', () => {
    const db = game();
    const before = db.select().from(companion).get()!.completionsTotal;
    backfill(db, 'journal', '2026-11-15' as GameDay);
    expect(db.select().from(companion).get()!.completionsTotal).toBe(before + 1);
  });

  it('refuses a day out of the 7, today, and a mission done, skipped or not expected', () => {
    const db = game();
    expect(() => backfill(db, 'journal', '2026-11-08' as GameDay)).toThrow(RangeError);
    expect(() => backfill(db, 'journal', '2026-11-16' as GameDay)).toThrow(RangeError);
    expect(() => backfill(db, 'journal', '2026-11-17' as GameDay)).toThrow(RangeError);
    expect(() => backfill(db, 'journal', '2026-11-14' as GameDay)).toThrow(RangeError);
    backfill(db, 'journal', '2026-11-13' as GameDay);
    expect(() => backfill(db, 'journal', '2026-11-13' as GameDay)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });

  it('writes the level-up and returns its moment', () => {
    const db = game();
    const hero0 = heroRow(db);
    // Close to level 2 (200 XP).
    db.transaction((tx) => {
      tx.update(hero).set({ xpTotal: 195, xpInLevel: 195 }).where(eq(hero.id, hero0.id)).run();
    });
    const result = backfill(db, 'journal', '2026-11-15' as GameDay);
    expect(result.moments.map((event) => event.type)).toContain('hero.level_up');
    expect(heroRow(db).level).toBe(2);
  });

  it('keeps the hero equal to the sum of the log after several corrections', () => {
    const db = game();
    for (const day of ['2026-11-09', '2026-11-10', '2026-11-11'] as GameDay[]) {
      backfill(db, 'journal', day);
      backfill(db, 'no_social_evening', day);
    }
    expectHeroMatchesLog(db);
  });
});
