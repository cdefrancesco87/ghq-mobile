import type { DueMission } from './frequency';
import { plannedReminders, type PlannedRemindersInput, type ReminderMission } from './reminders';
import type { GameDay } from './types';

// Rome in winter: local time = UTC + 60 minutes. 2026-11-09 is a Monday.
const TZ = 60;
const MONDAY: GameDay = '2026-11-09';
const TUESDAY: GameDay = '2026-11-10';
const WEDNESDAY: GameDay = '2026-11-11';

/** UTC instant of a local time in Rome on a day of November 2026. */
const rome = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);

const ACTIVE: Omit<DueMission, 'kind' | 'frequency' | 'dueDay'> = {
  status: 'active',
  pausedUntil: null,
  deletedAt: null,
};

function habit(id: string, frequency: DueMission['frequency'] = { type: 'daily' }) {
  return { id, kind: 'habit', frequency, dueDay: null, ...ACTIVE } satisfies ReminderMission;
}

function task(id: string, dueDay: GameDay | null, dueTime: string | null) {
  return {
    id,
    kind: 'task',
    frequency: null,
    dueDay,
    dueTime,
    ...ACTIVE,
  } satisfies ReminderMission;
}

function plan(overrides: Partial<PlannedRemindersInput>) {
  return plannedReminders({
    missions: [],
    reminders: [],
    done: [],
    fromDay: MONDAY,
    days: 1,
    quietHours: [],
    dayChange: '06:00',
    tzOffset: TZ,
    weekStart: 1,
    restDays: [],
    ...overrides,
  });
}

const at = (missionId: string, time: string) => ({ missionId, time, leadMinutes: null });
const before = (missionId: string, leadMinutes: number) => ({ missionId, time: null, leadMinutes });

