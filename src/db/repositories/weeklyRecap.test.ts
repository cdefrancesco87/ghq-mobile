import { eq } from 'drizzle-orm';

import { completeBossStep, createBoss } from '@/db/repositories/boss';
import { closePendingDays } from '@/db/repositories/closing';
import { completeMission } from '@/db/repositories/completion';
import { setSetting } from '@/db/repositories/settings';
import { undoEvent } from '@/db/repositories/undo';
import {
  currentRecapDay,
  getCurrentWeeklyRecap,
  getPastWeeklyRecaps,
  getStatTrend,
} from '@/db/repositories/weeklyRecap';
import { bossSteps } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, missionId, newGame, TZ } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome; Sunday 15 at 19:00 is the first recap with
// a whole week (9–15). Day numbers past 30 are in December.

const DAILY = ['journal', 'no_social_evening'];

function complete(db: Db, key: string, day: number, hour = 10) {
  closePendingDays(db, clockAt(day, 9));
  return completeMission(db, {
    missionId: missionId(db, key),
    source: 'app',
    now: at(day, hour),
    tzOffset: TZ,
  });
}

describe('currentRecapDay', () => {
  it('shows the week of the last Sunday from 19:00, never before the hero', () => {
    const db = newGame(DAILY);
    expect(currentRecapDay(db, clockAt(7, 12))).toBeNull();
    expect(currentRecapDay(db, clockAt(8, 18))).toBeNull();
    expect(currentRecapDay(db, clockAt(8, 19))).toBe('2026-11-08');
    expect(currentRecapDay(db, clockAt(15, 18))).toBe('2026-11-08');
    expect(currentRecapDay(db, clockAt(15, 19))).toBe('2026-11-15');
    expect(currentRecapDay(db, clockAt(21, 23))).toBe('2026-11-15');
  });

  it('follows the day and the time of the Settings', () => {
    const db = newGame(DAILY);
    setSetting(db, 'weekly_recap', { enabled: false, weekday: 3, time: '08:00' }, at(6, 10));
    expect(currentRecapDay(db, clockAt(18, 7))).toBe('2026-11-11');
    expect(currentRecapDay(db, clockAt(18, 8))).toBe('2026-11-18');
  });
});

describe('getCurrentWeeklyRecap', () => {
  it('tells a good week: most constant mission, levels, points and records', () => {
    const db = newGame(DAILY);
    for (let day = 6; day <= 15; day++) {
      complete(db, 'journal', day);
      if (day % 2 === 0) {
        complete(db, 'no_social_evening', day, 11);
      }
    }
    const view = getCurrentWeeklyRecap(db, clockAt(15, 20))!;
    expect(view).toMatchObject({ firstDay: '2026-11-09', lastDay: '2026-11-15' });
    const { recap } = view;
    expect(recap.mostConsistent).toMatchObject({
      id: missionId(db, 'journal'),
      done: 7,
      expected: 7,
    });
    expect(recap.progress?.statPoints).toBeGreaterThan(0);
    expect(recap.encouragement).toBe(false);
    // The journal from 3 to 10 days; the hero closed the 14th with 9 days, above the 3 of the 8th.
    expect(recap.records).toEqual([
      { missionId: null, name: null, streak: 9 },
      { missionId: missionId(db, 'journal'), name: 'templates.journal.name', streak: 10 },
    ]);
  });

  it('keeps only the successes of a bad week, with the encouragement', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 12);
    const { recap } = getCurrentWeeklyRecap(db, clockAt(15, 20))!;
    expect(recap.mostConsistent).toMatchObject({ id: missionId(db, 'journal'), done: 1 });
    expect(recap.records).toEqual([]);
    expect(recap.encouragement).toBe(true);
  });

  it('counts the damage to the bosses, without undone completions', () => {
    const db = newGame(DAILY);
    // The quest of the first launch is won in the first week.
    for (let day = 6; day <= 8; day++) {
      complete(db, 'journal', day);
    }
    const created = createBoss(
      db,
      {
        name: 'Tesi',
        difficulty: 'medium',
        steps: ['Uno', 'Due', 'Tre'],
        missionIds: [missionId(db, 'journal')],
      },
      clockAt(9, 10),
    );
    const [step] = db
      .select()
      .from(bossSteps)
      .where(eq(bossSteps.bossId, created.id))
      .all()
      .sort((a, b) => a.position - b.position);
    completeBossStep(db, step.id, clockAt(9, 11));
    const done = complete(db, 'no_social_evening', 10);
    const undone = complete(db, 'journal', 11);
    if (
      done.status !== 'completed' ||
      undone.status !== 'completed' ||
      undone.completion === null
    ) {
      throw new Error('Expected completions');
    }
    undoEvent(db, undone.completion.eventId, clockAt(11, 12));
    expect(getCurrentWeeklyRecap(db, clockAt(15, 20))!.recap.bossDamage).toBe(20);

    complete(db, 'journal', 12);
    const damage = getCurrentWeeklyRecap(db, clockAt(15, 20))!.recap.bossDamage!;
    expect(damage).toBeGreaterThan(20);

    // The Essential mode leaves the bosses out.
    setSetting(db, 'game_mode', 'essential', at(15, 20));
    expect(getCurrentWeeklyRecap(db, clockAt(15, 20))!.recap.bossDamage).toBeNull();
  });
});

describe('getPastWeeklyRecaps', () => {
  it('gives the weeks before the current one, not before the hero', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 7);
    const past = getPastWeeklyRecaps(db, clockAt(22, 20));
    expect(past.map((week) => [week.firstDay, week.lastDay])).toEqual([
      ['2026-11-09', '2026-11-15'],
      ['2026-11-06', '2026-11-08'],
    ]);
    expect(past[1].recap.mostConsistent?.done).toBe(1);
  });
});

describe('getStatTrend', () => {
  it('gives the level of the stats month by month, from the month of the hero', () => {
    const db = newGame(DAILY);
    for (let day = 6; day <= 40; day++) {
      complete(db, 'journal', day);
    }
    const trend = getStatTrend(db, clockAt(40, 12));
    expect(trend.months.map((month) => month.month)).toEqual(['2026-11', '2026-12']);
    const [november, december] = trend.months;
    const raised = Object.entries(december.levels).filter(
      ([key, level]) => level > november.levels[key as keyof typeof november.levels],
    );
    expect(raised.length).toBeGreaterThan(0);
    expect(trend.from).toEqual(Object.fromEntries(Object.keys(trend.to).map((key) => [key, 0])));
  });
});
