import { waitFor } from '@testing-library/react-native';

import { startTimer } from '@/db/repositories/timers';
import { runAction, startApp } from '@/stores/app';

import { FRIDAY, clockAt, missionId, newGame } from '../../../test/game';
import type { TimerActivityHost, TimerActivityProps } from './timerActivity';
import { watchTimerActivities } from './useTimerActivities';

const mockSchedule = jest.fn(async (_request: unknown) => 'id');
const mockCancel = jest.fn(async (_id: string) => undefined);
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  scheduleNotificationAsync: (request: unknown) => mockSchedule(request),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  dismissNotificationAsync: async () => undefined,
}));

// The buttons of the activity reach the app through the touch listener of expo-widgets.
let touch: ((target: string) => void) | null = null;
jest.mock('./system', () => ({
  onWidgetTouch: (listener: (target: string) => void) => {
    touch = listener;
    return () => {
      touch = null;
    };
  },
  systemTimerActivityHost: () => null,
}));

function fakeHost() {
  const shown = new Map<string, TimerActivityProps>();
  const ended: { props: TimerActivityProps | null; dismissAt: number | null }[] = [];
  let next = 0;
  const host: TimerActivityHost = {
    start: (props) => {
      next += 1;
      shown.set(`a${next}`, props);
      return `a${next}`;
    },
    update: async (id, props) => {
      shown.set(id, props);
    },
    end: async (id, props, dismissAt) => {
      shown.delete(id);
      ended.push({ props, dismissAt });
    },
    list: () => [...shown.keys()],
  };
  return { host, shown, ended };
}

describe('watchTimerActivities (design 12.5, T87)', () => {
  it('follows the play, the buttons Pausa, Riprendi and Completa, and the end', async () => {
    const db = newGame(['meditation']);
    const id = missionId(db, 'meditation');
    let now = clockAt(FRIDAY, 10);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: () => now });
    const { host, shown, ended } = fakeHost();
    const stop = watchTimerActivities(db, host);
    try {
      runAction((actionDb, clock) => startTimer(actionDb, { missionId: id, ...clock }));
      await waitFor(() => expect([...shown.values()]).toMatchObject([{ phase: 'running' }]));

      now = { ...now, now: now.now + 4 * 60_000 };
      touch?.(`la|p|${id}|2026-11-06`);
      await waitFor(() =>
        expect([...shown.values()]).toMatchObject([{ phase: 'paused', remainingText: '06:00' }]),
      );
      expect(mockCancel).toHaveBeenCalledWith(`timer:${id}`);

      touch?.(`la|r|${id}|2026-11-06`);
      await waitFor(() => expect([...shown.values()]).toMatchObject([{ phase: 'running' }]));
      await waitFor(() =>
        expect(mockSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ identifier: `timer:${id}` }),
        ),
      );

      touch?.(`la|c|${id}|2026-11-06`);
      await waitFor(() => expect(ended).toMatchObject([{ props: { phase: 'done' } }]));
      expect(shown.size).toBe(0);
    } finally {
      stop();
    }
    expect(touch).toBeNull();
  });
});
