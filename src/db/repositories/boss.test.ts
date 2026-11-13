import { and, asc, eq } from 'drizzle-orm';

import {
  archiveBoss,
  checkBossDeadlines,
  completeBossStep,
  completeStarterStatsStep,
  starterStatsStepId,
  createBoss,
  deleteBoss,
  listActiveBosses,
  setBossDeadline,
  updateBoss,
  type NewBoss,
} from '@/db/repositories/boss';
import { completeMission } from '@/db/repositories/completion';
import { getBossView } from '@/db/repositories/bossView';
import { getGoalsView } from '@/db/repositories/goalsView';
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

function stepsOf(db: Db, bossId: string) {
  return db
    .select({ id: bossSteps.id, title: bossSteps.title, done: bossSteps.doneAt })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all()
    .map((row) => ({ id: row.id, title: row.title, done: row.done !== null }));
}

function bossOf(db: Db, bossId: string) {
  const row = db.select().from(boss).where(eq(boss.id, bossId)).get();
  if (row === undefined) {
    throw new Error(`No boss ${bossId}`);
  }
  return row;
}

describe('updateBoss', () => {
  it('renames the boss and its steps and moves them, without changing the hit points', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const [index, first, second] = stepIds(db, thesis.id);
    completeBossStep(db, index, NOW);
    updateBoss(
      db,
      thesis.id,
      {
        name: ' Tesi di laurea ',
        steps: [
          { id: second, title: 'Capitolo 2' },
          { id: index, title: 'Indice e sommario' },
          { id: first, title: 'Capitolo 1' },
        ],
      },
      NOW,
    );
    expect(bossOf(db, thesis.id)).toMatchObject({ name: 'Tesi di laurea', hp: 40, hpMax: 60 });
    expect(stepsOf(db, thesis.id)).toEqual([
      { id: second, title: 'Capitolo 2', done: false },
      { id: index, title: 'Indice e sommario', done: true },
      { id: first, title: 'Capitolo 1', done: false },
    ]);
    expect(eventsOf(db, 'boss.updated')).toEqual([
      expect.objectContaining({
        bossId: thesis.id,
        payload: expect.objectContaining({ steps: 3, added: 0, removed: 0, hp: 40, hpMax: 60 }),
      }),
    ]);
    expectHeroMatchesLog(db);
  });

  it('adds a step after some damage: 20 more hit points, the damage stays', () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'journal');
    const thesis = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    const ids = stepIds(db, thesis.id);
    completeBossStep(db, ids[0], NOW);
    completeMission(db, { missionId: read, source: 'app', ...NOW });
    const damaged = bossOf(db, thesis.id);
    const taken = damaged.hpMax - damaged.hp;
    updateBoss(
      db,
      thesis.id,
      {
        name: 'Tesi',
        steps: [...ids.map((id, i) => ({ id, title: THESIS.steps[i] })), { title: 'Bibliografia' }],
      },
      NOW,
    );
    const edited = bossOf(db, thesis.id);
    expect(edited.hpMax).toBe(80);
    expect(edited.hp).toBe(damaged.hp + 20);
    expect(edited.hpMax - edited.hp).toBe(taken);
    expect(stepsOf(db, thesis.id).map((step) => step.title)).toEqual([
      'Indice',
      'Capitolo 1',
      'Capitolo 2',
      'Bibliografia',
    ]);
    expectHeroMatchesLog(db);
  });

  it('takes away a step to do after some damage, never below the protected part', () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'journal');
    const steps = ['Uno', 'Due', 'Tre', 'Quattro'];
    const move = createBoss(db, { ...THESIS, steps, missionIds: [read] }, NOW);
    const ids = stepIds(db, move.id);
    completeBossStep(db, ids[0], NOW);
    completeMission(db, { missionId: read, source: 'app', ...NOW });
    const damaged = bossOf(db, move.id);
    updateBoss(
      db,
      move.id,
      { name: 'Tesi', steps: [ids[0], ids[1], ids[2]].map((id, i) => ({ id, title: steps[i] })) },
      NOW,
    );
    const edited = bossOf(db, move.id);
    expect(edited.hpMax).toBe(60);
    expect(edited.hp).toBe(Math.max(damaged.hp - 20, 20));
    expect(stepsOf(db, move.id)).toHaveLength(3);
    expect(eventsOf(db, 'boss.updated')[0].payload).toMatchObject({ added: 0, removed: 1 });
    expectHeroMatchesLog(db);
  });

  it('keeps the steps done: they cannot be taken away', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const [index, first, second] = stepIds(db, thesis.id);
    completeBossStep(db, index, NOW);
    expect(() =>
      updateBoss(
        db,
        thesis.id,
        {
          name: 'Tesi',
          steps: [
            { id: first, title: 'Capitolo 1' },
            { id: second, title: 'Capitolo 2' },
          ],
        },
        NOW,
      ),
    ).toThrow(RangeError);
    expect(stepsOf(db, thesis.id)).toHaveLength(3);
  });

  it('refuses no step left to do, too few or too many steps and steps of another boss', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const other = createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    const [index, first, second] = stepIds(db, thesis.id);
    completeBossStep(db, index, NOW);
    completeBossStep(db, first, NOW);
    const done = [
      { id: index, title: 'Indice' },
      { id: first, title: 'Capitolo 1' },
    ];
    // Only the last step is to do: taking it away would win without the final blow.
    expect(() => updateBoss(db, thesis.id, { name: 'Tesi', steps: done }, NOW)).toThrow(RangeError);
    const keep = [...done, { id: second, title: 'Capitolo 2' }];
    const many = Array.from({ length: 18 }, (_, i) => ({ title: `Passo ${i}` }));
    expect(() =>
      updateBoss(db, thesis.id, { name: 'Tesi', steps: [...keep, ...many] }, NOW),
    ).toThrow(RangeError);
    const foreign = { id: stepIds(db, other.id)[0], title: 'Altro' };
    expect(() =>
      updateBoss(db, thesis.id, { name: 'Tesi', steps: [...keep, foreign] }, NOW),
    ).toThrow(RangeError);
    expect(() => updateBoss(db, thesis.id, { name: ' ', steps: keep }, NOW)).toThrow(RangeError);
    expect(() =>
      updateBoss(db, thesis.id, { name: 'Tesi', steps: [...keep, { title: '  ' }] }, NOW),
    ).toThrow(RangeError);
    archiveBoss(db, other.id, NOW);
    const two = createBoss(db, { ...THESIS, steps: ['Uno', 'Due'] }, NOW);
    expect(() =>
      updateBoss(
        db,
        two.id,
        { name: 'Tesi', steps: [{ id: stepIds(db, two.id)[0], title: 'Uno' }] },
        NOW,
      ),
    ).toThrow(RangeError);
    expect(stepsOf(db, thesis.id)).toHaveLength(3);
    expect(eventsOf(db, 'boss.updated')).toEqual([]);
  });

  it('changes the linked missions and refuses a boss that is not active or the starter quest', () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    const read = missionId(db, 'read_pages');
    const thesis = createBoss(db, { ...THESIS, missionIds: [journal] }, NOW);
    const steps = stepIds(db, thesis.id).map((id, i) => ({ id, title: THESIS.steps[i] }));
    updateBoss(db, thesis.id, { name: 'Tesi', steps, missionIds: [read] }, NOW);
    const linked = db
      .select({ id: missions.id })
      .from(missions)
      .where(eq(missions.bossId, thesis.id))
      .all()
      .map((row) => row.id);
    expect(linked).toEqual([read]);
    const quest = starterQuest(db);
    const questSteps = stepIds(db, quest.id).map((id) => ({ id, title: 'x' }));
    expect(() => updateBoss(db, quest.id, { name: 'x', steps: questSteps }, NOW)).toThrow(
      RangeError,
    );
    archiveBoss(db, thesis.id, NOW);
    expect(() => updateBoss(db, thesis.id, { name: 'Tesi', steps }, NOW)).toThrow(RangeError);
  });

  it('moves the deadline in the same change and starts the warning again', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const steps = stepIds(db, thesis.id).map((id, i) => ({ id, title: THESIS.steps[i] }));
    checkBossDeadlines(db, clockAt(9, 10));
    const same = updateBoss(db, thesis.id, { name: 'Tesi', steps, deadlineDay: '2026-11-12' }, NOW);
    expect(same).toMatchObject({ deadlineDay: '2026-11-12', deadlineWarned: true });
    const moved = updateBoss(
      db,
      thesis.id,
      { name: 'Tesi', steps, deadlineDay: '2026-11-30' },
      NOW,
    );
    expect(moved).toMatchObject({ deadlineDay: '2026-11-30', deadlineWarned: false });
    expect(eventsOf(db, 'boss.updated').at(-1)?.payload).toMatchObject({
      deadlineDay: '2026-11-30',
    });
    expect(() =>
      updateBoss(db, thesis.id, { name: 'Tesi', steps, deadlineDay: '2026-11-01' }, NOW),
    ).toThrow(RangeError);
    expect(bossOf(db, thesis.id).deadlineDay).toBe('2026-11-30');
  });

  it('gives the reward of the new number of steps at the victory', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const ids = stepIds(db, thesis.id);
    updateBoss(
      db,
      thesis.id,
      {
        name: 'Tesi',
        steps: [...ids.map((id, i) => ({ id, title: THESIS.steps[i] })), { title: 'Discussione' }],
      },
      NOW,
    );
    for (const id of stepIds(db, thesis.id)) {
      completeBossStep(db, id, NOW);
    }
    // 4 steps × 10 XP × 1.5 (medium) = 60 XP and 12 coins.
    expect(db.select().from(hero).get()).toMatchObject({ xpTotal: 60, coins: 12 });
    expect(bossOf(db, thesis.id)).toMatchObject({ status: 'defeated', hp: 0 });
    expectHeroMatchesLog(db);
  });
});

