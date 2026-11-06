import {
  closeDays,
  type CloseDaysInput,
  type CloseMission,
  type CloseMissionDay,
} from '@/rules/closeDays';
import type { GameDay } from '@/rules/types';

// 2026-11-01 is a Sunday: 2026-11-02 … 2026-11-08 is a week from Monday to Sunday.

function mission(id: string, overrides: Partial<CloseMission> = {}): CloseMission {
  return {
    id,
    kind: 'habit',
    difficulty: 'medium',
    frequency: { type: 'daily' },
    dueDay: null,
    status: 'active',
    pausedUntil: null,
    deletedAt: null,
    createdDay: '2026-10-01',
    streak: 0,
    streakBest: 0,
    ...overrides,
  };
}

function done(missionId: string, ...days: GameDay[]): CloseMissionDay[] {
  return days.map((gameDay) => ({ missionId, gameDay, status: 'done' }));
}

function input(overrides: Partial<CloseDaysInput> = {}): CloseDaysInput {
  return {
    lastClosedDay: '2026-11-01',
    today: '2026-11-03',
    missions: [],
    missionDays: [],
    hero: { hp: 40, streak: 3, streakBest: 5, exhaustedDay: null },
    inventory: { shields: 0 },
    settings: { gameMode: 'full', weekStart: 1, restDays: [] },
    ...overrides,
  };
}

