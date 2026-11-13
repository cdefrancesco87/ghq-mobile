import { addDays } from './gameDay';
import {
  completionCounts,
  completionRate,
  generalPauseSpans,
  pauseSpans,
  rateOf,
  type RateInput,
} from './missionRate';
import type { GameDay } from './types';

// Monday 2 November 2026 … Sunday 29 November 2026; Friday 27 is "today" in most tests.
const TODAY: GameDay = '2026-11-27';

type Status = 'done' | 'partial' | 'skipped';

function daily(overrides: Partial<RateInput> = {}): RateInput {
  return {
    mission: {
      kind: 'habit',
      frequency: { type: 'daily' },
      dueDay: null,
      createdDay: '2026-01-01',
    },
    lastDay: TODAY,
    days: [],
    pauses: [],
    restDays: [],
    weekStart: 1,
    ...overrides,
  };
}

/** The same status on `count` days ending the day before `end`. */
function before(end: GameDay, count: number, status: Status = 'done') {
  return Array.from({ length: count }, (_, i) => ({ gameDay: addDays(end, -1 - i), status }));
}

describe('completionRate of a habit by days', () => {
  it('counts the 29 closed days of the window, and today only when it is done', () => {
    // 29 days done out of the 29 closed: today still to do is not a miss.
    expect(completionRate(daily({ days: before(TODAY, 29) }))).toBe(100);
    expect(completionRate(daily({ days: before(TODAY, 15) }))).toBe(Math.floor((15 / 29) * 100));
    expect(
      completionRate(daily({ days: [...before(TODAY, 15), { gameDay: TODAY, status: 'done' }] })),
    ).toBe(Math.floor((16 / 30) * 100));
  });

  it('ignores the days before the window', () => {
    const old = before(addDays(TODAY, -29), 20);
    expect(completionRate(daily({ days: [...old, ...before(TODAY, 29)] }))).toBe(100);
    expect(completionRate(daily({ days: old }))).toBe(0);
  });

  it('starts on the day the mission was created', () => {
    const created = addDays(TODAY, -4);
    expect(
      completionRate(
        daily({
          mission: { ...daily().mission, createdDay: created },
          days: before(TODAY, 2),
        }),
      ),
    ).toBe(50);
  });

  it('excludes skipped days, paused days and rest days', () => {
    const days = [...before(TODAY, 10), ...before(addDays(TODAY, -10), 5, 'skipped')];
    // 10 done, 5 skipped, 14 paused: 10 of 10.
    expect(
      completionRate(
        daily({
          days,
          pauses: [{ from: addDays(TODAY, -29), until: addDays(TODAY, -15) }],
        }),
      ),
    ).toBe(100);
    // Rest on Saturday and Sunday: the 4 weekends of the window are not expected.
    const weekdaysDone = before(TODAY, 29).filter(({ gameDay }) => {
      const day = new Date(`${gameDay}T00:00:00Z`).getUTCDay();
      return day !== 0 && day !== 6;
    });
    expect(completionRate(daily({ days: weekdaysDone, restDays: [6, 7] }))).toBe(100);
  });

  it('counts a partial measurable mission as not done', () => {
    expect(completionRate(daily({ days: before(TODAY, 29, 'partial') }))).toBe(0);
  });

  it('counts a day done while paused', () => {
    expect(
      completionRate(
        daily({
          days: before(TODAY, 1),
          pauses: [{ from: addDays(TODAY, -1), until: null }],
          mission: { ...daily().mission, createdDay: addDays(TODAY, -1) },
        }),
      ),
    ).toBe(100);
  });

  it('only expects the scheduled weekdays', () => {
    // Mondays, Wednesdays and Fridays from 2 to 26 November, plus Friday 27 done today.
    const mwf: GameDay[] = [];
    for (let day = addDays(TODAY, -29); day <= TODAY; day = addDays(day, 1)) {
      const weekdayIndex = new Date(`${day}T00:00:00Z`).getUTCDay();
      if ([1, 3, 5].includes(weekdayIndex)) {
        mwf.push(day);
      }
    }
    const habit = daily({
      mission: { ...daily().mission, frequency: { type: 'weekdays', days: [1, 3, 5] } },
    });
    expect(
      completionRate({ ...habit, days: mwf.map((gameDay) => ({ gameDay, status: 'done' })) }),
    ).toBe(100);
    // Half of them missed.
    const half = mwf.filter((_, i) => i % 2 === 0);
    expect(
      completionRate({ ...habit, days: half.map((gameDay) => ({ gameDay, status: 'done' })) }),
    ).toBe(Math.floor((half.length / mwf.length) * 100));
  });

  it('has no rate before a day was expected', () => {
    expect(
      completionRate(daily({ mission: { ...daily().mission, createdDay: TODAY } })),
    ).toBeNull();
  });

  it('stops at the last day given, e.g. the day of the archive', () => {
    const archived = addDays(TODAY, -10);
    expect(completionRate(daily({ lastDay: archived, days: [...before(archived, 29)] }))).toBe(100);
  });
});

