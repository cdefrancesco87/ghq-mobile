import { asc, eq } from 'drizzle-orm';

import { completeBossStep, createBoss, type NewBoss } from '@/db/repositories/boss';
import { getBossView } from '@/db/repositories/bossView';
import { completeMission } from '@/db/repositories/completion';
import { archiveMission, createMission, deleteMission } from '@/db/repositories/missions';
import { undoEvent } from '@/db/repositories/undo';
import { boss, bossSteps } from '@/db/schema';
import type { Db } from '@/db/types';

import { clockAt, FRIDAY, missionId, newGame } from '../../../test/game';

const MARATHON: NewBoss = {
  name: 'Maratona',
  difficulty: 'medium',
  steps: ['Iscriviti alla gara', 'Corri 10 km', 'Corri 15 km', 'Corri 21 km'],
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

function complete(db: Db, id: string, day: number, hour: number) {
  return completeMission(db, { missionId: id, source: 'app', ...clockAt(day, hour) });
}

describe('getBossView', () => {
  it('gives the steps in order with the day they were done and the next one', () => {
    const db = newGame(['journal']);
    const marathon = createBoss(db, MARATHON, clockAt(FRIDAY, 10));
    const [first, second] = stepIds(db, marathon.id);
    completeBossStep(db, first!, clockAt(FRIDAY, 11));
    // Before the change of day (06:00) the night still belongs to Friday.
    completeBossStep(db, second!, clockAt(FRIDAY + 1, 3));
    const view = getBossView(db, marathon.id, clockAt(FRIDAY + 1, 10));
    expect(view).toMatchObject({
      day: '2026-11-07',
      boss: { id: marathon.id, hp: 40, hpMax: 80 },
      stepsDone: 2,
      stepsTotal: 4,
      nextStep: { id: stepIds(db, marathon.id)[2], title: 'Corri 15 km' },
      defeatedDay: null,
      trophy: null,
    });
    expect(view?.steps.map(({ title, doneDay }) => ({ title, doneDay }))).toEqual([
      { title: 'Iscriviti alla gara', doneDay: '2026-11-06' },
      { title: 'Corri 10 km', doneDay: '2026-11-06' },
      { title: 'Corri 15 km', doneDay: null },
      { title: 'Corri 21 km', doneDay: null },
    ]);
  });

  it('gives the protected hit points: 10 for each step left', () => {
    const db = newGame(['journal']);
    const marathon = createBoss(db, MARATHON, clockAt(FRIDAY, 10));
    expect(getBossView(db, marathon.id, clockAt(FRIDAY, 10))?.protectedHp).toBe(40);
    completeBossStep(db, stepIds(db, marathon.id)[0]!, clockAt(FRIDAY, 11));
    expect(getBossView(db, marathon.id, clockAt(FRIDAY, 11))?.protectedHp).toBe(30);
  });

  it('lists the linked missions with their damage and the damage they dealt, undone ones out', () => {
    const db = newGame(['journal', 'read_pages', 'run', 'meditation', 'gym']);
    const read = missionId(db, 'read_pages');
    const run = missionId(db, 'run');
    const journal = missionId(db, 'journal');
    const marathon = createBoss(
      db,
      {
        ...MARATHON,
        missionIds: [read, run, journal, missionId(db, 'meditation'), missionId(db, 'gym')],
      },
      clockAt(FRIDAY, 10),
    );
    const other = createBoss(db, { ...MARATHON, name: 'Trasloco' }, clockAt(FRIDAY, 10));
    createMission(
      db,
      { name: 'Stretching', difficulty: 'hard', bossId: other.id },
      clockAt(FRIDAY, 10),
    );
    archiveMission(db, missionId(db, 'meditation'), clockAt(FRIDAY, 10));
    deleteMission(db, missionId(db, 'gym'), clockAt(FRIDAY, 10));
    complete(db, read, FRIDAY, 11);
    complete(db, read, FRIDAY + 1, 11);
    const undone = complete(db, run, FRIDAY + 1, 11);
    undoEvent(db, undone.completion!.eventId, clockAt(FRIDAY + 1, 12));

    const view = getBossView(db, marathon.id, clockAt(FRIDAY + 1, 12));
    expect(
      view?.missions.map(({ mission, damage, dealt }) => ({ id: mission.id, damage, dealt })),
    ).toEqual([
      { id: journal, damage: 2, dealt: 0 },
      { id: read, damage: 5, dealt: 10 },
      { id: run, damage: 5, dealt: 0 },
    ]);
  });

  it('counts only the hit points really taken when the bar stops', () => {
    const db = newGame(['read_pages']);
    const read = missionId(db, 'read_pages');
    const quick = createBoss(
      db,
      { name: 'Trasloco', difficulty: 'easy', steps: ['Scatole', 'Furgone'], missionIds: [read] },
      clockAt(FRIDAY, 10),
    );
    db.update(boss).set({ hp: 22 }).where(eq(boss.id, quick.id)).run();
    complete(db, read, FRIDAY, 11);
    const view = getBossView(db, quick.id, clockAt(FRIDAY, 12));
    expect(view?.boss.hp).toBe(20);
    expect(view?.missions[0]?.dealt).toBe(2);
  });

  it('shows a defeated boss with no next step, nothing protected and the day of the victory', () => {
    const db = newGame(['journal']);
    const marathon = createBoss(db, { ...MARATHON, steps: ['Uno', 'Due'] }, clockAt(FRIDAY, 10));
    for (const id of stepIds(db, marathon.id)) {
      completeBossStep(db, id, clockAt(FRIDAY, 11));
    }
    expect(getBossView(db, marathon.id, clockAt(FRIDAY + 1, 10))).toMatchObject({
      boss: { status: 'defeated', hp: 0 },
      stepsDone: 2,
      nextStep: null,
      protectedHp: 0,
      defeatedDay: '2026-11-06',
      trophy: { startDay: '2026-11-06', defeatedDay: '2026-11-06', daysTaken: 1 },
    });
  });

  it('is null for a boss that does not exist', () => {
    const db = newGame(['journal']);
    expect(getBossView(db, 'missing', clockAt(FRIDAY, 10))).toBeNull();
  });
});
