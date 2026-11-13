import { and, asc, eq } from 'drizzle-orm';

import {
  archiveBoss,
  checkBossDeadlines,
  completeBossStep,
  createBoss,
  listActiveBosses,
  type NewBoss,
} from '@/db/repositories/boss';
import { appendEvent, type EventType } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { appNotifications, boss, bossSteps, events, hero, heroStats, missions } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, expectHeroMatchesLog, missionId, newGame, TZ } from '../../../test/game';

const NOW = clockAt(6, 10);

const THESIS: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  statKey: 'wisdom',
  deadlineDay: '2026-11-12',
  steps: ['Indice', 'Capitolo 1', 'Capitolo 2'],
};

function stepIds(db: Db, bossId: string): string[] {
  return db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all()
    .map((row) => row.id);
}

function starterQuest(db: Db) {
  const row = db.select().from(boss).where(eq(boss.kind, 'starter')).get();
  if (row === undefined) {
    throw new Error('No starter quest');
  }
  return row;
}

function giveCoins(db: Db, coins: number): void {
  const change = changeHero(db, { coins }, at(6, 8));
  appendEvent(db, {
    type: 'bonus.full_day',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

function eventsOf(db: Db, type: EventType) {
  return db.select().from(events).where(eq(events.type, type)).all();
}

describe('createBoss', () => {
  it('creates the boss with 20 hit points per step, its steps and its event', () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'read_pages');
    const created = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    expect(created).toMatchObject({
      name: 'Tesi',
      kind: 'normal',
      difficulty: 'medium',
      statKey: 'wisdom',
      hpMax: 60,
      hp: 60,
      deadlineDay: '2026-11-12',
      status: 'active',
    });
    expect(
      db
        .select({ title: bossSteps.title, position: bossSteps.position, doneAt: bossSteps.doneAt })
        .from(bossSteps)
        .where(eq(bossSteps.bossId, created.id))
        .orderBy(asc(bossSteps.position))
        .all(),
    ).toEqual([
      { title: 'Indice', position: 0, doneAt: null },
      { title: 'Capitolo 1', position: 1, doneAt: null },
      { title: 'Capitolo 2', position: 2, doneAt: null },
    ]);
    expect(db.select().from(missions).where(eq(missions.id, read)).get()?.bossId).toBe(created.id);
    expect(
      db
        .select()
        .from(events)
        .where(and(eq(events.type, 'boss.created'), eq(events.bossId, created.id)))
        .get(),
    ).toBeDefined();
    expectHeroMatchesLog(db);
  });

  it('creates a boss with 2 or 20 steps', () => {
    const db = newGame(['journal']);
    const two = createBoss(db, { ...THESIS, steps: ['Uno', 'Due'] }, NOW);
    const twenty = Array.from({ length: 20 }, (_, index) => `Passo ${index + 1}`);
    const long = createBoss(db, { ...THESIS, name: 'Maratona', steps: twenty }, NOW);
    expect(two.hpMax).toBe(40);
    expect(stepIds(db, two.id)).toHaveLength(2);
    expect(long.hpMax).toBe(400);
    expect(stepIds(db, long.id)).toHaveLength(20);
  });

  it('moves a mission linked to another boss to the new one', () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'read_pages');
    const first = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    const second = createBoss(db, { ...THESIS, name: 'Trasloco', missionIds: [read] }, NOW);
    expect(db.select().from(missions).where(eq(missions.id, read)).get()?.bossId).toBe(second.id);
    expect(
      db.select({ id: missions.id }).from(missions).where(eq(missions.bossId, first.id)).all(),
    ).toEqual([]);
  });

  it('refuses a fourth active boss, the quest of the first launch included', () => {
    const db = newGame(['journal']);
    createBoss(db, THESIS, NOW);
    createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    expect(() => createBoss(db, { ...THESIS, name: 'Maratona' }, NOW)).toThrow(RangeError);
    expect(db.select().from(boss).all()).toHaveLength(3);
  });

  it('refuses too few or too many steps, an empty name and a past deadline', () => {
    const db = newGame(['journal']);
    expect(() => createBoss(db, { ...THESIS, steps: ['Solo'] }, NOW)).toThrow(RangeError);
    const many = Array.from({ length: 21 }, (_, index) => `Passo ${index}`);
    expect(() => createBoss(db, { ...THESIS, steps: many }, NOW)).toThrow(RangeError);
    expect(() => createBoss(db, { ...THESIS, name: '  ' }, NOW)).toThrow(RangeError);
    expect(() => createBoss(db, { ...THESIS, deadlineDay: '2026-11-05' }, NOW)).toThrow(RangeError);
    expect(() => createBoss(db, { ...THESIS, missionIds: ['missing'] }, NOW)).toThrow(RangeError);
    expect(db.select().from(boss).all()).toHaveLength(1);
  });
});

