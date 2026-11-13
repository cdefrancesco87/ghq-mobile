import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { hero, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { THEMES } from '@/theme/themes';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import Onboarding from '../../../app/onboarding';
import SettingsRoute from '../../../app/settings/index';
import { FRIDAY, clockAt, newGame } from '../../../test/game';

// «Elimina tutti i dati» (T56): the database file and the notifications of the phone are fakes.
// The fake file system holds one database: deleting it and opening it again gives an empty one.

const mockCancelAll = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  dismissAllNotificationsAsync: () => mockDismissAll(),
}));

const mockFiles: { db: Db | null; deleted: number } = { db: null, deleted: 0 };
jest.mock('@/db/client', () => ({
  deleteAppDatabase: () => {
    mockFiles.db = null;
    mockFiles.deleted += 1;
  },
  openAppDatabase: () => {
    mockFiles.db ??= jest.requireActual('../../../test/db').createTestDb();
    return Promise.resolve(mockFiles.db);
  },
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  onboarding: Onboarding,
  'settings/index': SettingsRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function open(db: Db, url = '/settings') {
  mockFiles.db = db;
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 12) });
  const i18n = await createI18n('it');
  await renderRouter(
    {
      ...ROUTES,
      _layout: () => (
        <AppProviders i18n={i18n}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      ),
    },
    { initialUrl: url },
  );
  if (url === '/profile') {
    await fireEvent.press(await screen.findByTestId('profile-settings'));
  }
  await screen.findByTestId('settings-screen');
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

/** From the red row to the field of the second confirmation. */
async function openConfirmation() {
  await press('settings-wipe');
  expect(screen.getByText('Eliminare tutti i dati?')).toBeOnTheScreen();
  await press('settings-wipe-continue');
  return screen.findByTestId('settings-wipe-input');
}

beforeEach(async () => {
  // Jest starts with a font scale of 2: the layout with very large text.
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale: 1 },
      screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
    });
  });
  mockCancelAll.mockReset().mockResolvedValue(undefined);
  mockDismissAll.mockReset().mockResolvedValue(undefined);
  mockFiles.db = null;
  mockFiles.deleted = 0;
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Elimina tutti i dati', () => {
  it('is the last row of Dati, in red', async () => {
    await open(newGame(['meditation']));
    const group = screen.getByTestId('settings-group-data');
    expect(group).toContainElement(screen.getByTestId('settings-wipe'));
    expect(screen.getByTestId('settings-wipe')).toHaveProp(
      'accessibilityLabel',
      'Elimina tutti i dati',
    );
    expect(screen.getByTestId('settings-wipe-label')).toHaveStyle({
      color: THEMES['minimal-chiaro'].colors.dangerText,
    });
  });

  it('says what is lost first and offers a backup', async () => {
    await open(newGame(['meditation']));
    await press('settings-wipe');
    expect(screen.getByText('Non si può annullare')).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Perdi missioni, storico, boss, trofei, badge e il tuo compagno. L'app riparte dal primo avvio.",
      ),
    ).toBeOnTheScreen();

    await press('settings-wipe-backup');
    expect(await screen.findByText('Il backup arriverà presto.')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-wipe-input')).toBeNull();
    expect(mockFiles.deleted).toBe(0);
  });

  it('turns the button on only with the word ELIMINA', async () => {
    await open(newGame(['meditation']));
    const input = await openConfirmation();
    expect(screen.getByText('Scrivi ELIMINA per confermare.')).toBeOnTheScreen();
    const button = () => screen.getByTestId('settings-wipe-confirm');
    expect(button()).toBeDisabled();

    await fireEvent.changeText(input, 'ELIMIN');
    expect(button()).toBeDisabled();
    await fireEvent.changeText(input, 'CANCELLA');
    expect(button()).toBeDisabled();
    await press('settings-wipe-confirm');
    expect(mockFiles.deleted).toBe(0);

    await fireEvent.changeText(input, ' elimina ');
    expect(button()).toBeEnabled();
    await fireEvent.changeText(input, 'ELIMINA');
    expect(button()).toBeEnabled();
  });

  it('starts empty every time the second confirmation opens', async () => {
    await open(newGame(['meditation']));
    const input = await openConfirmation();
    await fireEvent.changeText(input, 'ELIMINA');
    await press('settings-wipe-confirm-sheet-backdrop');

    expect(await openConfirmation()).toHaveProp('value', '');
    expect(screen.getByTestId('settings-wipe-confirm')).toBeDisabled();
  });

  it('deletes everything, cancels the notifications and goes back to the first launch', async () => {
    const old = newGame(['meditation', 'drink_water']);
    await open(old);
    await act(async () => useThemeStore.getState().setTheme('arcade'));
    const input = await openConfirmation();
    await fireEvent.changeText(input, 'ELIMINA');
    await press('settings-wipe-confirm');

    await waitFor(() => expect(screen).toHavePathname('/onboarding'));
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockFiles.deleted).toBe(1);
    // A new empty database, and stores that read it.
    const { db } = getSession();
    expect(db).not.toBe(old);
    expect(db.select().from(hero).all()).toEqual([]);
    expect(db.select().from(missions).all()).toEqual([]);
    expect(useAppStore.getState()).toMatchObject({ status: 'ready', hasProfile: false, db });
    expect(useHeroStore.getState().hero).toBeNull();
    expect(useThemeStore.getState().theme).toBe('minimal');
    expect(screen.getByTestId('onboarding-continue')).toBeOnTheScreen();
  });

  it('leaves Today and the Profile behind when it starts from the Profile', async () => {
    await open(newGame(['meditation']), '/profile');
    const input = await openConfirmation();
    await fireEvent.changeText(input, 'ELIMINA');
    await press('settings-wipe-confirm');

    await waitFor(() => expect(screen).toHavePathname('/onboarding'));
    expect(screen.getByTestId('onboarding-continue')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-screen')).toBeNull();
    expect(screen.queryByTestId('profile-settings')).toBeNull();
  });
});
