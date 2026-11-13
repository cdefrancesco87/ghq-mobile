import { and, eq } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { events, missionDays, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { TIMER } from '@/rules/config';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import {
  FRIDAY,
  TZ,
  at,
  expectHeroMatchesLog,
  missionId,
  newGame,
  withBadgesUnlocked,
} from '../../../test/game';

jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const MINUTE = 60_000;
const START = at(FRIDAY, 10);
/** The fake clock of the app: tests move it forward. */
let now = START;

async function openToday(db: Db) {
  useAppStore.getState().reset();
  withBadgesUnlocked(db);
  await startApp({
    openDatabase: () => Promise.resolve(db),
    clock: () => ({ now, tzOffset: TZ }),
  });
  const i18n = await createI18n('it');
  const rendered = await renderRouter(
    {
      ...ROUTES,
      _layout: () => (
        <AppProviders i18n={i18n}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      ),
    },
    { initialUrl: '/' },
  );
  await screen.findByTestId('today-screen');
  return rendered;
}

/** Moves the clock and lets the countdown tick once. */
async function wait(ms: number) {
  now += ms;
  await act(async () => {
    jest.advanceTimersByTime(TIMER.tickMs);
  });
}

function dayOf(db: Db, id: string) {
  return db
    .select()
    .from(missionDays)
    .where(and(eq(missionDays.missionId, id), eq(missionDays.gameDay, '2026-11-06')))
    .get();
}

const row = (id: string) => `today-mission-${id}`;

const name = (db: Db, id: string) =>
  db.select({ name: missions.name }).from(missions).where(eq(missions.id, id)).get()?.name ?? '';

function setup() {
  // Meditation: 10 minutes; journal keeps the day from being full at the end.
  const db = newGame(['meditation', 'journal']);
  return { db, id: missionId(db, 'meditation') };
}

beforeEach(() => {
  now = START;
  jest.clearAllMocks();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Today: the timer of a duration mission', () => {
  it('shows the play instead of the box, with the minutes of the goal', async () => {
    const { db, id } = setup();
    await openToday(db);

    expect(screen.getByTestId(`${row(id)}-control-play`)).toBeOnTheScreen();
    expect(screen.getByTestId(row(id))).toHaveTextContent(/10 min/);
    expect(screen.getByTestId(`${row(id)}-control`)).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining('Tocca due volte per avviare il timer'),
    );
    expect(
      screen.getByTestId(`${row(id)}-timer-bar`, { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('starts, counts down, pauses with the minutes saved and goes on from there', async () => {
    const { db, id } = setup();
    await openToday(db);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    expect(screen.getByTestId(`${row(id)}-control-pause`)).toBeOnTheScreen();
    expect(screen.getByTestId(row(id))).toHaveTextContent(/10:00 rimasti/);
    // The notification of the end, at the end.
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `timer:${id}`,
        content: expect.objectContaining({
          title: `Tempo finito: ${name(db, id)}`,
          body: "Apri l'app per raccogliere la ricompensa.\n— Cloudy",
        }),
        trigger: expect.objectContaining({ date: START + 10 * MINUTE }),
      }),
    );

    await wait(90_000);
    expect(screen.getByTestId(row(id))).toHaveTextContent(/08:30 rimasti/);

    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    expect(dayOf(db, id)).toMatchObject({ status: 'partial', value: 1.5 });
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`timer:${id}`);
    expect(screen.getByTestId(`${row(id)}-control-play`)).toBeOnTheScreen();
    expect(screen.getByTestId(row(id))).toHaveTextContent(/In pausa · 08:30 rimasti/);

    // A pause stops the countdown.
    await wait(5 * MINUTE);
    expect(screen.getByTestId(row(id))).toHaveTextContent(/08:30 rimasti/);

    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    expect(screen.getByTestId(row(id))).toHaveTextContent(/08:30 rimasti/);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ date: now + 8.5 * MINUTE }) }),
    );
    expectHeroMatchesLog(db);
  });

  it('goes on after the app is closed and completes the mission at the end, with a vibration', async () => {
    const { db, id } = setup();
    const first = await openToday(db);
    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    first.unmount();

    // The app opens again 4 minutes later: the timer kept running.
    now += 4 * MINUTE;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    await openToday(db);
    expect(screen.getByTestId(row(id))).toHaveTextContent(/06:00 rimasti/);
    expect(screen.getByTestId(`${row(id)}-control-pause`)).toBeOnTheScreen();

    await wait(6 * MINUTE);
    expect(dayOf(db, id)).toMatchObject({ status: 'done', value: 10 });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(screen.getByTestId('today-done')).toHaveTextContent(new RegExp(name(db, id)));
    expect(screen.getByTestId('undo-toast')).toBeOnTheScreen();
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );
    expectHeroMatchesLog(db);
  });

  it('completes at the opening of the app when the end came while it was closed', async () => {
    const { db, id } = setup();
    const first = await openToday(db);
    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    first.unmount();

    now += 30 * MINUTE;
    await openToday(db);
    expect(dayOf(db, id)).toMatchObject({ status: 'done', value: 10 });
    expect(screen.getByTestId('today-done')).toHaveTextContent(new RegExp(name(db, id)));
    expectHeroMatchesLog(db);
  });
});