describe('completeBossStep', () => {
  it('deals 20 damage and gives 10 points to the boss stat', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    expect(completeBossStep(db, stepIds(db, thesis.id)[1], NOW)).toMatchObject({ defeated: false });
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBe(40);
    expect(db.select().from(heroStats).where(eq(heroStats.statKey, 'wisdom')).get()?.points).toBe(
      10,
    );
    expectHeroMatchesLog(db);
  });

  it('wins at the last step with the reward of the boss', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    for (const id of stepIds(db, thesis.id)) {
      completeBossStep(db, id, NOW);
    }
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()).toMatchObject({
      status: 'defeated',
      hp: 0,
      defeatedAt: NOW.now,
    });
    // 3 steps × 10 XP × 1.5 (medium) = 45 XP and 9 coins.
    expect(db.select().from(hero).get()).toMatchObject({ xpTotal: 45, coins: 9 });
    expect(eventsOf(db, 'boss.defeated')).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('gives the XP to level 2 and 50 coins for the quest of the first launch', () => {
    const db = newGame(['journal']);
    const quest = starterQuest(db);
    const [, second, third] = stepIds(db, quest.id);
    expect(completeBossStep(db, second, NOW)).toEqual({
      defeated: false,
      eventId: eventsOf(db, 'boss.step_done').at(-1)?.id,
      dealt: 20,
      moments: [],
    });
    const victory = completeBossStep(db, third, NOW);
    expect(victory.defeated).toBe(true);
    expect(victory.moments.map((event) => event.type)).toEqual(['boss.defeated', 'hero.level_up']);
    expect(victory.moments[0]).toMatchObject({ dXp: 200, dCoins: 50 });
    expect(db.select().from(hero).get()).toMatchObject({ level: 2, xpTotal: 200, coins: 50 });
    expect(eventsOf(db, 'hero.level_up')).toHaveLength(1);
    expect(
      db
        .select()
        .from(heroStats)
        .all()
        .every((row) => row.points === 0),
    ).toBe(true);
    expectHeroMatchesLog(db);
  });

  it.each([
    { start: 100, xp: 100, level: 2 },
    { start: 250, xp: 0, level: 2 },
  ])('gives only the XP missing to level 2 from $start XP', ({ start, xp, level }) => {
    const db = newGame(['journal']);
    const change = changeHero(db, { xp: start }, at(6, 8));
    appendEvent(db, {
      type: 'bonus.plan',
      occurredAt: at(6, 8),
      tzOffset: TZ,
      source: 'system',
      gameDay: '2026-11-05',
      deltas: change.deltas,
    });
    const quest = starterQuest(db);
    const [, second, third] = stepIds(db, quest.id);
    completeBossStep(db, second, NOW);
    completeBossStep(db, third, NOW);
    expect(db.select().from(hero).get()).toMatchObject({ level, xpTotal: start + xp, coins: 50 });
    expect(eventsOf(db, 'boss.defeated')[0]).toMatchObject({ dXp: xp, dCoins: 50 });
    expect(
      db
        .select()
        .from(heroStats)
        .all()
        .every((row) => row.points === 0),
    ).toBe(true);
    expectHeroMatchesLog(db);
  });

  it('refuses a step already done or of a boss that is not active', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const [first, second] = stepIds(db, thesis.id);
    completeBossStep(db, first, NOW);
    expect(() => completeBossStep(db, first, NOW)).toThrow(RangeError);
    archiveBoss(db, thesis.id, NOW);
    expect(() => completeBossStep(db, second, NOW)).toThrow(RangeError);
    expect(() => completeBossStep(db, 'missing', NOW)).toThrow(RangeError);
    expectHeroMatchesLog(db);
  });
});

