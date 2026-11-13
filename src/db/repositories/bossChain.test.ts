import { asc, eq, sql } from 'drizzle-orm';

import {
  archiveBoss,
  checkBossDeadlines,
  completeBossStep,
  createBoss,
  deleteBoss,
  listActiveBosses,
  setMainQuest,
  updateBoss,
  type NewBoss,
} from '@/db/repositories/boss';
import { getBossView } from '@/db/repositories/bossView';
import { getGoalsView } from '@/db/repositories/goalsView';
import { getTodayView } from '@/db/repositories/todayView';
import { boss, bossSteps, events } from '@/db/schema';
import type { Db } from '@/db/types';

import { createTestDb } from '../../../test/db';
import { clockAt, expectHeroMatchesLog, newGame } from '../../../test/game';

// Main Quest and chains of goals (task T83; design-sezioni.md 5.8).

const NOW = clockAt(6, 10);

const GOAL: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  steps: ['Indice', 'Capitolo 1'],
};

function bossOf(db: Db, id: string) {
  const row = db.select().from(boss).where(eq(boss.id, id)).get();
  if (row === undefined) {
    throw new Error(`No boss ${id}`);
  }
  return row;
}

function win(db: Db, bossId: string): void {
  const steps = db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all();
  for (const step of steps) {
    completeBossStep(db, step.id, NOW);
  }
}

function typesOf(db: Db, bossId: string): string[] {
  return db
    .select({ type: events.type })
    .from(events)
    .where(eq(events.bossId, bossId))
    .orderBy(asc(events.seq))
    .all()
    .map((row) => row.type);
}

describe('setMainQuest', () => {
  it('pins one Main Quest at a time and takes it away', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const second = createBoss(db, { ...GOAL, name: 'Trasloco' }, NOW);
    setMainQuest(db, first.id, true, NOW);
    expect(bossOf(db, first.id).isMain).toBe(true);
    setMainQuest(db, second.id, true, NOW);
    expect(bossOf(db, first.id).isMain).toBe(false);
    expect(bossOf(db, second.id).isMain).toBe(true);
    setMainQuest(db, second.id, false, NOW);
    expect(db.select().from(boss).where(eq(boss.isMain, true)).all()).toEqual([]);
    expect(typesOf(db, second.id)).toEqual([
      'boss.created',
      'boss.main_changed',
      'boss.main_changed',
    ]);
  });

  it('refuses the starter quest, a locked boss and a boss that is not active', () => {
    const db = newGame(['journal']);
    const quest = db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
    expect(() => setMainQuest(db, quest.id, true, NOW)).toThrow(RangeError);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    expect(() => setMainQuest(db, next.id, true, NOW)).toThrow(RangeError);
    archiveBoss(db, first.id, NOW);
    expect(() => setMainQuest(db, first.id, true, NOW)).toThrow(RangeError);
    expect(() => setMainQuest(db, 'missing', true, NOW)).toThrow(RangeError);
  });

  it('leaves the Main Quest when the boss is archived, deleted or defeated', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    setMainQuest(db, first.id, true, NOW);
    archiveBoss(db, first.id, NOW);
    expect(bossOf(db, first.id).isMain).toBe(false);
    const second = createBoss(db, { ...GOAL, name: 'Trasloco' }, NOW);
    setMainQuest(db, second.id, true, NOW);
    deleteBoss(db, second.id, NOW);
    expect(bossOf(db, second.id).isMain).toBe(false);
    const third = createBoss(db, { ...GOAL, name: 'Maratona' }, NOW);
    setMainQuest(db, third.id, true, NOW);
    win(db, third.id);
    expect(bossOf(db, third.id)).toMatchObject({ status: 'defeated', isMain: false });
    expectHeroMatchesLog(db);
  });

  it('shows the Main Quest at the top of Today, out of the other bosses', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const second = createBoss(db, { ...GOAL, name: 'Trasloco' }, NOW);
    expect(getTodayView(db, NOW).mainQuest).toBeNull();
    setMainQuest(db, second.id, true, NOW);
    const today = getTodayView(db, NOW);
    expect(today.mainQuest?.boss.id).toBe(second.id);
    expect(today.bosses.map((item) => item.boss.id)).toContain(first.id);
    expect(today.bosses.map((item) => item.boss.id)).not.toContain(second.id);
  });
});

