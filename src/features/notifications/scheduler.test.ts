import { asc } from 'drizzle-orm';

import { completeMission } from '@/db/repositories/completion';
import {
  archiveMission,
  createMission,
  deleteMission,
  restoreMission,
  updateMission,
} from '@/db/repositories/missions';
import { resumePause, startPause } from '@/db/repositories/pause';
import { setSetting, setWeekRules } from '@/db/repositories/settings';
import { undoEvent } from '@/db/repositories/undo';
import { appNotifications, scheduledReminders } from '@/db/schema';
import type { Db } from '@/db/types';
import { REMINDERS } from '@/rules/config';

import { FRIDAY, TZ, at, clockAt, missionId, newGame } from '../../../test/game';
import {
  handleReminderAction,
  type ReminderGroupRequest,
  type ReminderRequest,
  type ReminderScheduler,
} from './reminders';
import { syncReminders } from './scheduler';

/** expo-notifications in memory: ids `os-1`, `os-2`… and the notifications still pending. */
class FakeScheduler implements ReminderScheduler {
  readonly pending = new Map<string, ReminderRequest>();
  scheduledCount = 0;
  readonly cancelled: string[] = [];

  readonly groups = new Map<string, ReminderGroupRequest>();

  schedule(request: ReminderRequest): Promise<string> {
    this.scheduledCount += 1;
    const osId = `os-${this.scheduledCount}`;
    this.pending.set(osId, request);
    return Promise.resolve(osId);
  }

  scheduleGroup(request: ReminderGroupRequest): Promise<string> {
    this.scheduledCount += 1;
    const osId = `group-${this.scheduledCount}`;
    this.groups.set(osId, request);
    return Promise.resolve(osId);
  }

  cancel(osIds: readonly string[]): Promise<void> {
    for (const osId of osIds) {
      this.pending.delete(osId);
      this.groups.delete(osId.split('#')[0]);
      this.cancelled.push(osId);
    }
    return Promise.resolve();
  }

  /** The pending notifications as «mission@local day hour:minute» in Rome, in order. */
  times(): string[] {
    return [...this.pending.values()]
      .sort((a, b) => a.fireAt - b.fireAt)
      .map((request) => {
        const local = new Date(request.fireAt + TZ * 60_000).toISOString();
        return `${request.title}@${local.slice(8, 10)} ${local.slice(11, 16)}`;
      });
  }
}

const NOW = at(FRIDAY, 20);
const SYNC = { now: NOW, tzOffset: TZ };

function setUp(times = ['08:00', '21:00']) {
  const db = newGame(['journal']);
  const journal = missionId(db, 'journal');
  updateMission(db, journal, { name: 'Journal', reminders: times }, clockAt(FRIDAY, 9));
  return { db, journal, scheduler: new FakeScheduler() };
}

function rows(db: Db) {
  return db.select().from(scheduledReminders).orderBy(asc(scheduledReminders.fireAt)).all();
}

