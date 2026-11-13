import { eq } from 'drizzle-orm';

import { archiveBoss, completeBossStep, createBoss, deleteBoss } from '@/db/repositories/boss';
import { completeMission } from '@/db/repositories/completion';
import { appendEvent } from '@/db/repositories/events';
import { deleteMission, updateMission } from '@/db/repositories/missions';
import { getProfileView, getStatDetail, renameHero } from '@/db/repositories/profile';
import { undoEvent } from '@/db/repositories/undo';
import { bossSteps, events, hero, heroStats, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import type { GameDay, StatKey } from '@/rules/types';
import { PROFILE } from '@/rules/config';

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

const setPoints = (db: Db, stat: 'strength' | 'wisdom', points: number) =>
  db.update(heroStats).set({ points }).where(eq(heroStats.statKey, stat)).run();

function newBoss(db: Db, name: string, steps = ['Uno', 'Due', 'Tre']) {
  return createBoss(
    db,
    { name, steps, difficulty: 'medium', statKey: 'wisdom', deadlineDay: null, missionIds: [] },
    clockAt(FRIDAY, 9),
  );
}

function firstStep(db: Db, bossId: string): string {
  const step = db.select().from(bossSteps).where(eq(bossSteps.bossId, bossId)).get();
  if (step === undefined) {
    throw new Error('No step');
  }
  return step.id;
}

describe('getProfileView', () => {
  it('starts with every stat at 0 and nothing done', () => {
    const db = newGame(['journal']);
    const view = getProfileView(db, clockAt(FRIDAY, 10));
    expect(view.hero.name).toBe('Claudio');
    expect(view.xpToNext).toBe(200);
    expect(view.completionsTotal).toBe(0);
    expect(view.bossesDefeated).toBe(0);
    expect(view.stats.map((row) => row.stat)).toEqual([
      'strength',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
      'discipline',
    ]);
    expect(view.stats.every((row) => row.points === 0 && row.progress.level === 0)).toBe(true);
    expect(view.companion.stage).toBe('egg');
  });

  it('gives the level of every stat from its points, up to Max at level 10', () => {
    const db = newGame(['journal']);
    setPoints(db, 'strength', 1340);
    setPoints(db, 'wisdom', 6000);
    const { stats } = getProfileView(db, clockAt(FRIDAY, 10));
    expect(stats.find((row) => row.stat === 'strength')?.progress).toEqual({
      level: 4,
      inLevel: 340,
      toNext: 500,
      max: false,
    });
    expect(stats.find((row) => row.stat === 'wisdom')?.progress.max).toBe(true);
  });

  it('counts the completions of every day, without the deleted missions', () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    const read = missionId(db, 'read_pages');
    complete(db, journal, FRIDAY);
    complete(db, journal, FRIDAY + 1);
    complete(db, read, FRIDAY + 1);
    expect(getProfileView(db, clockAt(FRIDAY + 1, 12)).completionsTotal).toBe(3);
    deleteMission(db, read, clockAt(FRIDAY + 1, 13));
    expect(getProfileView(db, clockAt(FRIDAY + 1, 14)).completionsTotal).toBe(2);
  });

  it('counts the defeated bosses, not the active, archived or deleted ones', () => {
    const db = newGame(['journal']);
    for (const name of ['Tesi', 'Trasloco']) {
      const won = newBoss(db, name, ['Uno', 'Due']);
      for (const step of db.select().from(bossSteps).where(eq(bossSteps.bossId, won.id)).all()) {
        completeBossStep(db, step.id, clockAt(FRIDAY, 10));
      }
    }
    newBoss(db, 'Ancora in corso');
    archiveBoss(db, newBoss(db, 'Archiviato').id, clockAt(FRIDAY, 11));
    deleteBoss(db, newBoss(db, 'Eliminato').id, clockAt(FRIDAY, 11));
    expect(getProfileView(db, clockAt(FRIDAY, 12)).bossesDefeated).toBe(2);
  });

  it('has no XP to the next level at the highest level', () => {
    const db = newGame(['journal']);
    db.update(hero).set({ level: 50, xpInLevel: 0 }).run();
    expect(getProfileView(db, clockAt(FRIDAY, 10)).xpToNext).toBeNull();
  });
});

