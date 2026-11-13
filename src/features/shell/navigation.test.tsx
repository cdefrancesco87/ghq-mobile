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
import Stats from '../../../app/stats';
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
  stats: Stats,
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

/** The full accessibility labels of the tabs in the bar, in order (the visible text may be cut). */
function tabLabels(): string[] {
  return ['today', 'habits', 'goals', 'profile']
    .map((name) => screen.queryByTestId(`tab-${name}`))
    .flatMap((tab) =>
      tab ? [String(tab.props.accessibilityLabel ?? tab.props['aria-label'])] : [],
    );
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

    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
    // The bar has 5 slots; the [+] in the middle is the 3rd. Stats is a stack route, not a tab.
    expect(tabLabels()).toEqual(['Oggi', 'Abitudini', 'Obiettivi', 'Profilo']);
    expect(screen.getByRole('button', { name: 'Nuova missione' })).toBeOnTheScreen();
    expect(screen.getByTestId('tab-new')).toBeOnTheScreen();
  });

  it('keeps the tab labels on one line, truncated, with the font scale capped at 1.3', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByTestId('today-screen');

    for (const label of ['Oggi', 'Abitudini', 'Obiettivi', 'Profilo']) {
      const text = screen.getAllByText(label).find((node) => node.props.numberOfLines === 1);
      expect(text?.props.maxFontSizeMultiplier).toBe(1.3);
      expect(text?.props.ellipsizeMode).toBe('tail');
    }
  });

  it('changes screen from the bar', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByTestId('today-screen');

    await fireEvent.press(screen.getByTestId('tab-habits'));

    expect(await screen.findByRole('header', { name: 'Abitudini' })).toBeOnTheScreen();
  });

  it('opens the editor from the [+]', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByTestId('today-screen');

    await fireEvent.press(screen.getByRole('button', { name: 'Nuova missione' }));

    expect(await screen.findByRole('header', { name: 'Nuova abitudine' })).toBeOnTheScreen();
  });

  it('writes the titles in the given language', async () => {
    await openApp(newGame(['drink_water']), { language: 'en' });

    // The greeting of Today, with the name of the hero of newGame.
    expect(await screen.findByRole('header', { name: 'Hi, Claudio' })).toBeOnTheScreen();
  });

  it('redirects to the first launch when there is no profile', async () => {
    await openApp(createTestDb());

    expect(await screen.findByRole('header', { name: 'Scegli la lingua' })).toBeOnTheScreen();
    expect(tabLabels()).toEqual([]);
  });

  it('redirects a link to the tabs to the first launch when there is no profile', async () => {
    await openApp(createTestDb(), { url: '/habits' });

    expect(await screen.findByRole('header', { name: 'Scegli la lingua' })).toBeOnTheScreen();
    expect(tabLabels()).toEqual([]);
  });

  it('leaves the first launch for Today when the profile exists', async () => {
    await openApp(newGame(['drink_water']), { url: '/onboarding' });

    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
  });

  it('reaches stats as a stack route (not a tab)', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByTestId('today-screen');

    await act(() => router.push('/stats'));
    expect(await screen.findByRole('header', { name: 'Statistiche' })).toBeOnTheScreen();
  });

  it('opens the companion and has a placeholder for shop and settings', async () => {
    await openApp(newGame(['drink_water']));
    await screen.findByTestId('today-screen');

    for (const [path, title] of [
      ['/companion', 'Cloudy'],
      ['/shop', 'Negozio'],
      ['/settings', 'Impostazioni'],
    ] as const) {
      await act(() => router.push(path));
      expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
    }
  });
});