describe('closeDays', () => {
  it('closes nothing when the last closed day is yesterday', () => {
    const start = input({ lastClosedDay: '2026-11-02', missions: [mission('a')] });
    const result = closeDays(start);
    expect(result.days).toEqual([]);
    expect(result.hero).toEqual(start.hero);
    expect(result.inventory).toEqual(start.inventory);
    expect(result.missionStreaks).toEqual([]);
  });

  it('closes 5 days in one go', () => {
    const result = closeDays(
      input({
        lastClosedDay: '2026-11-01',
        today: '2026-11-07',
        missions: [
          mission('a', { streak: 3, streakBest: 3 }),
          mission('b', { difficulty: 'easy', streak: 2, streakBest: 4 }),
        ],
        missionDays: [
          ...done('a', '2026-11-02', '2026-11-03', '2026-11-06'),
          ...done('b', '2026-11-03'),
        ],
        // Thursday 2026-11-05 is a rest day.
        settings: { gameMode: 'full', weekStart: 1, restDays: [4] },
      }),
    );

    expect(result.days.map((day) => day.summary)).toEqual([
      {
        gameDay: '2026-11-02',
        scheduledCount: 2,
        doneCount: 1,
        scheduledXp: 35,
        missedXp: 10,
        hpLost: 3,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: false,
      },
      {
        gameDay: '2026-11-03',
        scheduledCount: 2,
        doneCount: 2,
        scheduledXp: 35,
        missedXp: 0,
        hpLost: 0,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: false,
      },
      {
        gameDay: '2026-11-04',
        scheduledCount: 2,
        doneCount: 0,
        scheduledXp: 35,
        missedXp: 35,
        hpLost: 10,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: false,
      },
      {
        gameDay: '2026-11-05',
        scheduledCount: 0,
        doneCount: 0,
        scheduledXp: 0,
        missedXp: 0,
        hpLost: 0,
        isRestDay: true,
        fullDay: false,
        planComplete: false,
        shieldUsed: false,
      },
      {
        gameDay: '2026-11-06',
        scheduledCount: 2,
        doneCount: 1,
        scheduledXp: 35,
        missedXp: 10,
        hpLost: 3,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: false,
      },
    ]);
    expect(result.days.map((day) => day.hpDelta)).toEqual([-3, 0, -10, 0, -3]);
    expect(result.days.map((day) => day.heroStreak)).toEqual([
      { streak: 4, best: 5 },
      { streak: 5, best: 5 },
      { streak: 0, best: 5 },
      { streak: 0, best: 5 },
      { streak: 1, best: 5 },
    ]);
    expect(result.hero).toEqual({ hp: 24, streak: 1, streakBest: 5, exhaustedDay: null });
    // Completions grow a mission streak when they happen: the close only breaks it.
    expect(result.days[0].missionStreaks).toEqual([{ missionId: 'b', streak: 0, best: 4 }]);
    expect(result.missionStreaks).toEqual([
      { missionId: 'a', streak: 0, best: 3 },
      { missionId: 'b', streak: 0, best: 4 },
    ]);
  });

  it('changes nothing when run again on its own result', () => {
    const start = input({
      lastClosedDay: '2026-11-01',
      today: '2026-11-05',
      missions: [mission('a', { streak: 1, streakBest: 1 })],
      missionDays: done('a', '2026-11-03'),
      inventory: { shields: 1 },
    });
    const first = closeDays(start);
    expect(first.days).toHaveLength(3);
    expect(closeDays(start)).toEqual(first);

    const again = closeDays({
      ...start,
      lastClosedDay: first.days[first.days.length - 1].summary.gameDay,
      hero: first.hero,
      inventory: first.inventory,
    });
    expect(again.days).toEqual([]);
    expect(again.hero).toEqual(first.hero);
    expect(again.inventory).toEqual(first.inventory);
  });

  it('creates no false missed days after a flight that moves the game day back', () => {
    const start = input({ lastClosedDay: '2026-11-05', missions: [mission('a')] });
    for (const today of ['2026-11-04', '2026-11-05', '2026-11-06'] as const) {
      const result = closeDays({ ...start, today });
      expect(result.days).toEqual([]);
      expect(result.hero).toEqual(start.hero);
    }
  });

  it('exhausts the hero the day after hit points reach 0 and gives back 13 at its close', () => {
    const result = closeDays(
      input({
        lastClosedDay: '2026-11-01',
        today: '2026-11-05',
        missions: [mission('a', { difficulty: 'hard' })],
        hero: { hp: 8, streak: 2, streakBest: 2, exhaustedDay: null },
      }),
    );

    expect(result.days.map((day) => day.summary.hpLost)).toEqual([10, 10, 10]);
    expect(result.days.map((day) => day.hpDelta)).toEqual([-8, 13, -10]);
    expect(result.days.map((day) => day.exhaustedNextDay)).toEqual([true, false, false]);
    expect(result.hero).toEqual({ hp: 3, streak: 0, streakBest: 2, exhaustedDay: '2026-11-03' });
  });

  it('gives back 13 hit points when the exhausted day was before the days to close', () => {
    const result = closeDays(
      input({
        lastClosedDay: '2026-11-01',
        missions: [mission('a')],
        missionDays: done('a', '2026-11-02'),
        hero: { hp: 1, streak: 0, streakBest: 4, exhaustedDay: '2026-11-02' },
      }),
    );
    expect(result.days[0].hpDelta).toBe(12);
    expect(result.hero.hp).toBe(13);
  });

  it('uses a shield on a day without completions and keeps the second one', () => {
    const result = closeDays(
      input({
        lastClosedDay: '2026-11-01',
        today: '2026-11-04',
        missions: [
          mission('a', { streak: 6, streakBest: 6 }),
          mission('b', { difficulty: 'easy', streak: 4, streakBest: 4 }),
        ],
        missionDays: done('a', '2026-11-03'),
        hero: { hp: 40, streak: 6, streakBest: 6, exhaustedDay: null },
        inventory: { shields: 2 },
      }),
    );

    // 2026-11-02: nothing done, the shield saves every streak; hit points are lost anyway.
    expect(result.days[0].summary).toMatchObject({ shieldUsed: true, hpLost: 10 });
    expect(result.days[0].heroStreak).toEqual({ streak: 6, best: 6 });
    expect(result.days[0].missionStreaks).toEqual([]);
    // 2026-11-03: one completion, so no shield: the missed mission breaks its streak.
    expect(result.days[1].summary).toMatchObject({ shieldUsed: false, hpLost: 3 });
    expect(result.days[1].heroStreak).toEqual({ streak: 7, best: 7 });
    expect(result.days[1].missionStreaks).toEqual([{ missionId: 'b', streak: 0, best: 4 }]);

    expect(result.inventory).toEqual({ shields: 1 });
    expect(result.missionStreaks).toEqual([{ missionId: 'b', streak: 0, best: 4 }]);
  });

  it('breaks the streaks on a second missed day when the only shield is used', () => {
    const result = closeDays(
      input({
        lastClosedDay: '2026-11-01',
        today: '2026-11-04',
        missions: [mission('a', { streak: 6, streakBest: 6 })],
        hero: { hp: 40, streak: 6, streakBest: 6, exhaustedDay: null },
        inventory: { shields: 1 },
      }),
    );
    expect(result.days.map((day) => day.summary.shieldUsed)).toEqual([true, false]);
    expect(result.hero.streak).toBe(0);
    expect(result.inventory).toEqual({ shields: 0 });
    expect(result.missionStreaks).toEqual([{ missionId: 'a', streak: 0, best: 6 }]);
  });

  it('treats a day without missions due as a rest day', () => {
    const result = closeDays(
      input({
        missions: [mission('a', { frequency: { type: 'weekdays', days: [3] } })],
        inventory: { shields: 1 },
      }),
    );
    expect(result.days[0].summary).toMatchObject({
      scheduledCount: 0,
      hpLost: 0,
      isRestDay: false,
      shieldUsed: false,
    });
    expect(result.hero).toEqual(input().hero);
    expect(result.inventory).toEqual({ shields: 1 });
  });

  it('leaves out skipped, paused, deleted and not yet created missions', () => {
    const result = closeDays(
      input({
        missions: [
          mission('done'),
          mission('skipped'),
          mission('paused', { status: 'paused', pausedUntil: '2026-11-10' }),
          mission('deleted', { deletedAt: 1 }),
          mission('new', { createdDay: '2026-11-03' }),
        ],
        missionDays: [
          ...done('done', '2026-11-02'),
          { missionId: 'skipped', gameDay: '2026-11-02', status: 'skipped' },
        ],
      }),
    );
    expect(result.days[0].summary).toMatchObject({ scheduledCount: 1, doneCount: 1, hpLost: 0 });
    expect(result.missionStreaks).toEqual([]);
  });

  it('counts a partial measurable mission as missed', () => {
    const result = closeDays(
      input({
        missions: [mission('a', { streak: 2, streakBest: 2 })],
        missionDays: [{ missionId: 'a', gameDay: '2026-11-02', status: 'partial' }],
      }),
    );
    expect(result.days[0].summary).toMatchObject({ doneCount: 0, missedXp: 25, hpLost: 10 });
    expect(result.missionStreaks).toEqual([{ missionId: 'a', streak: 0, best: 2 }]);
  });

  it('loses no hit points in the Essential mode', () => {
    const result = closeDays(
      input({
        missions: [mission('a')],
        settings: { gameMode: 'essential', weekStart: 1, restDays: [] },
      }),
    );
    expect(result.days[0].summary).toMatchObject({ missedXp: 25, hpLost: 0 });
    expect(result.hero.hp).toBe(40);
  });

  it('copies the day bonuses already given', () => {
    const result = closeDays(
      input({
        today: '2026-11-04',
        missions: [mission('a')],
        missionDays: done('a', '2026-11-02', '2026-11-03'),
        bonuses: { fullDays: ['2026-11-02', '2026-11-03'], planDays: ['2026-11-03'] },
      }),
    );
    expect(result.days.map((day) => [day.summary.fullDay, day.summary.planComplete])).toEqual([
      [true, false],
      [true, true],
    ]);
  });

  describe('«N volte a settimana» missions', () => {
    const weekly = (overrides: Partial<CloseMission> = {}) =>
      mission('w', { frequency: { type: 'times_per_week', times: 3 }, ...overrides });

    it('cost nothing during the week and count the missing times on its last day', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 }), mission('d', { difficulty: 'easy' })],
          missionDays: [
            ...done('w', '2026-11-03'),
            ...done(
              'd',
              '2026-11-02',
              '2026-11-03',
              '2026-11-04',
              '2026-11-05',
              '2026-11-06',
              '2026-11-07',
              '2026-11-08',
            ),
          ],
        }),
      );

      const summaries = result.days.map((day) => day.summary);
      expect(summaries.slice(0, 6).map((summary) => summary.hpLost)).toEqual([0, 0, 0, 0, 0, 0]);
      // The completion counts on the day it happens.
      expect(summaries[1]).toMatchObject({ scheduledCount: 2, doneCount: 2, scheduledXp: 35 });
      expect(summaries[0]).toMatchObject({ scheduledCount: 1, doneCount: 1, scheduledXp: 10 });
      // Sunday: 1 of 3, so 2 missed times of 25 XP, plus the easy mission done.
      expect(summaries[6]).toMatchObject({
        gameDay: '2026-11-08',
        scheduledCount: 3,
        doneCount: 1,
        scheduledXp: 60,
        missedXp: 50,
        hpLost: 8,
      });
      expect(result.days[6].missionStreaks).toEqual([{ missionId: 'w', streak: 0, best: 2 }]);
      expect(result.days.slice(0, 6).every((day) => day.missionStreaks.length === 0)).toBe(true);
    });

    it('grow their streak by one for every week with at least N completions', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 })],
          missionDays: done('w', '2026-11-02', '2026-11-04', '2026-11-08'),
        }),
      );
      expect(result.days[6].summary).toMatchObject({
        scheduledCount: 1,
        doneCount: 1,
        missedXp: 0,
        hpLost: 0,
      });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 3, best: 3 }]);
    });

    it('end the week on the day before the week start of the settings', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-06',
          today: '2026-11-09',
          missions: [weekly()],
          settings: { gameMode: 'full', weekStart: 7, restDays: [] },
        }),
      );
      // With weeks from Sunday, Saturday 2026-11-07 is the last day.
      expect(result.days.map((day) => day.summary.missedXp)).toEqual([75, 0]);
    });

    it('are evaluated on the last day of the week even when it is a rest day (choice 15)', () => {
      // Week Mon–Sun, Sunday is a rest day. 3 done of 3 required: streak grows.
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 })],
          settings: { gameMode: 'full', weekStart: 1, restDays: [7] },
          missionDays: done('w', '2026-11-02', '2026-11-04', '2026-11-06'),
        }),
      );
      // Sunday 2026-11-08 is a rest day but is the last day of the week.
      expect(result.days[6].summary).toMatchObject({ isRestDay: true, hpLost: 0, missedXp: 0 });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 3, best: 3 }]);
    });

    it('breaks the mission streak on the last rest day when N was not reached (choice 15)', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 })],
          settings: { gameMode: 'full', weekStart: 1, restDays: [7] },
          // 1 of 3 done: streak breaks on rest-day Sunday
          missionDays: done('w', '2026-11-03'),
        }),
      );
      expect(result.days[6].summary).toMatchObject({ isRestDay: true, hpLost: 0 });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 0, best: 2 }]);
    });

    it('does not lose hp and does not break the streak on the first partial week (choice 16)', () => {
      // Mission created 2026-11-04 (Wednesday), evaluated Sunday 2026-11-08: 0 of 3 done.
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [
            mission('w', {
              frequency: { type: 'times_per_week', times: 3 },
              createdDay: '2026-11-04',
              streak: 0,
              streakBest: 0,
            }),
          ],
        }),
      );
      expect(result.days[6].summary).toMatchObject({ hpLost: 0, missedXp: 0 });
      expect(result.missionStreaks).toEqual([]);
    });

    it('grows the streak on the first partial week when N is reached (choice 16)', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [
            mission('w', {
              frequency: { type: 'times_per_week', times: 2 },
              createdDay: '2026-11-05',
              streak: 0,
              streakBest: 0,
            }),
          ],
          missionDays: done('w', '2026-11-05', '2026-11-07'),
        }),
      );
      expect(result.days[6].summary).toMatchObject({ hpLost: 0, missedXp: 0 });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 1, best: 1 }]);
    });

    it('reduces required times by skips in the week, minimum 0 (choice 17)', () => {
      // 3 required, 2 skips → effective 1; 1 done → 0 missed, streak grows.
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 })],
          missionDays: [
            ...done('w', '2026-11-03'),
            { missionId: 'w', gameDay: '2026-11-05', status: 'skipped' },
            { missionId: 'w', gameDay: '2026-11-07', status: 'skipped' },
          ],
        }),
      );
      expect(result.days[6].summary).toMatchObject({ missedXp: 0 });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 3, best: 3 }]);
    });

    it('clamps to 0 when skips exceed the required times (choice 17)', () => {
      // 3 required, 4 skips → effective 0; 0 done → 0 missed.
      const skippedDays: CloseMissionDay[] = [
        { missionId: 'w', gameDay: '2026-11-02', status: 'skipped' },
        { missionId: 'w', gameDay: '2026-11-04', status: 'skipped' },
        { missionId: 'w', gameDay: '2026-11-06', status: 'skipped' },
        { missionId: 'w', gameDay: '2026-11-07', status: 'skipped' },
      ];
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-01',
          today: '2026-11-09',
          missions: [weekly({ streak: 2, streakBest: 2 })],
          missionDays: skippedDays,
        }),
      );
      expect(result.days[6].summary).toMatchObject({ missedXp: 0 });
      expect(result.missionStreaks).toEqual([{ missionId: 'w', streak: 3, best: 3 }]);
    });

    it('break the hero streak on a last day without completions, unless a shield saves it', () => {
      const start = input({
        lastClosedDay: '2026-11-07',
        today: '2026-11-09',
        missions: [weekly({ streak: 2, streakBest: 2 })],
        missionDays: done('w', '2026-11-03'),
      });
      expect(closeDays(start).hero.streak).toBe(0);

      const shielded = closeDays({ ...start, inventory: { shields: 1 } });
      expect(shielded.days[0].summary.shieldUsed).toBe(true);
      expect(shielded.hero.streak).toBe(3);
      expect(shielded.missionStreaks).toEqual([]);
    });
  });

  describe('tasks', () => {
    const task = (overrides: Partial<CloseMission> = {}) =>
      mission('t', {
        kind: 'task',
        frequency: null,
        dueDay: '2026-11-03',
        streak: 0,
        ...overrides,
      });

    it('cost hit points only at the close of the due day', () => {
      const result = closeDays(
        input({ lastClosedDay: '2026-11-01', today: '2026-11-06', missions: [task()] }),
      );
      expect(result.days.map((day) => day.summary.hpLost)).toEqual([0, 10, 0, 0]);
      expect(result.days.map((day) => day.summary.scheduledCount)).toEqual([0, 1, 0, 0]);
      expect(result.missionStreaks).toEqual([]);
    });

    it('count as done on the day they are completed, even when overdue', () => {
      const result = closeDays(
        input({
          lastClosedDay: '2026-11-03',
          today: '2026-11-06',
          missions: [task()],
          missionDays: done('t', '2026-11-05'),
        }),
      );
      expect(result.days.map((day) => [day.summary.scheduledCount, day.summary.doneCount])).toEqual(
        [
          [0, 0],
          [1, 1],
        ],
      );
      expect(result.days.map((day) => day.heroStreak.streak)).toEqual([3, 4]);
    });
  });

  it('rejects days that are not game days', () => {
    expect(() => closeDays(input({ today: '2026-13-01' as GameDay }))).toThrow(RangeError);
  });
});
