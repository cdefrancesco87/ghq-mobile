import { and, eq } from 'drizzle-orm';

import { completeMission, skipMission } from '@/db/repositories/completion';
import { getSetting } from '@/db/repositories/settings';
import { discardTimer, startTimer, stopTimer, timersOn } from '@/db/repositories/timers';
import { getTodayView } from '@/db/repositories/todayView';
import { events, missionDays } from '@/db/schema';
import type { Db } from '@/db/types';

import { FRIDAY, TZ, at, expectHeroMatchesLog, missionId, newGame } from '../../../test/game';

const MINUTE = 60_000;
const START = at(FRIDAY, 10);
const clock = (minutes: number) => ({ now: START + minutes * MINUTE, tzOffset: TZ });

function dayOf(db: Db, id: string) {
  return db
    .select()
    .from(missionDays)
    .where(and(eq(missionDays.missionId, id), eq(missionDays.gameDay, '2026-11-06')))
    .get();
}

function setup() {
  // Meditation: a duration goal of 10 minutes.
  const db = newGame(['meditation', 'journal']);
  return { db, id: missionId(db, 'meditation') };
}

describe('startTimer', () => {
  it('saves the instant of the start and gives the end, which survives a new read', () => {
    const { db, id } = setup();
    expect(startTimer(db, { missionId: id, ...clock(0) })).toEqual({ endsAt: START + 10 * MINUTE });
    expect(timersOn(db, '2026-11-06').get(id)).toBe(START);
    expect(getTodayView(db, clock(3)).missions.find((m) => m.mission.id === id)).toMatchObject({
      timerStartedAt: START,
    });
    // Nothing is written in the log or in the day: a timer is not a game action.
    expect(dayOf(db, id)).toBeUndefined();
    const logged = db.select().from(events).where(eq(events.missionId, id)).all();
    expect(logged.map((event) => event.type)).toEqual(['mission.created']);
  });

  it('keeps the first start when touched again while running', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    expect(startTimer(db, { missionId: id, ...clock(2) })).toEqual({ endsAt: START + 10 * MINUTE });
  });

  it('counts only the minutes still missing after a pause', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    stopTimer(db, { missionId: id, ...clock(4) });
    expect(startTimer(db, { missionId: id, ...clock(20) })).toEqual({
      endsAt: START + 26 * MINUTE,
    });
  });

  it('refuses missions without a duration goal, done, skipped or not due', () => {
    const { db, id } = setup();
    const journal = missionId(db, 'journal');
    expect(() => startTimer(db, { missionId: journal, ...clock(0) })).toThrow(RangeError);
    skipMission(db, { missionId: id, reason: 'rest', ...clock(0) });
    expect(() => startTimer(db, { missionId: id, ...clock(1) })).toThrow(RangeError);

    const other = setup();
    completeMission(other.db, { missionId: other.id, source: 'app', ...clock(0) });
    expect(() => startTimer(other.db, { missionId: other.id, ...clock(1) })).toThrow(RangeError);
  });

  it('forgets the timers of the days before', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    const tomorrow = { now: at(FRIDAY + 1, 10), tzOffset: TZ };
    expect(timersOn(db, '2026-11-07').size).toBe(0);
    startTimer(db, { missionId: id, ...tomorrow });
    expect(Object.keys(getSetting(db, 'mission_timers'))).toEqual([id]);
    expect(getSetting(db, 'mission_timers')[id]).toEqual({
      game_day: '2026-11-07',
      started_at: tomorrow.now,
    });
  });
});

describe('stopTimer', () => {
  it('a pause saves the minutes counted as a partial value', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    const result = stopTimer(db, { missionId: id, now: START + 90_000, tzOffset: TZ });
    expect(result?.status).toBe('progressed');
    expect(dayOf(db, id)).toMatchObject({ status: 'partial', value: 1.5 });
    expect(timersOn(db, '2026-11-06').size).toBe(0);
    expectHeroMatchesLog(db);
  });

  it('completes the mission once the target is reached, with only the minutes missing', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    stopTimer(db, { missionId: id, ...clock(4) });
    startTimer(db, { missionId: id, ...clock(30) });
    // Reopened long after the end: the value stops at the target.
    const result = stopTimer(db, { missionId: id, ...clock(120) });
    expect(result?.status).toBe('completed');
    expect(result?.completion?.xp).toBeGreaterThan(0);
    expect(dayOf(db, id)).toMatchObject({ status: 'done', value: 10 });
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );
    expectHeroMatchesLog(db);
  });

  it('does nothing without a timer, and only forgets one of another day or of a closed mission', () => {
    const { db, id } = setup();
    expect(stopTimer(db, { missionId: id, ...clock(0) })).toBeNull();

    startTimer(db, { missionId: id, ...clock(0) });
    expect(stopTimer(db, { missionId: id, now: at(FRIDAY + 1, 10), tzOffset: TZ })).toBeNull();
    expect(getSetting(db, 'mission_timers')).toEqual({});
    expect(dayOf(db, id)).toBeUndefined();

    startTimer(db, { missionId: id, ...clock(1) });
    completeMission(db, { missionId: id, source: 'app', ...clock(2) });
    expect(stopTimer(db, { missionId: id, ...clock(3) })).toBeNull();
    expect(getSetting(db, 'mission_timers')).toEqual({});
  });

  it('saves nothing for a pause right after the start', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    expect(stopTimer(db, { missionId: id, ...clock(0) })).toBeNull();
    expect(dayOf(db, id)).toBeUndefined();
    expect(timersOn(db, '2026-11-06').size).toBe(0);
  });
});

describe('discardTimer', () => {
  it('forgets a timer without saving its minutes', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    discardTimer(db, id, clock(5).now);
    expect(timersOn(db, '2026-11-06').size).toBe(0);
    expect(dayOf(db, id)).toBeUndefined();
  });
});

describe('a completion or a skip from elsewhere', () => {
  it('forgets the running timer, so an undo does not bring it back', () => {
    const { db, id } = setup();
    startTimer(db, { missionId: id, ...clock(0) });
    completeMission(db, { missionId: id, source: 'notification', ...clock(1) });
    expect(getSetting(db, 'mission_timers')).toEqual({});

    const other = setup();
    startTimer(other.db, { missionId: other.id, ...clock(0) });
    skipMission(other.db, { missionId: other.id, reason: 'rest', ...clock(1) });
    expect(getSetting(other.db, 'mission_timers')).toEqual({});
  });
});
