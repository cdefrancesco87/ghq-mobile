import { asc, eq } from 'drizzle-orm';

import { checkBossDeadlines, createBoss, type NewBoss } from '@/db/repositories/boss';
import { closePendingDays } from '@/db/repositories/closing';
import { completeMission } from '@/db/repositories/completion';
import { appendEvent, type EventType } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import {
  cancelPause,
  changePauseEnd,
  getGeneralPause,
  pauseIntervalsOf,
  resumePause,
  startPause,
} from '@/db/repositories/pause';
import { listHabitsView } from '@/db/repositories/habitsView';
import { getSetting } from '@/db/repositories/settings';
import { companionOn } from '@/db/repositories/todayView';
import { buyItem } from '@/db/repositories/shop';
import { boss, daySummaries, events, hero, inventory, missions } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, expectHeroMatchesLog, missionId, newGame, TZ } from '../../../test/game';

// The game starts on Friday 6 November 2026 (test/game.ts).

function giveCoins(db: Db, coins: number): void {
  const change = changeHero(db, { coins }, at(6, 8));
  appendEvent(db, {
    type: 'bonus.full_day',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-06',
    deltas: change.deltas,
  });
}

function eventsOf(db: Db, type: EventType) {
  return db.select().from(events).where(eq(events.type, type)).orderBy(asc(events.seq)).all();
}

function summaries(db: Db) {
  return db.select().from(daySummaries).orderBy(asc(daySummaries.gameDay)).all();
}

const shields = (db: Db) =>
  db.select().from(inventory).where(eq(inventory.itemKey, 'shield')).get()?.quantity ?? 0;

const THESIS: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  deadlineDay: '2026-11-12',
  steps: ['Indice', 'Capitolo 1', 'Capitolo 2'],
};

describe('startPause', () => {
  it('starts a pause today with its event and the setting', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-06', untilDay: '2026-11-10' }, clockAt(6, 10));
    expect(getSetting(db, 'general_pause')).toEqual({
      from_day: '2026-11-06',
      until_day: '2026-11-10',
    });
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: '2026-11-10' });
    expect(eventsOf(db, 'pause.started')).toEqual([
      expect.objectContaining({
        gameDay: '2026-11-06',
        payload: { fromDay: '2026-11-06', untilDay: '2026-11-10' },
      }),
    ]);
  });

  it('starts a pause without an end', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-08', untilDay: null }, clockAt(6, 10));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-08', untilDay: null });
  });

  it('refuses a start in the past, dates the wrong way round and a second pause', () => {
    const db = newGame(['journal']);
    expect(() => startPause(db, { fromDay: '2026-11-05', untilDay: null }, clockAt(6, 10))).toThrow(
      RangeError,
    );
    expect(() =>
      startPause(db, { fromDay: '2026-11-08', untilDay: '2026-11-07' }, clockAt(6, 10)),
    ).toThrow(RangeError);
    startPause(db, { fromDay: '2026-11-20', untilDay: null }, clockAt(6, 10));
    expect(() =>
      startPause(db, { fromDay: '2026-11-08', untilDay: '2026-11-09' }, clockAt(6, 10)),
    ).toThrow(/already/);
    expect(eventsOf(db, 'pause.started')).toHaveLength(1);
  });
});

describe('cancelPause', () => {
  it('cancels a scheduled pause before its start', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-10', untilDay: '2026-11-12' }, clockAt(6, 10));
    cancelPause(db, clockAt(7, 10));
    expect(getGeneralPause(db)).toBeNull();
    expect(eventsOf(db, 'pause.ended')).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          fromDay: '2026-11-10',
          untilDay: '2026-11-12',
          cancelled: true,
        }),
      }),
    ]);
    expect(pauseIntervalsOf(db)).toEqual([]);
    // The days of the cancelled pause count as usual.
    closePendingDays(db, clockAt(12, 10));
    expect(summaries(db).filter((row) => row.isPaused)).toEqual([]);
  });

  it('refuses a pause already started and no pause at all', () => {
    const db = newGame(['journal']);
    expect(() => cancelPause(db, clockAt(6, 10))).toThrow();
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(6, 10));
    expect(() => cancelPause(db, clockAt(6, 11))).toThrow();
  });
});

describe('changePauseEnd', () => {
  it('changes the end during the pause with the old and the new day', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-06', untilDay: '2026-11-08' }, clockAt(6, 10));
    changePauseEnd(db, '2026-11-15', clockAt(7, 10));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: '2026-11-15' });
    changePauseEnd(db, null, clockAt(7, 11));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: null });
    expect(eventsOf(db, 'pause.changed').map((event) => event.payload)).toEqual([
      { fromDay: '2026-11-06', oldUntilDay: '2026-11-08', untilDay: '2026-11-15' },
      { fromDay: '2026-11-06', oldUntilDay: '2026-11-15', untilDay: null },
    ]);
    // The days up to the new end are paused.
    closePendingDays(db, clockAt(10, 10));
    expect(summaries(db).map((row) => [row.gameDay, row.isPaused])).toEqual([
      ['2026-11-06', true],
      ['2026-11-07', true],
      ['2026-11-08', true],
      ['2026-11-09', true],
    ]);
  });

  it('refuses an end before today or before the start', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(6, 10));
    expect(() => changePauseEnd(db, '2026-11-07', clockAt(8, 10))).toThrow(RangeError);
    const later = newGame(['journal']);
    startPause(later, { fromDay: '2026-11-10', untilDay: null }, clockAt(6, 10));
    expect(() => changePauseEnd(later, '2026-11-09', clockAt(6, 10))).toThrow(RangeError);
    expect(() => changePauseEnd(newGame([]), null, clockAt(6, 10))).toThrow();
  });
});