describe('syncReminders', () => {
  it('schedules the future reminders of the window and remembers their game day', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    // Friday 08:00 has passed; then two a day up to Thursday 12, the seventh game day.
    expect(scheduler.times()).toEqual([
      'Journal@06 21:00',
      ...['07', '08', '09', '10', '11', '12'].flatMap((day) => [
        `Journal@${day} 08:00`,
        `Journal@${day} 21:00`,
      ]),
    ]);
    expect(REMINDERS.windowDays).toBe(7);
    expect(rows(db)[0]).toEqual({
      osId: 'os-1',
      missionId: journal,
      gameDay: '2026-11-06',
      fireAt: at(FRIDAY, 21),
      snoozeCount: 0,
    });
    expect(rows(db)[1]).toMatchObject({ gameDay: '2026-11-07', fireAt: at(7, 8) });
  });

  it('changes nothing when nothing changed', async () => {
    const { db, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    const before = rows(db);
    await syncReminders(db, scheduler, { now: NOW + 60_000, tzOffset: TZ });
    expect(rows(db)).toEqual(before);
    expect(scheduler.cancelled).toEqual([]);
  });

  it('follows a change of the times and of the quiet hours', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    updateMission(db, journal, { reminders: ['21:00'] }, SYNC);
    setSetting(db, 'quiet_hours', [{ start: '20:30', end: '21:30' }], NOW);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.times().slice(0, 2)).toEqual(['Journal@06 21:30', 'Journal@07 21:30']);
    expect(rows(db)).toHaveLength(7);
  });

  it('cancels every reminder with the general switch off and schedules them again on', async () => {
    const { db, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    setSetting(db, 'reminders_enabled', false, NOW);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(0);
    expect(rows(db)).toEqual([]);
    setSetting(db, 'reminders_enabled', true, NOW);
    await syncReminders(db, scheduler, SYNC);
    expect(rows(db)).toHaveLength(13);
  });

  it('follows rest days that count from tomorrow, and keeps the reminders of today', async () => {
    const { db, scheduler } = setUp();
    // Friday and Saturday become rest days from Saturday 7.
    setWeekRules(db, { restDays: [5, 6] }, { today: '2026-11-06', now: NOW });
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.times().slice(0, 3)).toEqual([
      'Journal@06 21:00',
      'Journal@08 08:00',
      'Journal@08 21:00',
    ]);
  });

  it('gives a completed mission no more reminders that day, and gives them back on undo', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    const result = completeMission(db, { missionId: journal, source: 'app', ...SYNC });
    expect(result.status).toBe('completed');
    await scheduler.cancel(result.cancelledNotificationIds);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.times()[0]).toBe('Journal@07 08:00');

    undoEvent(db, result.completion!.eventId, SYNC);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.times()[0]).toBe('Journal@06 21:00');
  });

  it('keeps a snoozed reminder', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    const later = at(FRIDAY, 21, 1);
    const snoozed = await handleReminderAction(db, scheduler, {
      actionId: 'snooze',
      notificationId: 'os-1',
      missionId: journal,
      now: later,
      tzOffset: TZ,
    });
    expect(snoozed).toMatchObject({ outcome: 'snoozed', snoozeCount: 1 });
    await syncReminders(db, scheduler, { now: later, tzOffset: TZ });
    expect(scheduler.times()[0]).toBe('Journal@06 21:11');
    expect(rows(db)[0]).toMatchObject({ gameDay: '2026-11-06', snoozeCount: 1 });
  });

  it('keeps the reminders already shown today, so Snooze and Complete still find them', async () => {
    const { db, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    await syncReminders(db, scheduler, { now: at(FRIDAY, 21, 5), tzOffset: TZ });
    expect(rows(db)[0]).toMatchObject({ osId: 'os-1', fireAt: at(FRIDAY, 21) });
    expect(scheduler.cancelled).toEqual([]);
  });

  it('cancels the reminders of the days already over', async () => {
    const { db, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    // Saturday 7 at 07:00: Friday's game day is over.
    await syncReminders(db, scheduler, { now: at(7, 7), tzOffset: TZ });
    expect(scheduler.cancelled).toEqual(['os-1']);
    expect(rows(db)[0]).toMatchObject({ gameDay: '2026-11-07', fireAt: at(7, 8) });
  });

  it('keeps the reminders already shown among the recent notifications (design 12.1)', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    await syncReminders(db, scheduler, { now: at(7, 9), tzOffset: TZ });
    expect(db.select().from(appNotifications).all()).toEqual([
      {
        id: 'reminder:os-1',
        kind: 'reminder',
        params: { missionId: journal, gameDay: '2026-11-06' },
        createdAt: at(FRIDAY, 21),
        seenAt: null,
      },
      {
        id: 'reminder:os-2',
        kind: 'reminder',
        params: { missionId: journal, gameDay: '2026-11-07' },
        createdAt: at(7, 8),
        seenAt: null,
      },
    ]);
  });

  it('stops the reminders of a mission archived or left without times', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    archiveMission(db, journal, SYNC);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(0);
    expect(rows(db)).toEqual([]);

    restoreMission(db, journal, SYNC);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(13);
    updateMission(db, journal, { reminders: [] }, SYNC);
    await syncReminders(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(0);
  });

  it('cancels everything when no mission is left', async () => {
    const { db, journal, scheduler } = setUp();
    await syncReminders(db, scheduler, SYNC);
    deleteMission(db, journal, SYNC);
    await expect(syncReminders(db, scheduler, SYNC)).resolves.toEqual({
      scheduled: 0,
      cancelled: 0,
    });
    expect(rows(db)).toEqual([]);
  });

  it('never keeps more than 64 notifications scheduled, the earliest ones', async () => {
    const { db, scheduler } = setUp(['06:00', '09:00', '12:00', '15:00', '18:00', '21:00']);
    createMission(
      db,
      {
        kind: 'habit',
        name: 'Water',
        frequency: { type: 'daily' },
        statPrimary: 'constitution',
        reminders: ['06:30', '09:30', '12:30', '15:30', '18:30', '21:30'],
      },
      SYNC,
    );
    await syncReminders(db, scheduler, SYNC);
    expect(REMINDERS.maxScheduled).toBe(64);
    expect(scheduler.pending.size).toBe(64);
    expect(rows(db)).toHaveLength(64);
    const times = scheduler.times();
    expect(times[0]).toBe('Journal@06 21:00');
    // 2 on Friday evening, 12 a day from Saturday to Wednesday, then 2 on Thursday morning.
    expect(times[63]).toBe('Water@12 06:30');
  });
});