describe('plannedReminders', () => {
  it('gives every time of a daily habit on every day of the window, in order', () => {
    expect(
      plan({
        missions: [habit('read')],
        reminders: [at('read', '21:00'), at('read', '08:30')],
        days: 2,
      }),
    ).toEqual([
      { missionId: 'read', gameDay: MONDAY, fireAt: rome(9, 8, 30) },
      { missionId: 'read', gameDay: MONDAY, fireAt: rome(9, 21) },
      { missionId: 'read', gameDay: TUESDAY, fireAt: rome(10, 8, 30) },
      { missionId: 'read', gameDay: TUESDAY, fireAt: rome(10, 21) },
    ]);
  });

  it('follows the weekdays of the frequency', () => {
    const planned = plan({
      missions: [habit('gym', { type: 'weekdays', days: [1, 3] })],
      reminders: [at('gym', '18:00')],
      days: 7,
    });
    expect(planned.map((reminder) => reminder.gameDay)).toEqual([MONDAY, WEDNESDAY]);
  });

  it('puts a time before the day change on the next calendar day', () => {
    expect(
      plan({ missions: [habit('sleep')], reminders: [at('sleep', '01:30'), at('sleep', '06:00')] }),
    ).toEqual([
      { missionId: 'sleep', gameDay: MONDAY, fireAt: rome(9, 6) },
      { missionId: 'sleep', gameDay: MONDAY, fireAt: rome(10, 1, 30) },
    ]);
  });

  it('uses the day change in force for each day', () => {
    // From Tuesday the day changes at 03:00: Monday still ends at 06:00 on Tuesday.
    const dayChange = (day: GameDay) => (day >= TUESDAY ? '03:00' : '06:00');
    const planned = plan({
      missions: [habit('sleep')],
      reminders: [at('sleep', '04:00')],
      days: 3,
      dayChange,
    });
    expect(planned).toEqual([
      { missionId: 'sleep', gameDay: MONDAY, fireAt: rome(10, 4) },
      // Tuesday starts at 06:00 and ends at 03:00 on Wednesday: 04:00 is not in it.
      { missionId: 'sleep', gameDay: WEDNESDAY, fireAt: rome(11, 4) },
    ]);
  });

  it('moves a reminder inside «Non disturbare» to the end of the interval', () => {
    const planned = plan({
      missions: [habit('stretch'), habit('water')],
      reminders: [at('stretch', '22:30'), at('water', '06:30'), at('water', '12:00')],
      quietHours: [{ start: '22:00', end: '07:00' }],
      dayChange: '04:00',
    });
    expect(planned).toEqual([
      // 06:30 of Monday waits until 07:00 of Monday.
      { missionId: 'water', gameDay: MONDAY, fireAt: rome(9, 7) },
      { missionId: 'water', gameDay: MONDAY, fireAt: rome(9, 12) },
    ]);
  });

  it('drops a reminder whose quiet hours end after its game day', () => {
    // 22:30 of Monday would wait until 07:00 of Tuesday, when Monday is over.
    expect(
      plan({
        missions: [habit('stretch')],
        reminders: [at('stretch', '22:30')],
        quietHours: [{ start: '22:00', end: '07:00' }],
      }),
    ).toEqual([]);
  });

  it('keeps the reminders that the quiet hours do not touch', () => {
    expect(
      plan({
        missions: [habit('read')],
        reminders: [at('read', '21:59'), at('read', '07:00')],
        quietHours: [{ start: '22:00', end: '07:00' }],
      }).map((reminder) => reminder.fireAt),
    ).toEqual([rome(9, 7), rome(9, 21, 59)]);
  });

  it('follows quiet hours that lead into other quiet hours', () => {
    expect(
      plan({
        missions: [habit('read')],
        reminders: [at('read', '12:15')],
        quietHours: [
          { start: '13:00', end: '14:00' },
          { start: '12:00', end: '13:00' },
        ],
      }).map((reminder) => reminder.fireAt),
    ).toEqual([rome(9, 14)]);
  });

  it('gives a mission one reminder when quiet hours bring two times together', () => {
    expect(
      plan({
        missions: [habit('read'), habit('water')],
        reminders: [at('read', '06:30'), at('read', '06:45'), at('water', '06:40')],
        quietHours: [{ start: '06:00', end: '07:00' }],
      }),
    ).toEqual([
      { missionId: 'read', gameDay: MONDAY, fireAt: rome(9, 7) },
      { missionId: 'water', gameDay: MONDAY, fireAt: rome(9, 7) },
    ]);
  });

  it('skips a mission already done or skipped on that day, not on the next', () => {
    const planned = plan({
      missions: [habit('read'), habit('water')],
      reminders: [at('read', '21:00'), at('water', '21:00')],
      done: [
        { missionId: 'read', day: MONDAY },
        { missionId: 'water', day: TUESDAY },
      ],
      days: 2,
    });
    expect(planned).toEqual([
      { missionId: 'water', gameDay: MONDAY, fireAt: rome(9, 21) },
      { missionId: 'read', gameDay: TUESDAY, fireAt: rome(10, 21) },
    ]);
  });

  it('stops a habit counted per week once the week has its completions', () => {
    const planned = plan({
      missions: [habit('run', { type: 'times_per_week', times: 2 })],
      reminders: [at('run', '19:00')],
      done: [
        { missionId: 'run', day: '2026-11-08' },
        { missionId: 'run', day: MONDAY },
        { missionId: 'run', day: TUESDAY },
      ],
      fromDay: TUESDAY,
      days: 7,
    });
    // Sunday 8 belongs to the week before; Monday and Tuesday make 2 this week.
    expect(planned.map((reminder) => reminder.gameDay)).toEqual(['2026-11-16']);
  });

  it('gives no reminders on rest days', () => {
    expect(
      plan({
        missions: [habit('read')],
        reminders: [at('read', '21:00')],
        restDays: [2],
        days: 2,
      }).map((reminder) => reminder.gameDay),
    ).toEqual([MONDAY]);
  });

  it('gives no reminders to paused, archived or deleted missions', () => {
    const planned = plan({
      missions: [
        { ...habit('paused'), status: 'paused', pausedUntil: TUESDAY },
        { ...habit('archived'), status: 'archived' },
        { ...habit('deleted'), deletedAt: 1 },
      ],
      reminders: [at('paused', '21:00'), at('archived', '21:00'), at('deleted', '21:00')],
      days: 2,
    });
    expect(planned).toEqual([{ missionId: 'paused', gameDay: TUESDAY, fireAt: rome(10, 21) }]);
  });

  it('reminds a task the chosen minutes before its due time, on its due day only', () => {
    const planned = plan({
      missions: [task('dentist', TUESDAY, '10:00')],
      reminders: [before('dentist', 15), before('dentist', 0)],
      days: 3,
    });
    expect(planned).toEqual([
      { missionId: 'dentist', gameDay: TUESDAY, fireAt: rome(10, 9, 45) },
      { missionId: 'dentist', gameDay: TUESDAY, fireAt: rome(10, 10) },
    ]);
  });

  it('gives no reminder to a task without a due time or already done', () => {
    const planned = plan({
      missions: [task('no-time', MONDAY, null), task('done', MONDAY, '20:00')],
      reminders: [before('no-time', 5), before('done', 5)],
      done: [{ missionId: 'done', day: MONDAY }],
    });
    expect(planned).toEqual([]);
  });

  it('uses the time zone it is given', () => {
    // New York in winter: local time = UTC − 5 hours.
    expect(
      plan({ missions: [habit('read')], reminders: [at('read', '08:00')], tzOffset: -300 }),
    ).toEqual([{ missionId: 'read', gameDay: MONDAY, fireAt: Date.UTC(2026, 10, 9, 13) }]);
  });

  it('ignores reminders of missions it was not given', () => {
    expect(plan({ reminders: [at('ghost', '08:00')] })).toEqual([]);
  });
});
