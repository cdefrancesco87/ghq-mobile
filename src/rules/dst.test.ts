import { deadlineWarningAt } from './boss';
import { eveningSummaryAt } from './notifications';
import { recallAt } from './recall';
import { plannedReminders, quietHoursEnd } from './reminders';
import type { GameDay } from './types';
import { nextRecapAt } from './weeklyRecap';

// Rome across the end of summer time: on Sunday 25 October 2026 at 03:00 local (01:00 UTC) the
// clocks go back to 02:00. Before it local time = UTC + 120 minutes, after it UTC + 60. The
// offset of each instant is injected as a function, as the app does with the phone clock.

const DST_END = Date.UTC(2026, 9, 25, 1);
const romeOffset = (instant: number) => (instant < DST_END ? 120 : 60);

/** UTC instant of a local time in Rome on a day of October 2026 (or of November, past 31). */
const rome = (day: number, hour: number, minute = 0) => {
  const local = Date.UTC(2026, 9, day, hour, minute);
  return local - romeOffset(local - 120 * 60_000) * 60_000;
};

describe('the offset of each instant across a change of summer time', () => {
  it('keeps the local time of the reminders on the days after the change', () => {
    const planned = plannedReminders({
      missions: [
        {
          id: 'read',
          kind: 'habit',
          frequency: { type: 'daily' },
          dueDay: null,
          status: 'active',
          pausedUntil: null,
          deletedAt: null,
        },
      ],
      reminders: [{ missionId: 'read', time: '08:00', leadMinutes: null }],
      done: [],
      fromDay: '2026-10-23' as GameDay,
      days: 4,
      quietHours: [],
      dayChange: '06:00',
      tzOffset: romeOffset,
      weekStart: 1,
      restDays: [],
    });
    expect(planned.map((reminder) => reminder.fireAt)).toEqual([
      rome(23, 8),
      rome(24, 8),
      rome(25, 8),
      rome(26, 8),
    ]);
    expect(rome(26, 8)).toBe(Date.UTC(2026, 9, 26, 7));
  });

  it('ends the quiet hours at their local time after the change', () => {
    // Saturday 24 at 23:00 CEST; «Non disturbare» 22:00–07:00 ends Sunday at 07:00 CET.
    expect(quietHoursEnd(rome(24, 23), romeOffset, [{ start: '22:00', end: '07:00' }])).toBe(
      rome(25, 7),
    );
  });

  it('gives the evening summary, the weekly recap and the check-in at their local time', () => {
    expect(
      eveningSummaryAt({
        day: '2026-10-25',
        time: '21:00',
        dayChange: '06:00',
        tzOffset: romeOffset,
      }),
    ).toBe(rome(25, 21));
    expect(
      nextRecapAt({
        now: rome(23, 12),
        today: '2026-10-23',
        tzOffset: romeOffset,
        dayChange: () => '06:00',
        weekday: 7,
        time: '19:00',
        quietHours: [],
        pause: null,
      }),
    ).toBe(rome(25, 19));
    // Opened Thursday 22 at 18:30 CEST: the check-in comes Sunday 25 at 18:30 CET.
    expect(
      recallAt({
        now: rome(22, 18, 30),
        tzOffset: romeOffset,
        dayChange: '06:00',
        quietHours: [],
        pause: null,
      }),
    ).toBe(rome(25, 18, 30));
  });

  it('gives the warning of a boss deadline at its local time after the change', () => {
    // Deadline Wednesday 28 October: the warning comes 3 days before, at its local time, in CET.
    const warning = deadlineWarningAt('2026-10-28', romeOffset);
    expect(warning).toBe(deadlineWarningAt('2026-10-28', 60));
    expect(warning).not.toBe(deadlineWarningAt('2026-10-28', 120));
  });
});
