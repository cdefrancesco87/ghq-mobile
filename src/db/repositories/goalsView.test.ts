import { eq } from 'drizzle-orm';

import { archiveBoss, completeBossStep, createBoss, type NewBoss } from '@/db/repositories/boss';
import { getGoalsView, listLinkableMissions } from '@/db/repositories/goalsView';
import {
  archiveMission,
  createMission,
  deleteMission,
  pauseMission,
} from '@/db/repositories/missions';
import { boss, bossSteps } from '@/db/schema';
import type { Db } from '@/db/types';

import { clockAt, FRIDAY, missionId, newGame } from '../../../test/game';

const THESIS: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  steps: ['Indice', 'Capitolo 1', 'Capitolo 2'],
};

function firstStep(db: Db, bossId: string): string {
  const step = db.select().from(bossSteps).where(eq(bossSteps.bossId, bossId)).get();
  if (step === undefined) {
    throw new Error('No step');
  }
  return step.id;
}

describe('getGoalsView', () => {
  it('lists the active bosses from the oldest with their steps and the next one', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    completeBossStep(db, firstStep(db, thesis.id), clockAt(FRIDAY, 11));
    const view = getGoalsView(db, clockAt(FRIDAY, 12));
    expect(view.day).toBe('2026-11-06');
    expect(view.active.map((item) => item.boss.kind)).toEqual(['starter', 'normal']);
    expect(view.active[1]).toMatchObject({
      boss: { id: thesis.id, hp: 40 },
      stepsDone: 1,
      stepsTotal: 3,
      nextStep: { title: 'Capitolo 1' },
    });
    expect(view.archived).toEqual([]);
  });

  it('lists the archived bosses from the most recent, with the day and the steps done', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, clockAt(FRIDAY, 10));
    completeBossStep(db, firstStep(db, thesis.id), clockAt(FRIDAY, 11));
    archiveBoss(db, thesis.id, clockAt(FRIDAY, 12));
    // Before the change of day (06:00) the night still belongs to Saturday.
    archiveBoss(db, move.id, clockAt(FRIDAY + 2, 3));
    const view = getGoalsView(db, clockAt(FRIDAY + 2, 10));
    expect(view.active.map((item) => item.boss.kind)).toEqual(['starter']);
    expect(
      view.archived.map(({ boss: item, archivedDay, stepsDone, stepsTotal }) => ({
        name: item.name,
        archivedDay,
        stepsDone,
        stepsTotal,
      })),
    ).toEqual([
      { name: 'Trasloco', archivedDay: '2026-11-07', stepsDone: 0, stepsTotal: 3 },
      { name: 'Tesi', archivedDay: '2026-11-06', stepsDone: 1, stepsTotal: 3 },
    ]);
  });

  it('leaves out the defeated bosses', () => {
    const db = newGame(['journal']);
    const quick = createBoss(db, { ...THESIS, steps: ['Uno', 'Due'] }, clockAt(FRIDAY, 10));
    for (const step of db.select().from(bossSteps).where(eq(bossSteps.bossId, quick.id)).all()) {
      completeBossStep(db, step.id, clockAt(FRIDAY, 11));
    }
    expect(db.select().from(boss).where(eq(boss.id, quick.id)).get()?.status).toBe('defeated');
    const view = getGoalsView(db, clockAt(FRIDAY, 12));
    expect(view.active.map((item) => item.boss.id)).not.toContain(quick.id);
    expect(view.archived).toEqual([]);
  });
});

describe('listLinkableMissions', () => {
  it('lists the habits not archived with their damage and the boss they hit', () => {
    const db = newGame(['journal', 'read_pages', 'run', 'meditation', 'gym']);
    const read = missionId(db, 'read_pages');
    const run = missionId(db, 'run');
    const thesis = createBoss(db, { ...THESIS, missionIds: [read] }, clockAt(FRIDAY, 10));
    pauseMission(db, run, '2026-11-10', clockAt(FRIDAY, 10));
    archiveMission(db, missionId(db, 'meditation'), clockAt(FRIDAY, 10));
    deleteMission(db, missionId(db, 'gym'), clockAt(FRIDAY, 10));
    createMission(
      db,
      { kind: 'task', name: 'Rinnovare il passaporto', dueDay: '2026-11-20' },
      clockAt(FRIDAY, 10),
    );
    const linkable = listLinkableMissions(db);
    expect(
      linkable.map((item) => ({
        id: item.mission.id,
        damage: item.damage,
        boss: item.boss?.id ?? null,
      })),
    ).toEqual([
      { id: missionId(db, 'journal'), damage: 2, boss: null },
      { id: read, damage: 5, boss: thesis.id },
      { id: run, damage: 5, boss: null },
    ]);
  });

  it('is empty without habits', () => {
    const db = newGame(['journal']);
    deleteMission(db, missionId(db, 'journal'), clockAt(FRIDAY, 10));
    expect(listLinkableMissions(db)).toEqual([]);
  });
});