describe('syncReminders with reminders of the same minute (design 11.4)', () => {
  function setUpThree() {
    const db = newGame(['journal', 'healthy_meal', 'bed_by_eleven']);
    const ids = ['journal', 'healthy_meal', 'bed_by_eleven'].map((key) => missionId(db, key));
    ['Journal', 'Meal', 'Bed'].forEach((name, index) =>
      updateMission(db, ids[index], { name, reminders: ['08:00'] }, clockAt(FRIDAY, 9)),
    );
    return { db, ids, scheduler: new FakeScheduler() };
  }

  it('groups 3 reminders of the same minute in one notification, with a row for each', async () => {
    const { db, scheduler } = setUpThree();
    await syncReminders(db, scheduler, SYNC);
    // Saturday to Thursday at 08:00: one group a day, no notification of its own.
    expect(scheduler.pending.size).toBe(0);
    expect(scheduler.groups.size).toBe(6);
    const [first] = [...scheduler.groups.values()].sort((a, b) => a.fireAt - b.fireAt);
    expect(first).toMatchObject({
      fireAt: at(7, 8),
      title: '3 abitudini per adesso',
      body: 'Journal, Meal, Bed\n— Cloudy',
    });
    expect(rows(db)).toHaveLength(18);
    expect(rows(db)[0].osId).toMatch(/^group-\d+#3#/);
  });

  it('keeps the groups when nothing changed', async () => {
    const { db, scheduler } = setUpThree();
    await syncReminders(db, scheduler, SYNC);
    const before = rows(db);
    await syncReminders(db, scheduler, { now: NOW + 60_000, tzOffset: TZ });
    expect(rows(db)).toEqual(before);
    expect(scheduler.cancelled).toEqual([]);
  });

  it('splits a group when one of its missions is completed before it fires', async () => {
    const { db, ids, scheduler } = setUpThree();
    const saturday = { now: at(7, 7), tzOffset: TZ };
    await syncReminders(db, scheduler, saturday);
    const result = completeMission(db, {
      missionId: ids[0],
      source: 'app',
      idemKey: 'app:1',
      now: at(7, 7, 30),
      tzOffset: TZ,
    });
    await scheduler.cancel(result.cancelledNotificationIds);
    await syncReminders(db, scheduler, { now: at(7, 7, 31), tzOffset: TZ });
    // Two left at 08:00: one notification each; the next days keep their group.
    expect(scheduler.times()).toEqual(['Meal@07 08:00', 'Bed@07 08:00']);
    expect(scheduler.groups.size).toBe(6);
    expect(rows(db).filter((row) => row.fireAt === at(7, 8))).toHaveLength(2);
  });

  describe('general pause (choice 23)', () => {
    it('schedules no reminder on the paused days, and the others as usual', async () => {
      const { db, scheduler } = setUp(['21:00']);
      startPause(db, { fromDay: '2026-11-08', untilDay: '2026-11-10' }, clockAt(FRIDAY, 19));
      await syncReminders(db, scheduler, SYNC);
      expect(scheduler.times()).toEqual([
        'Journal@06 21:00',
        'Journal@07 21:00',
        'Journal@11 21:00',
        'Journal@12 21:00',
      ]);
    });

    it('cancels them when the pause starts today and schedules them again at «Riprendi»', async () => {
      const { db, scheduler } = setUp(['21:00']);
      await syncReminders(db, scheduler, SYNC);
      expect(scheduler.pending.size).toBe(7);
      startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 19));
      await syncReminders(db, scheduler, SYNC);
      expect(scheduler.pending.size).toBe(0);
      expect(rows(db)).toEqual([]);
      // Today stays the last paused day: the reminders come back from tomorrow.
      resumePause(db, clockAt(FRIDAY, 19));
      await syncReminders(db, scheduler, SYNC);
      expect(scheduler.times()).toEqual(
        ['07', '08', '09', '10', '11', '12'].map((day) => `Journal@${day} 21:00`),
      );
    });

    it('schedules them again once the pause is over', async () => {
      const { db, scheduler } = setUp(['21:00']);
      startPause(db, { fromDay: '2026-11-06', untilDay: '2026-11-07' }, clockAt(FRIDAY, 19));
      await syncReminders(db, scheduler, SYNC);
      expect(scheduler.times()[0]).toBe('Journal@08 21:00');
      await syncReminders(db, scheduler, { now: at(8, 9), tzOffset: TZ });
      expect(scheduler.times()).toHaveLength(7);
      expect(scheduler.times()[0]).toBe('Journal@08 21:00');
    });
  });
});
