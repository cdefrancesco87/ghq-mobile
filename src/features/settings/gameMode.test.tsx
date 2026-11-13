import { eq } from 'drizzle-orm';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { createBoss } from '@/db/repositories/boss';
import { getSetting, setSetting } from '@/db/repositories/settings';
import { boss, hero } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
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
import BossRoute from '../../../app/boss/[id]';
import Index from '../../../app/index';
import SettingsRoute from '../../../app/settings/index';
import { FRIDAY, at, clockAt, expectHeroMatchesLog, newGame } from '../../../test/game';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => Promise.resolve({ status: 'granted', canAskAgain: true }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'granted', canAskAgain: true }),
  addNotificationResponseReceivedListener: () => ({ remove: () => undefined }),
  getLastNotificationResponseAsync: () => Promise.resolve(null),
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'settings/index': SettingsRoute,
  'boss/[id]': BossRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function open(db: Db, url: string) {
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
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

const THESIS = { name: 'Tesi', difficulty: 'medium', steps: ['Indice', 'Capitolo 1'] } as const;

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Livello di gioco', () => {
  it('goes to Essential and back through the confirmation sheet, without losing data', async () => {
    const db = newGame(['journal']);
    const before = db.select().from(hero).get();
    await open(db, '/settings');
    await screen.findByTestId('settings-screen');

    expect(screen.getByTestId('settings-group-game')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Livello di gioco, Completo/)).toBeOnTheScreen();
    await press('settings-game-mode');
    expect(screen.getByRole('header', { name: 'Passare a Essenziale?' })).toBeOnTheScreen();
    expect(screen.getByTestId('settings-game-mode-body')).toHaveTextContent(/Spariscono vita/);
    await press('settings-game-mode-confirm');
    expect(getSetting(db, 'game_mode')).toBe('essential');
    expect(screen.getByLabelText(/Livello di gioco, Essenziale/)).toBeOnTheScreen();

    // Today without health, coins and boss, with the hero on one row.
    await act(() => router.push('/today'));
    await screen.findByTestId('today-screen');
    expect(screen.getByTestId('today-hero-essential')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-hero-hp')).toBeNull();
    expect(screen.queryByTestId('today-hero-xp')).toBeNull();
    expect(screen.queryByTestId('today-hero-coins')).toBeNull();
    expect(screen.getByTestId('today-hero-level')).toHaveTextContent('Livello 1');
    // The quest of the first launch is the list «Primi passi», without boss and reward.
    expect(screen.getByTestId('today-starter-name')).toHaveTextContent('Primi passi');
    expect(screen.queryByTestId('today-starter-reward')).toBeNull();

    // Back to Full: everything comes back, with the same values.
    await act(() => router.push('/settings'));
    await screen.findByTestId('settings-screen');
    await press('settings-game-mode');
    expect(screen.getByRole('header', { name: 'Tornare a Completo?' })).toBeOnTheScreen();
    await press('settings-game-mode-confirm');
    expect(getSetting(db, 'game_mode')).toBe('full');
    await act(() => router.push('/today'));
    await screen.findByTestId('today-screen');
    expect(screen.getByTestId('today-hero-hp')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Monete. Apri il negozio')).toBeOnTheScreen();
    expect(screen.getByTestId('today-starter-reward')).toBeOnTheScreen();
    expect(db.select().from(hero).get()).toEqual(before);
    expectHeroMatchesLog(db);
  });

  it('keeps the confirmation sheet closed on Annulla', async () => {
    const db = newGame(['journal']);
    await open(db, '/settings');
    await screen.findByTestId('settings-screen');
    await press('settings-game-mode');
    await press('settings-game-mode-cancel');
    expect(getSetting(db, 'game_mode')).toBe('full');
  });
});

describe('Modalità Essenziale', () => {
  function essentialGame(): Db {
    const db = newGame(['journal']);
    setSetting(db, 'game_mode', 'essential', at(FRIDAY, 9));
    return db;
  }

  it('shows the goals as steps with a bar, without health, sprite and Hall of trophies', async () => {
    const db = essentialGame();
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    await open(db, '/goals');
    await screen.findByTestId('goals-screen');

    expect(screen.getByRole('header', { name: 'Obiettivi' })).toBeOnTheScreen();
    const card = `goals-boss-${thesis.id}`;
    expect(screen.getByTestId(`${card}-progress`)).toBeOnTheScreen();
    expect(screen.getByLabelText('Passi di Tesi 0 su 2')).toBeOnTheScreen();
    expect(screen.queryByTestId(`${card}-hp`)).toBeNull();
    expect(screen.queryByTestId(`${card}-ring`)).toBeNull();
    expect(screen.queryByTestId(`${card}-sprite`)).toBeNull();

    // A step: no damage, the bar moves on.
    await press(`${card}-step`);
    expect(screen.queryByTestId(`${card}-damage`)).toBeNull();
    expect(screen.getByText('Passo completato')).toBeOnTheScreen();
    expect(screen.getByLabelText('Passi di Tesi 1 su 2')).toBeOnTheScreen();
    expect(db.select().from(boss).where(eq(boss.id, thesis.id)).get()?.hp).toBeLessThan(40);
  });

  it('keeps the bosses out of Today', async () => {
    const db = essentialGame();
    createBoss(db, THESIS, clockAt(FRIDAY, 10));
    await open(db, '/today');
    await screen.findByTestId('today-screen');

    expect(screen.queryByTestId('today-bosses')).toBeNull();
    expect(screen.queryByTestId('today-bosses-empty')).toBeNull();
  });

  it('hides the character sheet, Shop and Hall of trophies in the Profile', async () => {
    await open(essentialGame(), '/profile');
    await screen.findByTestId('profile-screen');

    expect(screen.queryByTestId('profile-sheet')).toBeNull();
    expect(screen.queryByTestId('profile-link-shop')).toBeNull();
    expect(screen.queryByTestId('profile-link-trophies')).toBeNull();
    expect(screen.queryByTestId('profile-xp')).toBeNull();
    expect(screen.queryByTestId('profile-number-bosses')).toBeNull();
    expect(screen.getByTestId('profile-level')).toHaveTextContent('Livello 1');
    expect(screen.getByTestId('profile-link-stats')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-link-companion')).toBeOnTheScreen();
  });

  it('shows the card of a goal without arena, health and difficulty', async () => {
    const db = essentialGame();
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    await open(db, `/boss/${thesis.id}`);
    await screen.findByTestId('boss-screen');

    expect(screen.getByRole('header', { name: 'Obiettivo' })).toBeOnTheScreen();
    expect(screen.queryByTestId('boss-arena')).toBeNull();
    expect(screen.queryByTestId('boss-hp')).toBeNull();
    expect(screen.queryByTestId('boss-chip-difficulty')).toBeNull();
    expect(screen.getByTestId('boss-progress')).toBeOnTheScreen();
  });
});
