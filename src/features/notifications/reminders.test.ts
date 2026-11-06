import { asc, eq } from 'drizzle-orm';

import { deleteMission } from '@/db/repositories/missions';
import { events, scheduledReminders } from '@/db/schema';
import type { Db } from '@/db/types';

import { FRIDAY, TZ, at, expectHeroMatchesLog, missionId, newGame } from '../../../test/game';
import {
  ACTION_COMPLETE,
  ACTION_SNOOZE,
  MAX_SNOOZES,
  SNOOZE_MS,
  handleReminderAction,
  scheduleReminder,
  type ReminderRequest,
  type ReminderScheduler,
} from './reminders';

/** A scheduler that remembers what it was asked and gives ids `os-1`, `os-2`… */
class FakeScheduler implements ReminderScheduler {
  readonly scheduled: ReminderRequest[] = [];
  readonly cancelled: string[] = [];

  schedule(request: ReminderRequest): Promise<string> {
    this.scheduled.push(request);
    return Promise.resolve(`os-${this.scheduled.length}`);
  }

  cancel(osIds: readonly string[]): Promise<void> {
    this.cancelled.push(...osIds);
    return Promise.resolve();
  }
}

const NOW = at(FRIDAY, 20);

function setUp() {
  const db = newGame(['journal', 'healthy_meal']);
  return { db, scheduler: new FakeScheduler(), journal: missionId(db, 'journal') };
}

function reminders(db: Db) {
  return db.select().from(scheduledReminders).orderBy(asc(scheduledReminders.osId)).all();
}

function remind(db: Db, scheduler: ReminderScheduler, mission: string, fireAt = NOW) {
  return scheduleReminder(db, scheduler, { missionId: mission, fireAt, now: NOW, tzOffset: TZ });
}

function act(
  db: Db,
  scheduler: ReminderScheduler,
  mission: string,
  actionId: string,
  notificationId: string,
  now = NOW,
) {
  return handleReminderAction(db, scheduler, {
    actionId,
    notificationId,
    missionId: mission,
    now,
    tzOffset: TZ,
  });
}

describe('scheduleReminder', () => {
  it('schedules the notification and remembers it', async () => {
    const { db, scheduler, journal } = setUp();
    const osId = await remind(db, scheduler, journal, NOW + 10_000);
    expect(osId).toBe('os-1');
    expect(scheduler.scheduled).toHaveLength(1);
    expect(scheduler.scheduled[0]).toMatchObject({ missionId: journal, snoozeCount: 0 });
    expect(reminders(db)).toEqual([
      { osId, missionId: journal, gameDay: '2026-11-06', fireAt: NOW + 10_000, snoozeCount: 0 },
    ]);
  });

  it('refuses a mission that does not exist or was deleted', async () => {
    const { db, scheduler, journal } = setUp();
    deleteMission(db, journal, { now: NOW, tzOffset: TZ });
    await expect(remind(db, scheduler, journal)).rejects.toThrow(RangeError);
    await expect(remind(db, scheduler, 'missing')).rejects.toThrow(RangeError);
    expect(scheduler.scheduled).toEqual([]);
  });
});