describe('setBossDeadline', () => {
  it('sets a new deadline, starts the 3-day warning again and lets the boss steal once more', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1000);
    const thesis = createBoss(db, THESIS, NOW);
    expect(checkBossDeadlines(db, clockAt(9, 10)).warned).toEqual([thesis.id]);
    expect(checkBossDeadlines(db, clockAt(13, 10)).robbed).toHaveLength(1);
    setBossDeadline(db, thesis.id, '2026-11-20', clockAt(13, 11));
    expect(bossOf(db, thesis.id)).toMatchObject({
      deadlineDay: '2026-11-20',
      deadlineWarned: false,
    });
    expect(checkBossDeadlines(db, clockAt(14, 10))).toEqual({ warned: [], robbed: [] });
    expect(checkBossDeadlines(db, clockAt(17, 10)).warned).toEqual([thesis.id]);
    expect(checkBossDeadlines(db, clockAt(21, 10)).robbed).toEqual([
      { bossId: thesis.id, coins: 90 },
    ]);
    expect(eventsOf(db, 'boss.updated')).toEqual([
      expect.objectContaining({ bossId: thesis.id, payload: { deadlineDay: '2026-11-20' } }),
    ]);
    expectHeroMatchesLog(db);
  });

  it('takes the deadline away, and refuses a past day or a boss that is not active', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    expect(() => setBossDeadline(db, thesis.id, '2026-11-05', NOW)).toThrow(RangeError);
    setBossDeadline(db, thesis.id, null, NOW);
    expect(bossOf(db, thesis.id).deadlineDay).toBeNull();
    expect(checkBossDeadlines(db, clockAt(20, 10))).toEqual({ warned: [], robbed: [] });
    archiveBoss(db, thesis.id, NOW);
    expect(() => setBossDeadline(db, thesis.id, '2026-11-20', NOW)).toThrow(RangeError);
  });
});

