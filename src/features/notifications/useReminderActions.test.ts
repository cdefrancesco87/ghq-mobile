import * as Notifications from 'expo-notifications';

import { completeMission } from '@/db/repositories/completion';
import type { Db } from '@/db/types';
import { onActionDone, startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';

import { FRIDAY, clockAt, missionId, newGame } from '../../../test/game';
import { handleNotificationResponse } from './backgroundTask';
import { refreshWhenActive, respondInApp } from './useReminderActions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('./backgroundTask', () => ({
  handleNotificationResponse: jest.fn(),
  syncSystemRecall: jest.fn(() => Promise.resolve()),
  syncSystemReminders: jest.fn(() => Promise.resolve()),
  registerReminderTask: jest.fn(() => Promise.resolve()),
}));

const handle = jest.mocked(handleNotificationResponse);

function response(missionIdValue: string) {
  return {
    actionIdentifier: 'complete',
    notification: {
      date: 0,
      request: {
        identifier: 'r1',
        content: { data: { kind: 'reminder', missionId: missionIdValue } },
      },
    },
  } as unknown as Notifications.NotificationResponse;
}

/** The action of a notification, written on the database outside `runAction`. */
function completeFrom(db: Db, id: string): void {
  completeMission(db, { missionId: id, source: 'notification', ...clockAt(FRIDAY, 10) });
}

const listener = jest.fn();
let stop: () => void = () => undefined;

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
  handle.mockReset();
  listener.mockClear();
  stop = onActionDone(listener);
});

afterEach(() => stop());

describe('an action from a notification with the app open', () => {
  it('refreshes the stores and tells the listeners, as runAction does', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
    const id = missionId(db, 'drink_water');
    handle.mockImplementation(async (actionDb) => {
      completeFrom(actionDb, id);
      return { outcome: 'ignored' };
    });

    await respondInApp(db, response(id));

    expect(useHeroStore.getState().hero?.xpTotal).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledWith(db);
  });

  it('never rejects, even when the action fails', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
    handle.mockRejectedValue(new Error('boom'));

    await expect(respondInApp(db, response('x'))).resolves.toBeUndefined();
  });
});

describe('the app back in front after the background task', () => {
  it('reloads the stores and tells the listeners', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
    // The background task wrote on its own connection while the app was closed.
    completeFrom(db, missionId(db, 'drink_water'));
    expect(useHeroStore.getState().hero?.xpTotal).toBe(0);

    refreshWhenActive();

    expect(useHeroStore.getState().hero?.xpTotal).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalledWith(db);
  });

  it('does nothing when the session is closed', () => {
    expect(() => refreshWhenActive()).not.toThrow();
  });
});
