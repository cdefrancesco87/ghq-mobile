import { NOTIFICATIONS } from './config';
import { eveningSummary, eveningSummaryAt, reminderSlots } from './notifications';
import type { GameDay } from './types';

const MONDAY: GameDay = '2026-11-09';
const TZ = 60;
/** UTC instant of a local time in Rome on a day of November 2026. */
const rome = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour - 1, minute);

describe('reminderSlots', () => {
  const at = (missionId: string, minute: number) => ({
    missionId,
    gameDay: MONDAY,
    fireAt: minute * 60_000,
  });

  it('keeps one notification for each mission when fewer than 3 share a minute', () => {
    const slots = reminderSlots([at('a', 1000), at('b', 1000), at('c', 2000)]);
    expect(slots).toEqual([
      { fireAt: 60_000_000, grouped: false, members: [at('a', 1000)] },
      { fireAt: 60_000_000, grouped: false, members: [at('b', 1000)] },
      { fireAt: 120_000_000, grouped: false, members: [at('c', 2000)] },
    ]);
  });

  it('groups 3 or more reminders of the same minute in one notification', () => {
    const slots = reminderSlots([at('a', 1000), at('b', 1000), at('c', 1000), at('d', 5000)]);
    expect(NOTIFICATIONS.groupMinSize).toBe(3);
    expect(slots).toEqual([
      { fireAt: 60_000_000, grouped: true, members: [at('a', 1000), at('b', 1000), at('c', 1000)] },
      { fireAt: 300_000_000, grouped: false, members: [at('d', 5000)] },
    ]);
  });

  it('groups reminders of the same minute even when they are not next to each other', () => {
    const slots = reminderSlots([at('a', 1000), at('b', 2000), at('c', 1000), at('d', 1000)]);
    expect(slots.map((slot) => [slot.fireAt, slot.members.map((m) => m.missionId)])).toEqual([
      [60_000_000, ['a', 'c', 'd']],
      [120_000_000, ['b']],
    ]);
  });
});

describe('eveningSummary', () => {
  const mission = (name: string, done = false) => ({ name, done });

  it('gives nothing on a day with no mission', () => {
    expect(eveningSummary([])).toBeNull();
  });

  it('is a compliment when every mission is done (0 left)', () => {
    expect(eveningSummary([mission('Read', true), mission('Walk', true)])).toEqual({
      kind: 'all_done',
    });
  });

  it('names the 2 missions left', () => {
    expect(eveningSummary([mission('Read'), mission('Walk', true), mission('Water')])).toEqual({
      kind: 'left',
      count: 2,
      names: ['Read', 'Water'],
      others: 0,
    });
  });

  it('names at most 3 of 5 missions left, then counts the others', () => {
    const missions = ['A', 'B', 'C', 'D', 'E'].map((name) => mission(name));
    expect(NOTIFICATIONS.eveningMaxNames).toBe(3);
    expect(eveningSummary(missions)).toEqual({
      kind: 'left',
      count: 5,
      names: ['A', 'B', 'C'],
      others: 2,
    });
  });
});

describe('eveningSummaryAt', () => {
  it('fires at the chosen local time of the game day', () => {
    expect(eveningSummaryAt({ day: MONDAY, time: '21:00', dayChange: '00:00', tzOffset: TZ })).toBe(
      rome(9, 21),
    );
  });

  it('puts a time before the day change in the night after the game day', () => {
    expect(eveningSummaryAt({ day: MONDAY, time: '01:30', dayChange: '04:00', tzOffset: TZ })).toBe(
      rome(10, 1, 30),
    );
  });
});