describe('archiveBoss', () => {
  it('archives an active boss, keeps its steps and frees a place', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    completeBossStep(db, stepIds(db, thesis.id)[0], NOW);
    archiveBoss(db, thesis.id, NOW);
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.status).toBe('archived');
    expect(stepIds(db, thesis.id)).toHaveLength(3);
    expect(eventsOf(db, 'boss.archived').map((event) => event.bossId)).toEqual([thesis.id]);
    expect(() => createBoss(db, { ...THESIS, name: 'Maratona' }, NOW)).not.toThrow();
    expect(() => archiveBoss(db, thesis.id, NOW)).toThrow(RangeError);
    expect(move.status).toBe('active');
  });
});

describe('listActiveBosses', () => {
  it('lists the active bosses in the order of creation, not the archived or defeated ones', () => {
    const db = newGame(['journal']);
    const quest = starterQuest(db);
    const thesis = createBoss(db, THESIS, NOW);
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    archiveBoss(db, quest.id, NOW);

    expect(listActiveBosses(db).map((item) => item.id)).toEqual([thesis.id, move.id]);
  });
});

describe('checkBossDeadlines', () => {
  it('warns once from 3 days before the deadline', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    expect(checkBossDeadlines(db, clockAt(8, 10))).toEqual({ warned: [], robbed: [] });
    expect(checkBossDeadlines(db, clockAt(9, 10))).toEqual({ warned: [thesis.id], robbed: [] });
    expect(checkBossDeadlines(db, clockAt(10, 10))).toEqual({ warned: [], robbed: [] });
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.deadlineWarned).toBe(true);
    expect(db.select().from(appNotifications).all()).toEqual([
      expect.objectContaining({ kind: 'boss.deadline_warning', params: { bossId: thesis.id } }),
    ]);
  });

  it('steals 10% of the coins once when the deadline has passed, and the boss stays', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1234);
    const thesis = createBoss(db, THESIS, NOW);
    expect(checkBossDeadlines(db, clockAt(12, 10)).robbed).toEqual([]);
    const result = checkBossDeadlines(db, clockAt(13, 10));
    expect(result.robbed).toEqual([{ bossId: thesis.id, coins: 123 }]);
    expect(checkBossDeadlines(db, clockAt(14, 10)).robbed).toEqual([]);
    expect(db.select().from(hero).get()?.coins).toBe(1111);
    expect(eventsOf(db, 'boss.deadline_missed')).toEqual([
      expect.objectContaining({ bossId: thesis.id, dCoins: -123, gameDay: '2026-11-13' }),
    ]);
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.status).toBe('active');
    expect(
      db
        .select()
        .from(appNotifications)
        .all()
        .map((row) => row.kind),
    ).toContain('boss.deadline_missed');
    expectHeroMatchesLog(db);
  });

  it('steals at most 500 coins and ignores defeated and archived bosses', () => {
    const db = newGame(['journal']);
    giveCoins(db, 8000);
    const thesis = createBoss(db, THESIS, NOW);
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    archiveBoss(db, move.id, NOW);
    expect(checkBossDeadlines(db, clockAt(20, 10)).robbed).toEqual([
      { bossId: thesis.id, coins: 500 },
    ]);
    expect(db.select().from(hero).get()?.coins).toBe(7500);
    expectHeroMatchesLog(db);
  });
});