describe('completionRate of a habit counted per week', () => {
  const threeTimes = (overrides: Partial<RateInput> = {}) =>
    daily({
      mission: { ...daily().mission, frequency: { type: 'times_per_week', times: 3 } },
      ...overrides,
    });
  const done = (...gameDays: GameDay[]) =>
    gameDays.map((gameDay) => ({ gameDay, status: 'done' as const }));

  it('counts at most N completions in each closed week and N expected', () => {
    // Weeks from Monday 2, 9, 16 (closed) and 23 (open, today Friday 27). Window from 29 Oct.
    const days = done(
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05', // 4 done, counts 3
      '2026-11-09', // 1 of 3
      '2026-11-16',
      '2026-11-18',
      '2026-11-20', // 3 of 3
    );
    // Closed weeks: 3 + 1 + 3 = 7 of 9; the open week adds nothing.
    expect(completionRate(threeTimes({ days }))).toBe(Math.floor((7 / 9) * 100));
  });

  it('never counts the open week as missed, but counts what it has done', () => {
    const createdMonday = { ...threeTimes().mission, createdDay: '2026-11-23' as GameDay };
    expect(completionRate(threeTimes({ mission: createdMonday, days: done('2026-11-23') }))).toBe(
      100,
    );
    expect(completionRate(threeTimes({ mission: createdMonday }))).toBeNull();
  });

  it('does not count as missed the week cut by the window or by the creation', () => {
    // The week of Monday 26 October is cut by the window (it starts on 29 October).
    expect(
      completionRate(
        threeTimes({
          days: done(
            '2026-10-30',
            ...weekOf('2026-11-02'),
            ...weekOf('2026-11-09'),
            ...weekOf('2026-11-16'),
          ),
        }),
      ),
    ).toBe(100);
    // Created on Thursday 12: that week is not expected in full.
    expect(
      completionRate(
        threeTimes({
          mission: { ...threeTimes().mission, createdDay: '2026-11-12' },
          days: done('2026-11-13', ...weekOf('2026-11-16')),
        }),
      ),
    ).toBe(100);
  });

  it('lowers N by one for every skip and paused day of the week', () => {
    const days = [
      ...done('2026-11-02'),
      { gameDay: '2026-11-03' as GameDay, status: 'skipped' as const },
      ...done('2026-11-09', '2026-11-10'),
      ...weekOf('2026-11-16').map((gameDay) => ({ gameDay, status: 'done' as const })),
    ];
    const pauses = [{ from: '2026-11-11' as GameDay, until: '2026-11-12' as GameDay }];
    // Week of the 2nd: 1 of 2. Week of the 9th: 2 of 2. Week of the 16th: 3 of 3.
    expect(completionRate(threeTimes({ days, pauses }))).toBe(Math.floor((6 / 7) * 100));
  });

  function weekOf(monday: GameDay): GameDay[] {
    return [monday, addDays(monday, 1), addDays(monday, 2)];
  }
});

describe('completionRate of a task', () => {
  const task = (overrides: Partial<RateInput['mission']>, days: RateInput['days'] = []) =>
    daily({
      mission: {
        kind: 'task',
        frequency: null,
        dueDay: '2026-11-20',
        createdDay: '2026-11-01',
        ...overrides,
      },
      days,
    });

  it('is 100 when done, 0 when the due day has passed, none before', () => {
    expect(completionRate(task({}, [{ gameDay: '2026-11-22', status: 'done' }]))).toBe(100);
    expect(completionRate(task({}))).toBe(0);
    expect(completionRate(task({ dueDay: TODAY }))).toBeNull();
    expect(completionRate(task({ dueDay: null }))).toBeNull();
  });
});