describe('the days of a general pause', () => {
  it('keep hit points and shields over 5 paused days with missed missions, and the streak breaks', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    giveCoins(db, 100);
    buyItem(db, 'shield', clockAt(6, 9));
    completeMission(db, { missionId: journal, source: 'app', ...clockAt(6, 10) });
    startPause(db, { fromDay: '2026-11-07', untilDay: '2026-11-11' }, clockAt(6, 11));
    const hpBefore = db.select().from(hero).get()!.hp;

    closePendingDays(db, clockAt(12, 10));

    expect(summaries(db).map((row) => [row.gameDay, row.isPaused, row.hpLost])).toEqual([
      ['2026-11-06', false, 0],
      ['2026-11-07', true, 0],
      ['2026-11-08', true, 0],
      ['2026-11-09', true, 0],
      ['2026-11-10', true, 0],
      ['2026-11-11', true, 0],
    ]);
    expect(db.select().from(hero).get()).toMatchObject({ hp: hpBefore, streak: 0 });
    expect(shields(db)).toBe(1);
    expect(eventsOf(db, 'shield.consumed')).toEqual([]);
    expect(db.select().from(missions).where(eq(missions.id, journal)).get()?.streak).toBe(0);
    expectHeroMatchesLog(db);
  });

  it('starts a scheduled pause on the right day', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-09', untilDay: '2026-11-10' }, clockAt(6, 10));
    closePendingDays(db, clockAt(12, 10));
    expect(summaries(db).map((row) => [row.gameDay, row.isPaused, row.hpLost > 0])).toEqual([
      ['2026-11-06', false, true],
      ['2026-11-07', false, true],
      ['2026-11-08', false, true],
      ['2026-11-09', true, false],
      ['2026-11-10', true, false],
      ['2026-11-11', false, true],
    ]);
  });

  it('give the usual rewards to the completions made during the pause', () => {
    const paused = newGame(['journal']);
    const normal = newGame(['journal']);
    startPause(paused, { fromDay: '2026-11-06', untilDay: null }, clockAt(6, 9));
    const a = completeMission(paused, {
      missionId: missionId(paused, 'journal'),
      source: 'app',
      ...clockAt(6, 10),
    });
    const b = completeMission(normal, {
      missionId: missionId(normal, 'journal'),
      source: 'app',
      ...clockAt(6, 10),
    });
    expect(a.status).toBe('completed');
    expect(a.completion).toMatchObject({ xp: b.completion!.xp, coins: b.completion!.coins });
    const stats = (db: Db) => eventsOf(db, 'mission.completed').map((event) => event.dStats);
    expect(stats(paused)).toEqual(stats(normal));
    const totals = (db: Db) => {
      const row = db.select().from(hero).get()!;
      return [row.xpTotal, row.coins];
    };
    expect(totals(paused)).toEqual(totals(normal));
    expectHeroMatchesLog(paused);
  });

  it('ends by itself after its last day, and closing again changes nothing', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-07', untilDay: '2026-11-08' }, clockAt(6, 10));
    closePendingDays(db, clockAt(9, 10));
    expect(getGeneralPause(db)).toBeNull();
    expect(eventsOf(db, 'pause.ended')).toEqual([
      expect.objectContaining({
        gameDay: '2026-11-09',
        payload: { fromDay: '2026-11-07', untilDay: '2026-11-08', days: 2, bosses: [] },
      }),
    ]);
    expect(pauseIntervalsOf(db)).toEqual([{ fromDay: '2026-11-07', untilDay: '2026-11-08' }]);
    const before = { summaries: summaries(db), hero: db.select().from(hero).get() };
    expect(closePendingDays(db, clockAt(9, 12))).toEqual([]);
    expect({ summaries: summaries(db), hero: db.select().from(hero).get() }).toEqual(before);
    expect(eventsOf(db, 'pause.ended')).toHaveLength(1);
    expectHeroMatchesLog(db);
  });

  it('with «Riprendi» makes today the last paused day: from tomorrow everything counts', () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-07', untilDay: null }, clockAt(6, 10));
    resumePause(db, clockAt(9, 10));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-07', untilDay: '2026-11-09' });
    expect(eventsOf(db, 'pause.changed')).toEqual([
      expect.objectContaining({
        payload: {
          fromDay: '2026-11-07',
          oldUntilDay: null,
          untilDay: '2026-11-09',
          resumed: true,
        },
      }),
    ]);
    closePendingDays(db, clockAt(11, 10));
    expect(summaries(db).map((row) => [row.gameDay, row.isPaused])).toEqual([
      ['2026-11-06', false],
      ['2026-11-07', true],
      ['2026-11-08', true],
      ['2026-11-09', true],
      ['2026-11-10', false],
    ]);
    expect(summaries(db)[4].hpLost).toBeGreaterThan(0);
    expect(getGeneralPause(db)).toBeNull();
  });

  it('refuses «Riprendi» before the start or without a pause', () => {
    const db = newGame(['journal']);
    expect(() => resumePause(db, clockAt(6, 10))).toThrow();
    startPause(db, { fromDay: '2026-11-10', untilDay: null }, clockAt(6, 10));
    expect(() => resumePause(db, clockAt(6, 11))).toThrow();
  });
});