describe('deleteBoss', () => {
  it('takes the boss out of every list, unlinks its missions and keeps the hero', () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'journal');
    const thesis = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    completeBossStep(db, stepIds(db, thesis.id)[0], NOW);
    completeMission(db, { missionId: read, source: 'app', ...NOW });
    const before = db.select().from(hero).get();
    deleteBoss(db, thesis.id, NOW);
    expect(bossOf(db, thesis.id).status).toBe('deleted');
    expect(db.select().from(missions).where(eq(missions.id, read)).get()?.bossId).toBeNull();
    expect(listActiveBosses(db).map((item) => item.id)).not.toContain(thesis.id);
    const goals = getGoalsView(db, NOW);
    expect([...goals.active, ...goals.archived].map((item) => item.boss.id)).not.toContain(
      thesis.id,
    );
    expect(getBossView(db, thesis.id, NOW)).toBeNull();
    expect(eventsOf(db, 'boss.deleted').map((event) => event.bossId)).toEqual([thesis.id]);
    // The stat points of the step stay: the log keeps what the boss gave.
    expect(db.select().from(hero).get()).toEqual(before);
    expectHeroMatchesLog(db);
  });

  it('frees a place, never steals after the deadline and refuses a boss that is not active', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1000);
    const thesis = createBoss(db, THESIS, NOW);
    createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    deleteBoss(db, thesis.id, NOW);
    expect(() => createBoss(db, { ...THESIS, name: 'Maratona' }, NOW)).not.toThrow();
    expect(checkBossDeadlines(db, clockAt(20, 10)).robbed.map((item) => item.bossId)).not.toContain(
      thesis.id,
    );
    expect(() => deleteBoss(db, thesis.id, NOW)).toThrow(RangeError);
    expect(() => deleteBoss(db, 'missing', NOW)).toThrow(RangeError);
  });
});

