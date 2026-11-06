import { asc } from 'drizzle-orm';

import { createProfile, hasProfile, type ProfileInput } from '@/db/repositories/onboarding';
import { getSetting } from '@/db/repositories/settings';
import { boss, bossSteps, companion, events, hero, heroStats, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { STAT_KEYS } from '@/rules/types';

import { createTestDb, heroTotals, totalsFromLog } from '../../../test/db';

const NOW = Date.UTC(2026, 10, 6, 8, 0); // 09:00 in Rome on 6 November
const CONTEXT = { now: NOW, tzOffset: 60 };

function input(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    name: '  Claudio  ',
    language: 'it',
    theme: 'fantasy',
    templateKeys: ['drink_water', 'read_pages', 'meditation'],
    ...overrides,
  };
}

function nothingWritten(db: Db): void {
  expect(hasProfile(db)).toBe(false);
  expect(db.select().from(missions).all()).toEqual([]);
  expect(db.select().from(events).all()).toEqual([]);
}

describe('hasProfile', () => {
  it('is false before the first launch and true after', () => {
    const db = createTestDb();
    expect(hasProfile(db)).toBe(false);
    createProfile(db, input(), CONTEXT);
    expect(hasProfile(db)).toBe(true);
  });
});

describe('createProfile', () => {
  it('creates the hero, the six stats and the egg', () => {
    const db = createTestDb();
    createProfile(db, input(), CONTEXT);
    expect(db.select().from(hero).all()).toEqual([
      {
        id: 'hero',
        name: 'Claudio',
        level: 1,
        xpInLevel: 0,
        xpTotal: 0,
        hp: 50,
        coins: 0,
        streak: 0,
        streakBest: 0,
        exhaustedDay: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    const stats = db.select().from(heroStats).all();
    expect(stats.map((row) => row.statKey).sort()).toEqual([...STAT_KEYS].sort());
    expect(stats.every((row) => row.points === 0)).toBe(true);
    expect(db.select().from(companion).all()).toEqual([
      { id: 'companion', name: null, stage: 'egg', completionsTotal: 0, hatchedAt: null },
    ]);
  });

  it('saves the chosen language and theme', () => {
    const db = createTestDb();
    createProfile(db, input(), CONTEXT);
    expect(getSetting(db, 'language')).toBe('it');
    expect(getSetting(db, 'theme')).toBe('fantasy');
  });

  it('creates the chosen missions from the templates, named in the chosen language', () => {
    const db = createTestDb();
    const names: Record<string, string> = {
      'templates.drink_water.name': "Bevi 2 litri d'acqua",
      'templates.read_pages.name': 'Leggi 20 pagine',
      'templates.meditation.name': 'Meditazione 10 min',
    };
    createProfile(db, input(), { ...CONTEXT, translate: (key) => names[key] ?? key });
    const created = db.select().from(missions).orderBy(asc(missions.sortOrder)).all();
    expect(created.map((mission) => mission.name)).toEqual(Object.values(names));
    expect(created[0]).toMatchObject({
      kind: 'habit',
      templateKey: 'drink_water',
      categoryKey: 'health',
      frequency: { type: 'daily' },
      difficulty: 'easy',
      statPrimary: 'constitution',
      statSecondary: null,
      goalType: 'quantity',
      goalTarget: 2,
      goalUnit: 'liter',
      goalStep: 0.25,
      status: 'active',
      deletedAt: null,
      createdAt: NOW,
    });
    expect(created[2]).toMatchObject({
      templateKey: 'meditation',
      goalType: 'duration',
      goalTarget: 10,
      goalUnit: 'minute',
      goalStep: 5,
    });
  });

  it('starts the quest of the first launch with its first step already done', () => {
    const db = createTestDb();
    createProfile(db, input(), CONTEXT);
    const quest = db.select().from(boss).get();
    expect(quest).toMatchObject({
      name: 'starter_quest.name',
      kind: 'starter',
      difficulty: 'easy',
      statKey: null,
      hpMax: 60,
      hp: 40,
      status: 'active',
      deadlineDay: null,
    });
    const steps = db.select().from(bossSteps).orderBy(asc(bossSteps.position)).all();
    expect(steps.map(({ position, title, doneAt }) => ({ position, title, doneAt }))).toEqual([
      { position: 0, title: 'starter_quest.steps.create_habit', doneAt: NOW },
      { position: 1, title: 'starter_quest.steps.complete_habit', doneAt: null },
      { position: 2, title: 'starter_quest.steps.open_stats', doneAt: null },
    ]);
  });

  it('writes the events of the creation, and the hero matches the sum of the log', () => {
    const db = createTestDb();
    createProfile(db, input(), CONTEXT);
    const written = db.select().from(events).orderBy(asc(events.seq)).all();
    expect(written.map((event) => event.type)).toEqual([
      'hero.created',
      'mission.created',
      'mission.created',
      'mission.created',
      'boss.created',
      'boss.step_done',
    ]);
    expect(written.every((event) => event.gameDay === '2026-11-06')).toBe(true);
    expect(heroTotals(db)).toEqual(totalsFromLog(db));
    expect(heroTotals(db)).toEqual({ xp: 0, coins: 0, hp: 50, stats: {} });
  });

  it('rejects 0 or 6 templates, unknown or repeated templates and an empty name', () => {
    const db = createTestDb();
    const six = ['drink_water', 'read_pages', 'meditation', 'run', 'gym', 'journal'];
    for (const wrong of [
      input({ templateKeys: [] }),
      input({ templateKeys: six }),
      input({ templateKeys: ['unicorn_ride'] }),
      input({ templateKeys: ['run', 'run'] }),
      input({ name: '' }),
      input({ name: '   ' }),
    ]) {
      expect(() => createProfile(db, wrong, CONTEXT)).toThrow(RangeError);
    }
    nothingWritten(db);
  });

  it('accepts from 1 to 5 templates', () => {
    const five = ['drink_water', 'read_pages', 'meditation', 'run', 'gym'];
    for (const templateKeys of [['journal'], five]) {
      const db = createTestDb();
      createProfile(db, input({ templateKeys }), CONTEXT);
      expect(db.select().from(missions).all()).toHaveLength(templateKeys.length);
    }
  });

  it('writes nothing when a value is not valid', () => {
    const db = createTestDb();
    expect(() => createProfile(db, input({ language: 'xx' as never }), CONTEXT)).toThrow();
    nothingWritten(db);
  });

  it('refuses a second profile', () => {
    const db = createTestDb();
    createProfile(db, input(), CONTEXT);
    expect(() => createProfile(db, input({ name: 'Altro' }), CONTEXT)).toThrow();
    expect(db.select().from(hero).get()?.name).toBe('Claudio');
    expect(db.select().from(missions).all()).toHaveLength(3);
  });
});