describe('form arrow in getProfileView', () => {
  // Today is Friday 6 November: the last 30 days go from 8 October, the 30 before from 8 September.
  const gain = (db: Db, gameDay: string, stat: StatKey, points: number) =>
    appendEvent(db, {
      type: 'mission.completed',
      occurredAt: at(FRIDAY, 10),
      tzOffset: TZ,
      source: 'app',
      gameDay: gameDay as GameDay,
      deltas: { stats: { [stat]: points } },
    });
  const formOf = (db: Db, stat: StatKey) =>
    getProfileView(db, clockAt(FRIDAY, 10)).stats.find((row) => row.stat === stat)?.form;

  it('has no arrow in the first 30 days of use', () => {
    const db = newGame(['journal'], FRIDAY - 29);
    gain(db, '2026-11-06', 'strength', 100);
    expect(formOf(db, 'strength')).toBeNull();
  });

  it('shows up, down or nothing after 30 days, from the points of the two windows', () => {
    const db = newGame(['journal'], FRIDAY - 30);
    gain(db, '2026-10-08', 'strength', 110);
    gain(db, '2026-10-07', 'strength', 100);
    gain(db, '2026-11-06', 'wisdom', 90);
    gain(db, '2026-09-08', 'wisdom', 100);
    gain(db, '2026-09-07', 'wisdom', 500);
    gain(db, '2026-11-01', 'charisma', 105);
    gain(db, '2026-10-01', 'charisma', 100);
    expect(formOf(db, 'strength')).toBe('up');
    expect(formOf(db, 'wisdom')).toBe('down');
    expect(formOf(db, 'charisma')).toBeNull();
    expect(formOf(db, 'discipline')).toBeNull();
  });

  it('leaves out the undone gains', () => {
    const db = newGame(['journal'], FRIDAY - 40);
    gain(db, '2026-10-01', 'strength', 100);
    const { event } = gain(db, '2026-11-06', 'strength', 200);
    expect(formOf(db, 'strength')).toBe('up');
    appendEvent(db, {
      type: 'event.reverted',
      occurredAt: at(FRIDAY, 11),
      tzOffset: TZ,
      source: 'app',
      gameDay: '2026-11-06' as GameDay,
      revertsId: event.id,
      deltas: { stats: { strength: -200 } },
    });
    expect(formOf(db, 'strength')).toBe('down');
  });
});