describe('the boss deadlines and the general pause', () => {
  it('moves forward by the paused days a deadline inside the pause, with no theft', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1000);
    const thesis = createBoss(db, THESIS, clockAt(6, 10));
    startPause(db, { fromDay: '2026-11-10', untilDay: '2026-11-14' }, clockAt(6, 11));
    // No warning 3 days before a deadline that falls in the pause, and nothing during it.
    expect(checkBossDeadlines(db, clockAt(9, 10))).toEqual({ warned: [], robbed: [] });
    expect(checkBossDeadlines(db, clockAt(13, 10))).toEqual({ warned: [], robbed: [] });

    closePendingDays(db, clockAt(15, 10));
    const moved = db.select().from(boss).where(eq(boss.id, thesis.id)).get()!;
    expect(moved).toMatchObject({ deadlineDay: '2026-11-17', deadlineWarned: false });
    expect(eventsOf(db, 'pause.ended')[0].payload).toEqual({
      fromDay: '2026-11-10',
      untilDay: '2026-11-14',
      days: 5,
      bosses: [{ bossId: thesis.id, oldDeadlineDay: '2026-11-12', deadlineDay: '2026-11-17' }],
    });
    // The warning is computed again from the new deadline.
    expect(checkBossDeadlines(db, clockAt(15, 10))).toEqual({ warned: [thesis.id], robbed: [] });
    expect(eventsOf(db, 'boss.deadline_missed')).toEqual([]);
    expect(db.select().from(hero).get()?.coins).toBe(1000);
  });

  it('leaves as it is a deadline passed before the pause, with its single theft', () => {
    const db = newGame(['journal']);
    giveCoins(db, 1000);
    const thesis = createBoss(db, THESIS, clockAt(6, 10));
    expect(checkBossDeadlines(db, clockAt(13, 10)).robbed).toEqual([
      { bossId: thesis.id, coins: 100 },
    ]);
    startPause(db, { fromDay: '2026-11-13', untilDay: '2026-11-14' }, clockAt(13, 11));
    closePendingDays(db, clockAt(16, 10));
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.deadlineDay).toBe(
      '2026-11-12',
    );
    expect(checkBossDeadlines(db, clockAt(16, 10)).robbed).toEqual([]);
    expect(eventsOf(db, 'boss.deadline_missed')).toHaveLength(1);
  });

  it('moves a deadline by the days of a pause ended with «Riprendi»', () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(6, 10));
    startPause(db, { fromDay: '2026-11-08', untilDay: null }, clockAt(6, 11));
    resumePause(db, clockAt(10, 10));
    closePendingDays(db, clockAt(11, 10));
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.deadlineDay).toBe(
      '2026-11-15',
    );
  });
});

describe('the mood of the companion and the general pause', () => {
  function playedThreeDays(withPause: boolean): Db {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    for (const day of [6, 7, 8]) {
      completeMission(db, { missionId: journal, source: 'app', ...clockAt(day, 10) });
    }
    if (withPause) {
      startPause(db, { fromDay: '2026-11-09', untilDay: '2026-11-12' }, clockAt(8, 11));
    }
    closePendingDays(db, clockAt(12, 10));
    return db;
  }

  it('leaves the empty paused days out of the window', () => {
    expect(companionOn(playedThreeDays(false), '2026-11-12', 0).mood).toBe('sad');
    const db = playedThreeDays(true);
    expect(companionOn(db, '2026-11-12', 0).mood).toBe('happy');
    closePendingDays(db, clockAt(13, 10));
    expect(companionOn(db, '2026-11-13', 0).mood).toBe('happy');
    expect(companionOn(db, '2026-11-13', 1).mood).toBe('happy');
  });
});

describe('the rates and the general pause', () => {
  it('leave the paused days out of the rate of Habits', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    completeMission(db, { missionId: journal, source: 'app', ...clockAt(6, 10) });
    startPause(db, { fromDay: '2026-11-07', untilDay: '2026-11-09' }, clockAt(6, 11));
    completeMission(db, { missionId: journal, source: 'app', ...clockAt(10, 10) });
    // 6 and 10 done, 7–9 paused, 11 (today) not done yet: 2 of 2.
    const view = listHabitsView(db, clockAt(11, 10));
    const row = view.categories.flatMap((category) => category.items)[0];
    expect(row.completionRate).toBe(100);
  });
});
