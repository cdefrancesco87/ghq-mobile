import { eq } from 'drizzle-orm';

import { completeMission, skipMission } from '@/db/repositories/completion';
import { startTimer, stopTimer, timersOn } from '@/db/repositories/timers';
import { getTodayView } from '@/db/repositories/todayView';
import { events } from '@/db/schema';
import type { Db } from '@/db/types';
import { LIVE_ACTIVITY } from '@/rules/config';

import { FRIDAY, TZ, at, missionId, newGame } from '../../../test/game';
import {
  createTimerActivities,
  decodeActivityTarget,
  encodeActivityTarget,
  handleTimerActivityTarget,
  timerActivityLookOf,
  timerMissionsOf,
  type TimerActivityHost,
  type TimerActivityProps,
} from './timerActivity';

const MINUTE = 60_000;
const START = at(FRIDAY, 10);
const clock = (minutes: number) => ({ now: START + minutes * MINUTE, tzOffset: TZ });
const DAY = '2026-11-06';

type Call =
  | { kind: 'start'; id: string; props: TimerActivityProps }
  | { kind: 'update'; id: string; props: TimerActivityProps }
  | { kind: 'end'; id: string; props: TimerActivityProps | null; dismissAt: number | null };

/** The fake module of the Live Activities. */
function fakeHost(left: string[] = [], refuse = false) {
  const calls: Call[] = [];
  const open = new Set(left);
  let next = 0;
  const host: TimerActivityHost = {
    start: (props) => {
      if (refuse) {
        throw new Error('Live Activities are off');
      }
      next += 1;
      const id = `a${next}`;
      open.add(id);
      calls.push({ kind: 'start', id, props });
      return id;
    },
    update: async (id, props) => {
      calls.push({ kind: 'update', id, props });
    },
    end: async (id, props, dismissAt) => {
      open.delete(id);
      calls.push({ kind: 'end', id, props, dismissAt });
    },
    list: () => [...open],
  };
  return { host, calls, open };
}

function setup() {
  const db = newGame(['meditation', 'journal']);
  return { db, id: missionId(db, 'meditation') };
}

function syncAt(
  db: Db,
  activities: ReturnType<typeof createTimerActivities>,
  minutes: number,
  canStart = true,
) {
  const now = clock(minutes);
  return activities.sync({
    day: getTodayView(db, now).day,
    now: now.now,
    missions: timerMissionsOf(getTodayView(db, now), now.now),
    look: timerActivityLookOf(db),
    canStart,
  });
}

describe('timerMissionsOf', () => {
  it('gives the duration missions with running, paused and done timers', () => {
    const { db, id } = setup();
    expect(timerMissionsOf(getTodayView(db, clock(0)), clock(0).now)).toEqual([
      {
        missionId: id,
        status: 'paused',
        name: expect.any(String),
        target: 10,
        remainingMs: 600_000,
      },
    ]);
    startTimer(db, { missionId: id, ...clock(0) });
    expect(timerMissionsOf(getTodayView(db, clock(1)), clock(1).now)).toMatchObject([
      { status: 'running', endsAt: START + 10 * MINUTE },
    ]);
    completeMission(db, { missionId: id, source: 'app', ...clock(2) });
    expect(timerMissionsOf(getTodayView(db, clock(3)), clock(3).now)).toMatchObject([
      { status: 'done' },
    ]);
  });
});

describe('the targets of the buttons', () => {
  it('are read back, and nothing else is', () => {
    const value = encodeActivityTarget('pause', 'm1', DAY);
    expect(value).toBe('la|p|m1|2026-11-06');
    expect(decodeActivityTarget(value)).toEqual({ action: 'pause', missionId: 'm1', day: DAY });
    expect(decodeActivityTarget('c|m1|2026-11-06|g1')).toBeNull();
    expect(decodeActivityTarget('la|x|m1|2026-11-06')).toBeNull();
  });
});

