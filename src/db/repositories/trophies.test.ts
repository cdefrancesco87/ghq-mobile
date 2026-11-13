import { asc, eq } from 'drizzle-orm';

import { completeBossStep, createBoss, type NewBoss } from '@/db/repositories/boss';
import { getTrophy, listTrophies } from '@/db/repositories/trophies';
import { bossSteps } from '@/db/schema';
import type { Db } from '@/db/types';
import { victoryReward } from '@/rules/boss';

import { clockAt, FRIDAY, newGame } from '../../../test/game';

const THESIS: NewBoss = { name: 'Tesi', difficulty: 'medium', steps: ['Indice', 'Capitolo'] };

function defeat(db: Db, bossId: string, day: number): void {
  const steps = db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all();
  for (const step of steps) {
    completeBossStep(db, step.id, clockAt(day, 11));
  }
}

describe('listTrophies', () => {
  it('is empty before the first victory', () => {
    const db = newGame(['journal']);
    createBoss(db, THESIS, clockAt(FRIDAY, 10));
    expect(listTrophies(db, clockAt(FRIDAY, 12))).toEqual([]);
  });

  it('lists the defeated bosses from the most recent, with dates, days and rewards', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    const move = createBoss(
      db,
      { ...THESIS, name: 'Trasloco', difficulty: 'hard' },
      clockAt(FRIDAY, 10),
    );
    defeat(db, move.id, FRIDAY + 3);
    defeat(db, thesis.id, FRIDAY + 14);
    const trophies = listTrophies(db, clockAt(FRIDAY + 20, 12));
    expect(
      trophies.map(({ boss, startDay, defeatedDay, daysTaken, xp, coins, stepsTotal }) => ({
        id: boss.id,
        startDay,
        defeatedDay,
        daysTaken,
        xp,
        coins,
        stepsTotal,
      })),
    ).toEqual([
      {
        id: thesis.id,
        startDay: '2026-11-06',
        defeatedDay: '2026-11-20',
        daysTaken: 14,
        ...victoryReward(2, 'medium'),
        stepsTotal: 2,
      },
      {
        id: move.id,
        startDay: '2026-11-06',
        defeatedDay: '2026-11-09',
        daysTaken: 3,
        ...victoryReward(2, 'hard'),
        stepsTotal: 2,
      },
    ]);
    // The quest of the first launch, still active, is not a trophy yet.
    expect(trophies).toHaveLength(2);
  });
});

describe('getTrophy', () => {
  it('reads the trophy of a defeated boss and nothing for one still active', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    expect(getTrophy(db, thesis.id, clockAt(FRIDAY, 12))).toBeNull();
    defeat(db, thesis.id, FRIDAY);
    expect(getTrophy(db, thesis.id, clockAt(FRIDAY, 12))).toEqual({
      startDay: '2026-11-06',
      defeatedDay: '2026-11-06',
      daysTaken: 1,
      ...victoryReward(2, 'medium'),
    });
  });
});