describe('chains of goals', () => {
  it('creates the next boss locked, outside the 3 active ones', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    createBoss(db, { ...GOAL, name: 'Trasloco' }, NOW);
    // The starter quest and 2 bosses: the places are full, a next boss of a chain still fits.
    expect(() => createBoss(db, { ...GOAL, name: 'Quarto' }, NOW)).toThrow(RangeError);
    const next = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    expect(next).toMatchObject({ status: 'locked', chainPrevId: first.id, hp: 40 });
    expect(listActiveBosses(db).map((item) => item.id)).not.toContain(next.id);
    const goals = getGoalsView(db, NOW);
    expect(goals.active).toHaveLength(3);
    expect(goals.locked.map((item) => item.boss.id)).toEqual([next.id]);
    expect(getTodayView(db, NOW).bosses.map((item) => item.boss.id)).not.toContain(next.id);
  });

  it('gives a boss one next boss only, and never after the starter quest or a boss that left', () => {
    const db = newGame(['journal']);
    const quest = db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
    const first = createBoss(db, GOAL, NOW);
    createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    expect(() => createBoss(db, { ...GOAL, name: 'Ancora', chainPrevId: first.id }, NOW)).toThrow(
      RangeError,
    );
    expect(() => createBoss(db, { ...GOAL, name: 'Ancora', chainPrevId: quest.id }, NOW)).toThrow(
      RangeError,
    );
    expect(() => createBoss(db, { ...GOAL, name: 'Ancora', chainPrevId: 'missing' }, NOW)).toThrow(
      RangeError,
    );
  });

  it('takes no step, no damage and steals nothing while locked', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(
      db,
      { ...GOAL, name: 'Dopo', chainPrevId: first.id, deadlineDay: '2026-11-08' },
      NOW,
    );
    const step = db.select().from(bossSteps).where(eq(bossSteps.bossId, next.id)).get()!;
    expect(() => completeBossStep(db, step.id, NOW)).toThrow(RangeError);
    expect(checkBossDeadlines(db, clockAt(12, 10)).robbed).toEqual([]);
    expect(bossOf(db, next.id).hp).toBe(40);
  });

  it('unlocks the next boss at the victory, and the one after it at the next victory', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const second = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    const third = createBoss(db, { ...GOAL, name: 'Infine', chainPrevId: second.id }, NOW);
    win(db, first.id);
    expect(bossOf(db, second.id).status).toBe('active');
    expect(bossOf(db, third.id).status).toBe('locked');
    expect(typesOf(db, second.id)).toEqual(['boss.created', 'boss.unlocked']);
    win(db, second.id);
    expect(bossOf(db, third.id).status).toBe('active');
    expectHeroMatchesLog(db);
  });

  it('passes the Main Quest to the next boss and drops a deadline already passed', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(
      db,
      { ...GOAL, name: 'Dopo', chainPrevId: first.id, deadlineDay: '2026-11-06' },
      NOW,
    );
    setMainQuest(db, first.id, true, NOW);
    const later = clockAt(9, 10);
    const steps = db.select().from(bossSteps).where(eq(bossSteps.bossId, first.id)).all();
    for (const step of steps) {
      completeBossStep(db, step.id, later);
    }
    expect(bossOf(db, next.id)).toMatchObject({
      status: 'active',
      isMain: true,
      deadlineDay: null,
    });
    expect(checkBossDeadlines(db, later).robbed).toEqual([]);
  });

  it('unlocks the next boss when the one before it is archived or deleted', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    archiveBoss(db, first.id, NOW);
    expect(bossOf(db, next.id).status).toBe('active');
    const other = createBoss(db, { ...GOAL, name: 'Altro', chainPrevId: next.id }, NOW);
    deleteBoss(db, next.id, NOW);
    expect(bossOf(db, other.id).status).toBe('active');
  });

  it('deletes a locked boss and joins the chain around it', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const second = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    const third = createBoss(db, { ...GOAL, name: 'Infine', chainPrevId: second.id }, NOW);
    deleteBoss(db, second.id, NOW);
    expect(bossOf(db, second.id).status).toBe('deleted');
    expect(bossOf(db, third.id)).toMatchObject({ status: 'locked', chainPrevId: first.id });
    // The place after the second one is free again: a new next boss can follow the third.
    expect(() =>
      createBoss(db, { ...GOAL, name: 'Poi', chainPrevId: third.id }, NOW),
    ).not.toThrow();
    win(db, first.id);
    expect(bossOf(db, third.id).status).toBe('active');
  });

  it('changes a locked boss like an active one', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    const steps = db
      .select()
      .from(bossSteps)
      .where(eq(bossSteps.bossId, next.id))
      .orderBy(asc(bossSteps.position))
      .all()
      .map((step) => ({ id: step.id, title: step.title }));
    updateBoss(db, next.id, { name: 'Dopo ancora', steps: [...steps, { title: 'Fine' }] }, NOW);
    expect(bossOf(db, next.id)).toMatchObject({ name: 'Dopo ancora', hp: 60, status: 'locked' });
  });

  it('names the bosses before and after in the card of a boss', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const next = createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    expect(getBossView(db, first.id, NOW)).toMatchObject({
      chainPrev: null,
      chainNext: { id: next.id, name: 'Dopo' },
      canChain: false,
    });
    expect(getBossView(db, next.id, NOW)).toMatchObject({
      chainPrev: { id: first.id, name: 'Tesi' },
      chainNext: null,
      canChain: true,
    });
  });
});

describe('migration 0005', () => {
  it('adds is_main and chain_prev_id to the boss with their unique indexes, from zero', () => {
    const db = createTestDb();
    const columns = db
      .all<{ name: string; dflt_value: string | null }>(sql`PRAGMA table_info(boss)`)
      .map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(['is_main', 'chain_prev_id']));
    const indexes = db
      .all<{ name: string; unique: number }>(sql`PRAGMA index_list(boss)`)
      .filter((row) => row.name === 'boss_main_idx' || row.name === 'boss_chain_prev_idx');
    expect(indexes.map((row) => [row.name, row.unique]).sort()).toEqual([
      ['boss_chain_prev_idx', 1],
      ['boss_main_idx', 1],
    ]);
  });

  it('refuses two Main Quests or two next bosses even outside the actions', () => {
    const db = newGame(['journal']);
    const first = createBoss(db, GOAL, NOW);
    const second = createBoss(db, { ...GOAL, name: 'Trasloco' }, NOW);
    db.update(boss).set({ isMain: true }).where(eq(boss.id, first.id)).run();
    expect(() =>
      db.update(boss).set({ isMain: true }).where(eq(boss.id, second.id)).run(),
    ).toThrow();
    createBoss(db, { ...GOAL, name: 'Dopo', chainPrevId: first.id }, NOW);
    expect(() =>
      db.update(boss).set({ chainPrevId: first.id }).where(eq(boss.id, second.id)).run(),
    ).toThrow();
  });
});