describe('completionCounts over other windows', () => {
  it('takes the window length given', () => {
    // The last 7 days: 6 closed and done, today open.
    expect(completionCounts(daily({ windowDays: 7, days: before(TODAY, 6) }))).toEqual({
      expected: 6,
      done: 6,
    });
    expect(completionRate(daily({ windowDays: 365, days: before(TODAY, 29) }))).toBe(
      // Created on 1 January: 330 closed days, today open.
      Math.floor((29 / 330) * 100),
    );
  });

  it('counts the last day as missed when it is closed', () => {
    const lastDay = addDays(TODAY, -30);
    expect(completionCounts(daily({ lastDay, days: before(lastDay, 29) }))).toEqual({
      expected: 29,
      done: 29,
    });
    expect(
      completionCounts(daily({ lastDay, lastDayClosed: true, days: before(lastDay, 29) })),
    ).toEqual({ expected: 30, done: 29 });
  });

  it('misses a week per N that ends on the closed last day', () => {
    const mission = {
      ...daily().mission,
      frequency: { type: 'times_per_week', times: 3 },
    } as const;
    // Sunday 22 closes the week of Monday 16.
    const input = daily({ mission, lastDay: '2026-11-22', windowDays: 7 });
    expect(completionCounts(input)).toEqual({ expected: 0, done: 0 });
    expect(completionCounts({ ...input, lastDayClosed: true })).toEqual({ expected: 3, done: 0 });
  });

  it('counts a task only inside the window', () => {
    const task = (dueDay: GameDay | null, days: RateInput['days'] = []) =>
      daily({
        mission: { kind: 'task', frequency: null, dueDay, createdDay: '2026-11-01' },
        windowDays: 7,
        days,
      });
    expect(
      completionCounts(task('2026-11-25', [{ gameDay: '2026-11-24', status: 'done' }])),
    ).toEqual({ expected: 1, done: 1 });
    // Done before the window: it belongs to another window.
    expect(
      completionCounts(task('2026-11-25', [{ gameDay: '2026-11-10', status: 'done' }])),
    ).toEqual({ expected: 0, done: 0 });
    // Due in the window and passed, never done.
    expect(completionCounts(task('2026-11-25'))).toEqual({ expected: 1, done: 0 });
    // Due before the window, today, or never.
    expect(completionCounts(task('2026-11-12'))).toEqual({ expected: 0, done: 0 });
    expect(completionCounts(task(TODAY))).toEqual({ expected: 0, done: 0 });
    expect(completionCounts(task(null))).toEqual({ expected: 0, done: 0 });
  });

  it('turns counts into a rate rounded down', () => {
    expect(rateOf({ expected: 3, done: 2 })).toBe(66);
    expect(rateOf({ expected: 0, done: 0 })).toBeNull();
  });
});

describe('generalPauseSpans', () => {
  it('turns the last paused day of a general pause into the first day active again', () => {
    expect(
      generalPauseSpans([
        { fromDay: '2026-11-02', untilDay: '2026-11-04' },
        { fromDay: '2026-11-20', untilDay: null },
      ]),
    ).toEqual([
      { from: '2026-11-02', until: '2026-11-05' },
      { from: '2026-11-20', until: null },
    ]);
  });
});

describe('pauseSpans', () => {
  it('builds the paused days from the events, the end day excluded', () => {
    expect(
      pauseSpans([
        { type: 'mission.paused', gameDay: '2026-11-02', until: '2026-11-05' },
        { type: 'mission.paused', gameDay: '2026-11-10', until: null },
        { type: 'mission.resumed', gameDay: '2026-11-12' },
        { type: 'mission.paused', gameDay: '2026-11-20', until: '2026-11-30' },
        { type: 'mission.resumed', gameDay: '2026-11-22' },
        { type: 'mission.paused', gameDay: '2026-11-25', until: null },
      ]),
    ).toEqual([
      { from: '2026-11-02', until: '2026-11-05' },
      { from: '2026-11-10', until: '2026-11-12' },
      { from: '2026-11-20', until: '2026-11-22' },
      { from: '2026-11-25', until: null },
    ]);
  });

  it('ends a pause at the archive and at a new pause', () => {
    expect(
      pauseSpans([
        { type: 'mission.paused', gameDay: '2026-11-02', until: null },
        { type: 'mission.paused', gameDay: '2026-11-04', until: '2026-11-08' },
        { type: 'mission.archived', gameDay: '2026-11-06' },
        { type: 'mission.resumed', gameDay: '2026-11-07' },
      ]),
    ).toEqual([
      { from: '2026-11-02', until: '2026-11-04' },
      { from: '2026-11-04', until: '2026-11-06' },
    ]);
  });
});
