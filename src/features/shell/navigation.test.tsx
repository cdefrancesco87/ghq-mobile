import { Stack, router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { createI18n, type Language } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import type { Db } from '@/db/types';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Stats from '../../../app/(tabs)/stats';
import Today from '../../../app/(tabs)/today';
import Companion from '../../../app/companion';
import Editor from '../../../app/editor';
import Index from '../../../app/index';
import Onboarding from '../../../app/onboarding';
import Settings from '../../../app/settings';
import Shop from '../../../app/shop';
import { createTestDb } from '../../../test/db';
import { FRIDAY, clockAt, newGame } from '../../../test/game';
import { AppProviders } from './AppProviders';

// The routes of the `app/` folder, with the providers of the root layout (without fonts and
// without the real database).
const ROUTES: Record<string, ComponentType> = {
  index: Index,
  onboarding: Onboarding,
  companion: Companion,
  shop: Shop,
  settings: Settings,
  editor: Editor,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/stats': Stats,
  '(tabs)/profile': Profile,
};

async function openApp(
  db: Db,
  { language = 'it', url = '/' }: { language?: Language; url?: string } = {},
) {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
  const i18n = await createI18n(language);
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
}

/** The accessibility labels of the tabs in the bar, in order (react-navigation writes them). */
function tabLabels(): string[] {
  return screen
    .queryAllByLabelText(/, tab, \d of \d$/)
    .map((tab) => String(tab.props.accessibilityLabel));
}

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('navigation', () => {
  it('shows the five tabs of the bar and the [+] with a profile', async () => {
    await openApp(newGame(['drink_water']));

    expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    // The bar has 6 slots; the [+] in the middle is the 3rd.
    expect(tabLabels()).toEqual([
      'Oggi, tab, 1 of 6',
      'Abitudini, tab, 2 of 6',
      'Obiettivi, tab, 4 of 6',
      'Statistiche, tab, 5 of 6',
      'Profilo, tab, 6 of 6',
    ]);
    expect(screen.getByRole('button', { name: 'Nuova missione' })).toBeOnTheScreen();
  });

  it('changes screen from the bar', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByRole('header', { name: 'Oggi' });

    await fireEvent.press(screen.getByLabelText(/^Statistiche, tab/));

    expect(await screen.findByRole('header', { name: 'Statistiche' })).toBeOnTheScreen();
  });

  it('opens the editor from the [+]', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByRole('header', { name: 'Oggi' });

    await fireEvent.press(screen.getByRole('button', { name: 'Nuova missione' }));

    expect(await screen.findByRole('header', { name: 'Editor missione' })).toBeOnTheScreen();
  });

  it('writes the titles in the given language', async () => {
    await openApp(newGame(['drink_water']), { language: 'en' });

    expect(await screen.findByRole('header', { name: 'Today' })).toBeOnTheScreen();
  });

  it('redirects to the first launch when there is no profile', async () => {
    await openApp(createTestDb());

    expect(await screen.findByRole('header', { name: 'Primo avvio' })).toBeOnTheScreen();
    expect(tabLabels()).toEqual([]);
  });

  it('redirects a link to the tabs to the first launch when there is no profile', async () => {
    await openApp(createTestDb(), { url: '/habits' });

    expect(await screen.findByRole('header', { name: 'Primo avvio' })).toBeOnTheScreen();
    expect(tabLabels()).toEqual([]);
  });

  it('has a placeholder for companion, shop and settings', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByRole('header', { name: 'Oggi' });

    for (const [path, title] of [
      ['/companion', 'Compagno'],
      ['/shop', 'Negozio'],
      ['/settings', 'Impostazioni'],
    ] as const) {
      await act(() => router.push(path));
      expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
    }
  });
});