describe('getStatDetail', () => {
  it('gives points, level and the missions that feed the stat, primary or secondary', () => {
    const db = newGame(['journal', 'meditation', 'read_pages', 'run']);
    const run = missionId(db, 'run');
    updateMission(db, run, { statSecondary: 'wisdom' }, clockAt(FRIDAY, 9));
    setPoints(db, 'wisdom', 340);
    const detail = getStatDetail(db, 'wisdom', clockAt(FRIDAY, 10));
    expect(detail.points).toBe(340);
    expect(detail.progress).toEqual({ level: 2, inLevel: 40, toNext: 300, max: false });
    expect(detail.today).toBe('2026-11-06');
    expect(detail.missions.map((row) => row.id).sort()).toEqual(
      [run, missionId(db, 'journal'), missionId(db, 'meditation')].sort(),
    );
    expect(detail.missions.find((row) => row.id === run)?.name).toBe(nameOf(db, run));
  });

  it('leaves out the deleted and the archived missions', () => {
    const db = newGame(['journal', 'meditation']);
    deleteMission(db, missionId(db, 'journal'), clockAt(FRIDAY, 9));
    const detail = getStatDetail(db, 'wisdom', clockAt(FRIDAY, 10));
    expect(detail.missions.map((row) => row.id)).toEqual([missionId(db, 'meditation')]);
  });

  it('lists the latest gains from the log, newest first, with mission or boss name', () => {
    const db = newGame(['journal', 'meditation']);
    const journal = missionId(db, 'journal');
    const meditation = missionId(db, 'meditation');
    const boss = newBoss(db, 'Tesi');
    complete(db, journal, FRIDAY, 10);
    completeBossStep(db, firstStep(db, boss.id), clockAt(FRIDAY, 11));
    complete(db, meditation, FRIDAY + 1, 10);
    const { gains } = getStatDetail(db, 'wisdom', clockAt(FRIDAY + 1, 12));
    expect(gains).toEqual([
      expect.objectContaining({ points: 20, name: nameOf(db, meditation), gameDay: '2026-11-07' }),
      expect.objectContaining({ points: 10, name: 'Tesi', gameDay: '2026-11-06' }),
      expect.objectContaining({ points: 10, name: nameOf(db, journal), gameDay: '2026-11-06' }),
    ]);
    expect(getStatDetail(db, 'strength', clockAt(FRIDAY + 1, 12)).gains).toEqual([]);
  });

  it('leaves out the undone gains and those of deleted missions and bosses', () => {
    const db = newGame(['journal', 'meditation']);
    const journal = missionId(db, 'journal');
    const meditation = missionId(db, 'meditation');
    const boss = newBoss(db, 'Tesi');
    const done = complete(db, journal);
    complete(db, meditation);
    completeBossStep(db, firstStep(db, boss.id), clockAt(FRIDAY, 11));
    undoEvent(db, done.completion?.eventId ?? '', clockAt(FRIDAY, 12));
    deleteMission(db, meditation, clockAt(FRIDAY, 13));
    deleteBoss(db, boss.id, clockAt(FRIDAY, 13));
    expect(getStatDetail(db, 'wisdom', clockAt(FRIDAY, 14)).gains).toEqual([]);
    expectHeroMatchesLog(db);
  });

  it('keeps the gains of a mission whose boss was deleted', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    const boss = createBoss(
      db,
      {
        name: 'Tesi',
        steps: ['Uno', 'Due'],
        difficulty: 'medium',
        statKey: null,
        deadlineDay: null,
        missionIds: [journal],
      },
      clockAt(FRIDAY, 9),
    );
    complete(db, journal);
    deleteBoss(db, boss.id, clockAt(FRIDAY, 11));
    expect(getStatDetail(db, 'wisdom', clockAt(FRIDAY, 12)).gains).toHaveLength(1);
  });

  it(`shows at most ${PROFILE.recentGainsMax} gains`, () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    for (let day = FRIDAY; day < FRIDAY + PROFILE.recentGainsMax + 2; day++) {
      complete(db, journal, day);
    }
    const { gains } = getStatDetail(db, 'wisdom', clockAt(FRIDAY + 8, 12));
    expect(gains).toHaveLength(PROFILE.recentGainsMax);
    expect(gains[0].gameDay).toBe('2026-11-12');
  });
});

describe('renameHero', () => {
  it('changes the name with the hero.renamed event', () => {
    const db = newGame(['journal']);
    expect(renameHero(db, '  Aria  ', clockAt(FRIDAY, 10))).toBe('Aria');
    expect(db.select().from(hero).get()?.name).toBe('Aria');
    const renamed = db.select().from(events).where(eq(events.type, 'hero.renamed')).all();
    expect(renamed).toHaveLength(1);
    expect(renamed[0].payload).toEqual({ from: 'Claudio', to: 'Aria' });
    expectHeroMatchesLog(db);
  });

  it('writes nothing when the name does not change', () => {
    const db = newGame(['journal']);
    expect(renameHero(db, 'Claudio ', clockAt(FRIDAY, 10))).toBe('Claudio');
    expect(db.select().from(events).where(eq(events.type, 'hero.renamed')).all()).toEqual([]);
  });

  it(`refuses an empty name and one longer than ${PROFILE.nameMaxLength} characters`, () => {
    const db = newGame(['journal']);
    expect(() => renameHero(db, '   ', clockAt(FRIDAY, 10))).toThrow(RangeError);
    expect(() =>
      renameHero(db, 'x'.repeat(PROFILE.nameMaxLength + 1), clockAt(FRIDAY, 10)),
    ).toThrow(RangeError);
    expect(renameHero(db, 'x'.repeat(PROFILE.nameMaxLength), clockAt(FRIDAY, 10))).toHaveLength(
      PROFILE.nameMaxLength,
    );
  });
});

function nameOf(db: Db, id: string): string {
  return db.select().from(missions).where(eq(missions.id, id)).get()?.name ?? '';
}