describe('completeStarterStatsStep', () => {
  it('wins the quest of the first launch when the statistics open after the first completion', () => {
    const db = newGame(['journal']);
    expect(starterStatsStepId(db)).toBeNull();
    completeMission(db, { missionId: missionId(db, 'journal'), source: 'app', ...NOW });
    expect(starterStatsStepId(db)).toBe(stepIds(db, starterQuest(db).id)[2]);
    const result = completeStarterStatsStep(db, NOW);
    expect(result.done).toBe(true);
    expect(result.moments.map((event) => event.type)).toEqual(['boss.defeated', 'hero.level_up']);
    expect(result.moments[0].payload).toMatchObject({ starter: true });
    expect(starterQuest(db).status).toBe('defeated');
    expect(result.moments[0]).toMatchObject({ dCoins: 50 });
    expect(starterStatsStepId(db)).toBeNull();
    expect(db.select().from(hero).get()).toMatchObject({ level: 2 });
    expectHeroMatchesLog(db);
  });

  it('does nothing before the first completion, or once the quest is won or archived', () => {
    const db = newGame(['journal']);
    expect(completeStarterStatsStep(db, NOW)).toEqual({ done: false, moments: [] });
    expect(eventsOf(db, 'boss.step_done')).toHaveLength(1);

    completeMission(db, { missionId: missionId(db, 'journal'), source: 'app', ...NOW });
    completeStarterStatsStep(db, NOW);
    expect(completeStarterStatsStep(db, NOW)).toEqual({ done: false, moments: [] });

    const other = newGame(['journal']);
    completeMission(other, { missionId: missionId(other, 'journal'), source: 'app', ...NOW });
    archiveBoss(other, starterQuest(other).id, NOW);
    expect(completeStarterStatsStep(other, NOW)).toEqual({ done: false, moments: [] });
  });

  it('marks a normal boss victory as not starter', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, { ...THESIS, steps: ['A', 'B'] }, NOW);
    const [first, second] = stepIds(db, thesis.id);
    completeBossStep(db, first, NOW);
    const result = completeBossStep(db, second, NOW);
    expect(result.moments[0].payload).toMatchObject({ starter: false });
  });
});