describe('createTimerActivities', () => {
  it('starts an activity with the play, with name, countdown and buttons', async () => {
    const { db, id } = setup();
    const { host, calls } = fakeHost();
    const activities = createTimerActivities(host);
    await syncAt(db, activities, 0);
    expect(calls).toEqual([]);

    startTimer(db, { missionId: id, ...clock(0) });
    await syncAt(db, activities, 0);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      kind: 'start',
      props: {
        missionId: id,
        phase: 'running',
        startsAt: START,
        endsAt: START + 10 * MINUTE,
        texts: { pause: 'Pausa', complete: 'Completa', done: 'Fatto!' },
        targets: { pause: `la|p|${id}|${DAY}`, complete: `la|c|${id}|${DAY}` },
        url: `ghq:///today?mission=${id}`,
      },
    });
    // A sync with nothing new changes nothing.
    await syncAt(db, activities, 1);
    expect(calls).toHaveLength(1);
  });

  it('shows the pause and the resume on the same activity', async () => {
    const { db, id } = setup();
    const { host, calls } = fakeHost();
    const activities = createTimerActivities(host);
    startTimer(db, { missionId: id, ...clock(0) });
    await syncAt(db, activities, 0);
    stopTimer(db, { missionId: id, ...clock(4) });
    await syncAt(db, activities, 4);
    await syncAt(db, activities, 6);
    startTimer(db, { missionId: id, ...clock(8) });
    await syncAt(db, activities, 8);

    expect(calls.map((call) => call.kind)).toEqual(['start', 'update', 'update']);
    expect(calls[1]).toMatchObject({
      id: 'a1',
      props: { phase: 'paused', remainingText: '06:00', progress: 0.4 },
    });
    expect(calls[2]).toMatchObject({
      id: 'a1',
      props: { phase: 'running', endsAt: START + 14 * MINUTE, startsAt: START + 4 * MINUTE },
    });
  });

  it('shows «Fatto!» for a few seconds when the mission is done', async () => {
    const { db, id } = setup();
    const { host, calls, open } = fakeHost();
    const activities = createTimerActivities(host);
    startTimer(db, { missionId: id, ...clock(0) });
    await syncAt(db, activities, 0);
    stopTimer(db, { missionId: id, ...clock(10) });
    await syncAt(db, activities, 10);

    expect(calls[1]).toMatchObject({
      kind: 'end',
      id: 'a1',
      props: { phase: 'done', texts: { done: 'Fatto!' } },
      dismissAt: clock(10).now + LIVE_ACTIVITY.doneDismissMs,
    });
    expect(open.size).toBe(0);
  });

  it('closes at once for a skip, and at the day change', async () => {
    const { db, id } = setup();
    const { host, calls } = fakeHost();
    const activities = createTimerActivities(host);
    startTimer(db, { missionId: id, ...clock(0) });
    await syncAt(db, activities, 0);
    skipMission(db, { missionId: id, reason: 'rest', ...clock(1) });
    await syncAt(db, activities, 1);
    expect(calls[1]).toEqual({ kind: 'end', id: 'a1', props: null, dismissAt: null });

    const other = setup();
    const second = fakeHost();
    const otherActivities = createTimerActivities(second.host);
    startTimer(other.db, { missionId: other.id, ...clock(0) });
    await syncAt(other.db, otherActivities, 0);
    await syncAt(other.db, otherActivities, 24 * 60);
    expect(second.calls[1]).toEqual({ kind: 'end', id: 'a1', props: null, dismissAt: null });
  });

  it('closes the activities of an earlier run and starts the running timers again', async () => {
    const { db, id } = setup();
    const { host, calls } = fakeHost(['old']);
    startTimer(db, { missionId: id, ...clock(0) });
    await syncAt(db, createTimerActivities(host), 2);
    expect(calls.map((call) => [call.kind, call.id])).toEqual([
      ['end', 'old'],
      ['start', 'a1'],
    ]);
  });

  it('starts nothing in the background, nor when the system refuses', async () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    const background = fakeHost();
    await syncAt(db, createTimerActivities(background.host), 0, false);
    expect(background.calls).toEqual([]);

    const refused = fakeHost([], true);
    const activities = createTimerActivities(refused.host);
    await expect(syncAt(db, activities, 0)).resolves.toBeUndefined();
    expect(refused.calls).toEqual([]);
  });
});

describe('handleTimerActivityTarget', () => {
  it('Pausa saves the minutes counted, Riprendi starts again', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    const paused = handleTimerActivityTarget(db, `la|p|${id}|${DAY}`, clock(3));
    expect(paused).toMatchObject({ outcome: 'paused', missionId: id });
    expect(paused.result?.status).toBe('progressed');
    expect(timersOn(db, DAY).size).toBe(0);

    const resumed = handleTimerActivityTarget(db, `la|r|${id}|${DAY}`, clock(5));
    expect(resumed).toMatchObject({ outcome: 'resumed', endsAt: clock(12).now });
  });

  it('Completa completes the mission once', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    const done = handleTimerActivityTarget(db, `la|c|${id}|${DAY}`, clock(1));
    expect(done.result?.status).toBe('completed');
    expect(handleTimerActivityTarget(db, `la|c|${id}|${DAY}`, clock(2)).result).toBeNull();
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );
  });

  it('ignores other targets and touches of another day; a refusal fails', () => {
    const { db, id } = setup();
    expect(handleTimerActivityTarget(db, 'c|x|2026-11-06|g', clock(0)).outcome).toBe('ignored');
    expect(handleTimerActivityTarget(db, `la|p|${id}|2026-11-05`, clock(0)).outcome).toBe(
      'ignored',
    );
    const journal = missionId(db, 'journal');
    expect(handleTimerActivityTarget(db, `la|r|${journal}|${DAY}`, clock(0)).outcome).toBe(
      'failed',
    );
  });
});
