import { completeBossStep, createBoss } from '@/db/repositories/boss';
import { closePendingDays } from '@/db/repositories/closing';
import { completeMission } from '@/db/repositories/completion';
import { deleteMission } from '@/db/repositories/missions';
import { startPause } from '@/db/repositories/pause';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { openTale, type TaleOpening } from '@/db/repositories/tale';
import { bossSteps } from '@/db/schema';
import type { Db } from '@/db/types';
import type { Mood } from '@/rules/companion';

import { clockAt, missionId, newGame } from '../../../test/game';

// The game starts on Friday 6 November 2026 (test/game.ts).

const OPENING: TaleOpening = {
  mood: 'normal',
  variants: (group) => [`${group}.1`, `${group}.2`],
  random: () => 0,
};

/** Opens the app on a day of November at 9, after closing the pending days as the start does. */
function openOn(db: Db, day: number, mood: Mood = 'normal') {
  closePendingDays(db, clockAt(day, 9));
  return openTale(db, clockAt(day, 9), { ...OPENING, mood });
}

function complete(db: Db, key: string, day: number): void {
  completeMission(db, { missionId: missionId(db, key), source: 'app', ...clockAt(day, 10) });
}

describe('openTale', () => {
  it('stays silent on the first day and records the opening', () => {
    const db = newGame(['journal']);
    expect(openOn(db, 6)).toBeNull();
    expect(getSetting(db, 'tale')).toEqual({
      shown_day: null,
      last_open_day: '2026-11-06',
      recent: [],
    });
  });

  it('tells a partial day once, in the mood given, and not again until tomorrow', () => {
    const db = newGame(['journal', 'meditation']);
    openOn(db, 6);
    complete(db, 'journal', 6);
    const bubble = openOn(db, 7, 'sad');
    expect(bubble).toEqual({
      day: '2026-11-07',
      situation: 'partialDay',
      mood: 'sad',
      voice: 'cloudy',
      keys: ['tale.cloudy.partialDay.sad.1', 'tale.cloudy.encouragement.sad.1'],
      params: { done: 1, scheduled: 2, streak: 1, days: 0, boss: null },
    });
    expect(getSetting(db, 'tale')).toEqual({
      shown_day: '2026-11-07',
      last_open_day: '2026-11-07',
      recent: ['tale.cloudy.partialDay.sad.1', 'tale.cloudy.encouragement.sad.1'],
    });
    expect(openOn(db, 7)).toBeNull();
    expect(openOn(db, 8)?.situation).toBe('emptyDay');
  });

  it('does not repeat the variants used lately', () => {
    const db = newGame(['journal']);
    openOn(db, 6);
    expect(openOn(db, 7)?.keys).toEqual([
      'tale.cloudy.emptyDay.normal.1',
      'tale.cloudy.encouragement.normal.1',
    ]);
    expect(openOn(db, 8)?.keys).toEqual([
      'tale.cloudy.emptyDay.normal.2',
      'tale.cloudy.encouragement.normal.2',
    ]);
  });

  it('tells a full day in the voice of the theme', () => {
    const db = newGame(['journal']);
    setSetting(db, 'theme', 'fantasy', clockAt(6, 9).now);
    openOn(db, 6);
    complete(db, 'journal', 6);
    expect(openOn(db, 7)?.keys[0]).toBe('tale.rocky.fullDay.normal.1');
  });

  it('tells a rest day', () => {
    const db = newGame(['journal']);
    openOn(db, 6);
    setSetting(db, 'rest_days', [6], clockAt(6, 9).now);
    expect(openOn(db, 8)?.situation).toBe('restDay');
  });

  it('stays silent after a day with nothing expected', () => {
    const db = newGame(['journal']);
    deleteMission(db, missionId(db, 'journal'), clockAt(6, 8));
    openOn(db, 6);
    expect(openOn(db, 7)).toBeNull();
    expect(getSetting(db, 'tale').last_open_day).toBe('2026-11-07');
  });

  it('welcomes the hero back after 2 days without opening', () => {
    const db = newGame(['journal']);
    openOn(db, 6);
    expect(openOn(db, 9)).toEqual(
      expect.objectContaining({
        situation: 'absence',
        params: expect.objectContaining({ days: 2 }),
      }),
    );
  });

  it('stays silent during the general pause, then tells the return from it', () => {
    const db = newGame(['journal']);
    openOn(db, 6);
    startPause(db, { fromDay: '2026-11-07', untilDay: '2026-11-08' }, clockAt(6, 12));
    expect(openOn(db, 7)).toBeNull();
    expect(openOn(db, 8)).toBeNull();
    expect(getSetting(db, 'tale').last_open_day).toBe('2026-11-08');
    expect(openOn(db, 9)).toEqual(
      expect.objectContaining({
        situation: 'pauseReturn',
        params: expect.objectContaining({ days: 2 }),
      }),
    );
  });

  it('tells a boss defeated yesterday, but not in the Essential mode', () => {
    const run = (essential: boolean) => {
      const db = newGame(['journal']);
      if (essential) {
        setSetting(db, 'game_mode', 'essential', clockAt(6, 9).now);
      }
      openOn(db, 6);
      const created = createBoss(
        db,
        { name: 'Tesi', difficulty: 'easy', deadlineDay: null, steps: ['Indice', 'Capitolo'] },
        clockAt(6, 10),
      );
      for (const step of db.select().from(bossSteps).all()) {
        if (step.bossId === created.id) {
          completeBossStep(db, step.id, clockAt(6, 11));
        }
      }
      return openOn(db, 7);
    };
    expect(run(false)).toEqual(
      expect.objectContaining({
        situation: 'bossDefeated',
        params: expect.objectContaining({ boss: { name: 'Tesi', starter: false } }),
      }),
    );
    expect(run(true)?.situation).toBe('emptyDay');
  });

  it('tells the streak record on the day it beats a record of at least 3 days (choice 26)', () => {
    const db = newGame(['journal']);
    const situations: (string | undefined)[] = [];
    // Streak 4 at the close of the 9th, broken on the 10th, then 5 days again from the 11th.
    for (let day = 6; day <= 16; day++) {
      situations.push(openOn(db, day)?.situation);
      if (day !== 10) {
        complete(db, 'journal', day);
      }
    }
    expect(situations).toEqual([
      undefined,
      'fullDay',
      'fullDay',
      'fullDay',
      'fullDay',
      'emptyDay',
      'fullDay',
      'fullDay',
      'fullDay',
      'fullDay',
      'streakRecord',
    ]);
  });
});
