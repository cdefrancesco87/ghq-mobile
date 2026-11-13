import { eq } from 'drizzle-orm';

import {
  markNotificationsSeen,
  recentNotifications,
  recordFiredReminders,
  recordSummary,
  unseenNotificationCount,
} from '@/db/repositories/appNotifications';
import { completeMission, skipMission } from '@/db/repositories/completion';
import { appNotifications, scheduledReminders } from '@/db/schema';
import type { Db } from '@/db/types';
import type { GameDay } from '@/rules/types';

import { at, clockAt, missionId, newGame, TZ } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome.

function remind(db: Db, osId: string, key: string, day: number, hour: number) {
  db.insert(scheduledReminders)
    .values({
      osId,
      missionId: missionId(db, key),
      gameDay: `2026-11-0${day}` as GameDay,
      fireAt: at(day, hour),
    })
    .run();
}

describe('app notifications', () => {
  it('records the reminders already shown, once, with the time they fired', () => {
    const db = newGame(['journal']);
    remind(db, 'a', 'journal', 6, 9);
    remind(db, 'b', 'journal', 6, 18);
    recordFiredReminders(db, at(6, 10));
    recordFiredReminders(db, at(6, 11));
    const rows = db.select().from(appNotifications).all();
    expect(rows).toEqual([
      {
        id: 'reminder:a',
        kind: 'reminder',
        params: { missionId: missionId(db, 'journal'), gameDay: '2026-11-06' },
        createdAt: at(6, 9),
        seenAt: null,
      },
    ]);
  });

  it('keeps a shown reminder when a completion or a skip removes it', () => {
    const db = newGame(['journal', 'no_social_evening']);
    remind(db, 'a', 'journal', 6, 9);
    remind(db, 'b', 'journal', 6, 18);
    remind(db, 'c', 'no_social_evening', 6, 8);
    completeMission(db, {
      missionId: missionId(db, 'journal'),
      source: 'app',
      now: at(6, 10),
      tzOffset: TZ,
    });
    skipMission(db, {
      missionId: missionId(db, 'no_social_evening'),
      reason: 'illness',
      now: at(6, 10),
      tzOffset: TZ,
    });
    expect(db.select({ id: appNotifications.id }).from(appNotifications).all()).toEqual([
      { id: 'reminder:a' },
      { id: 'reminder:c' },
    ]);
  });

  it('records the evening summary for its time and drops it while it is still to come', () => {
    const db = newGame(['journal']);
    const summary = {
      day: '2026-11-06',
      fireAt: at(6, 21),
      text: { title: 'T', body: 'B' },
    } as const;
    recordSummary(db, summary, at(6, 10));
    expect(unseenNotificationCount(db, at(6, 20))).toBe(0);
    expect(unseenNotificationCount(db, at(6, 21))).toBe(1);
    // Switched off before it fires: it was never sent.
    recordSummary(db, { day: '2026-11-06', fireAt: at(6, 21), text: null }, at(6, 12));
    expect(db.select().from(appNotifications).all()).toEqual([]);
    // Once shown it stays, whatever happens later.
    recordSummary(db, summary, at(6, 10));
    recordSummary(db, { day: '2026-11-06', fireAt: at(6, 21), text: null }, at(6, 22));
    expect(
      db
        .select({ params: appNotifications.params })
        .from(appNotifications)
        .where(eq(appNotifications.id, 'summary:2026-11-06'))
        .get(),
    ).toEqual({ params: { title: 'T', body: 'B' } });
  });

  it('lists the latest first, with day and local time, and counts the unseen ones', () => {
    const db = newGame(['journal']);
    remind(db, 'a', 'journal', 6, 9);
    remind(db, 'b', 'journal', 7, 8);
    recordFiredReminders(db, at(7, 9));
    const view = recentNotifications(db, clockAt(7, 9));
    expect(view.today).toBe('2026-11-07');
    expect(view.unseen).toBe(2);
    expect(view.items.map((item) => [item.id, item.day, item.time, item.seen])).toEqual([
      ['reminder:b', '2026-11-07', '08:00', false],
      ['reminder:a', '2026-11-06', '09:00', false],
    ]);
  });

  it('marks as seen only what was already sent', () => {
    const db = newGame(['journal']);
    remind(db, 'a', 'journal', 6, 9);
    recordFiredReminders(db, at(6, 10));
    recordSummary(
      db,
      { day: '2026-11-06', fireAt: at(6, 21), text: { title: 'T', body: 'B' } },
      at(6, 10),
    );
    expect(markNotificationsSeen(db, at(6, 10))).toBe(1);
    expect(unseenNotificationCount(db, at(6, 10))).toBe(0);
    expect(unseenNotificationCount(db, at(6, 21))).toBe(1);
    const view = recentNotifications(db, clockAt(6, 22));
    expect(view.items.map((item) => [item.id, item.seen])).toEqual([
      ['summary:2026-11-06', false],
      ['reminder:a', true],
    ]);
  });

  it('shows at most the latest ones', () => {
    const db = newGame(['journal']);
    for (let hour = 0; hour < 15; hour += 1) {
      db.insert(appNotifications)
        .values({ id: `n${hour}`, kind: 'boss.deadline_warning', createdAt: at(6, hour) })
        .run();
    }
    const view = recentNotifications(db, clockAt(6, 20), 10);
    expect(view.items).toHaveLength(10);
    expect(view.items[0].id).toBe('n14');
    expect(view.unseen).toBe(15);
  });
});