describe('the Complete action', () => {
  it('completes the mission with source notification and the key of the notification', async () => {
    const { db, scheduler, journal } = setUp();
    const osId = await remind(db, scheduler, journal);
    await expect(act(db, scheduler, journal, ACTION_COMPLETE, osId)).resolves.toEqual({
      outcome: 'completed',
    });
    const event = db
      .select()
      .from(events)
      .where(eq(events.idemKey, `notif:${osId}`))
      .get();
    expect(event).toMatchObject({ type: 'mission.completed', source: 'notification' });
    expect(reminders(db)).toEqual([]);
    expect(scheduler.cancelled).toContain(osId);
    expectHeroMatchesLog(db);
  });

  it('cancels the other reminders of the mission for the day', async () => {
    const { db, scheduler, journal } = setUp();
    const first = await remind(db, scheduler, journal);
    const second = await remind(db, scheduler, journal, NOW + 3_600_000);
    await act(db, scheduler, journal, ACTION_COMPLETE, first);
    expect([...scheduler.cancelled].sort()).toEqual([first, second].sort());
  });

  it('counts a double tap once', async () => {
    const { db, scheduler, journal } = setUp();
    const first = await act(db, scheduler, journal, ACTION_COMPLETE, 'abc123');
    const second = await act(db, scheduler, journal, ACTION_COMPLETE, 'abc123', NOW + 500);
    expect(first.outcome).toBe('completed');
    expect(second.outcome).toBe('already_recorded');
    expect(db.select().from(events).where(eq(events.idemKey, 'notif:abc123')).all()).toHaveLength(
      1,
    );
    expectHeroMatchesLog(db);
  });

  it('does not count a mission already done in the app', async () => {
    const { db, scheduler, journal } = setUp();
    await act(db, scheduler, journal, ACTION_COMPLETE, 'first');
    await expect(act(db, scheduler, journal, ACTION_COMPLETE, 'second')).resolves.toEqual({
      outcome: 'already_done',
    });
    expectHeroMatchesLog(db);
  });

  it('reports a mission that cannot be completed instead of throwing', async () => {
    const { db, scheduler } = setUp();
    const result = await act(db, scheduler, 'missing', ACTION_COMPLETE, 'abc');
    expect(result.outcome).toBe('failed');
  });
});

describe('the Snooze action', () => {
  it('moves the reminder 10 minutes on', async () => {
    const { db, scheduler, journal } = setUp();
    const osId = await remind(db, scheduler, journal);
    const result = await act(db, scheduler, journal, ACTION_SNOOZE, osId);
    expect(result).toEqual({
      outcome: 'snoozed',
      osId: 'os-2',
      fireAt: NOW + SNOOZE_MS,
      snoozeCount: 1,
    });
    expect(SNOOZE_MS).toBe(10 * 60_000);
    expect(reminders(db)).toEqual([
      {
        osId: 'os-2',
        missionId: journal,
        gameDay: '2026-11-06',
        fireAt: NOW + SNOOZE_MS,
        snoozeCount: 1,
      },
    ]);
    expect(scheduler.scheduled[1]).toMatchObject({ snoozeCount: 1, missionId: journal });
  });

  it('allows three snoozes and then stops', async () => {
    const { db, scheduler, journal } = setUp();
    let osId = await remind(db, scheduler, journal);
    for (let count = 1; count <= MAX_SNOOZES; count += 1) {
      const result = await act(db, scheduler, journal, ACTION_SNOOZE, osId);
      expect(result).toMatchObject({ outcome: 'snoozed', snoozeCount: count });
      osId = result.outcome === 'snoozed' ? result.osId : osId;
    }
    expect(MAX_SNOOZES).toBe(3);
    await expect(act(db, scheduler, journal, ACTION_SNOOZE, osId)).resolves.toEqual({
      outcome: 'snooze_limit',
    });
    expect(scheduler.scheduled).toHaveLength(4);
    expect(reminders(db)).toHaveLength(1);
  });

  it('does nothing for a reminder that is not remembered any more', async () => {
    const { db, scheduler, journal } = setUp();
    await expect(act(db, scheduler, journal, ACTION_SNOOZE, 'gone')).resolves.toEqual({
      outcome: 'ignored',
    });
    expect(scheduler.scheduled).toEqual([]);
  });
});

describe('other actions', () => {
  it('ignores a tap on the body of the notification', async () => {
    const { db, scheduler, journal } = setUp();
    await expect(
      act(db, scheduler, journal, 'expo.modules.notifications.actions.DEFAULT', 'abc'),
    ).resolves.toEqual({ outcome: 'ignored' });
    expect(db.select().from(events).where(eq(events.idemKey, 'notif:abc')).all()).toEqual([]);
  });
});
