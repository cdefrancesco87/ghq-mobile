import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { completeMission } from '@/db/repositories/completion';
import { events, hero, heroStats, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { PROFILE } from '@/rules/config';
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
import CompanionRoute from '../../../app/companion';
import Index from '../../../app/index';
import SettingsRoute from '../../../app/settings';
import ShopRoute from '../../../app/shop';
import StatsRoute from '../../../app/stats';
import { at, FRIDAY, clockAt, missionId, newGame, TZ } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  companion: CompanionRoute,
  settings: SettingsRoute,
  shop: ShopRoute,
  stats: StatsRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function open(db: Db, url = '/profile') {
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
    await screen.findByTestId('profile-screen');
  }
}

const text = (id: string) => screen.getByTestId(id).props.children as string;

const setPoints = (db: Db, stat: 'strength' | 'wisdom', points: number) =>
  db.update(heroStats).set({ points }).where(eq(heroStats.statKey, stat)).run();

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

beforeEach(async () => {
  // Jest starts with a font scale of 2: the layout with very large text.
  await setFontScale(1);
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Profile', () => {
  it('opens from the tab bar with the title of the theme and the hero', async () => {
    await open(newGame(['meditation']), '/today');
    await fireEvent.press(await screen.findByTestId('tab-profile'));
    expect(await screen.findByTestId('profile-screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Claudio' })).toBeOnTheScreen();
    expect(text('profile-title')).toBe('Principiante');
    expect(text('profile-level')).toBe('Livello 1');
    expect(text('profile-to-next')).toBe('0 di 200 XP al livello 2');
  });

  it('shows title, level and experience of the level reached', async () => {
    const db = newGame(['meditation']);
    db.update(hero).set({ level: 7, xpInLevel: 320, xpTotal: 2420 }).run();
    await open(db);
    expect(text('profile-title')).toBe('Costante');
    expect(text('profile-level')).toBe('Livello 7');
    expect(text('profile-to-next')).toBe('320 di 500 XP al livello 8');
  });

  it('says the highest level instead of the XP to the next one', async () => {
    const db = newGame(['meditation']);
    db.update(hero).set({ level: 50, xpInLevel: 0 }).run();
    await open(db);
    expect(text('profile-title')).toBe('Leggenda');
    expect(text('profile-to-next')).toBe('Livello massimo raggiunto');
    expect(screen.queryByTestId('profile-xp')).toBeNull();
  });

  it('shows streak, missions completed and bosses defeated', async () => {
    const db = newGame(['meditation']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      now: at(FRIDAY, 10),
      tzOffset: TZ,
    });
    db.update(hero).set({ streak: 12 }).run();
    await open(db);
    expect(text('profile-number-streak-value')).toBe('12');
    expect(text('profile-number-missions-value')).toBe('1');
    expect(text('profile-number-bosses-value')).toBe('0');
    expect(screen.getByLabelText('Obiettivi raggiunti: 0')).toBeOnTheScreen();
  });

  it('shows the six stats at 0 with the starting phrase, and Max at level 10', async () => {
    const db = newGame(['meditation']);
    setPoints(db, 'strength', 1340);
    setPoints(db, 'wisdom', 5500);
    await open(db);
    expect(text('profile-stat-intelligence-level')).toBe('Lv 0');
    expect(screen.getByTestId('profile-stat-intelligence-empty')).toHaveTextContent(
      'Completa missioni di questo tipo',
    );
    expect(text('profile-stat-strength-level')).toBe('Lv 4');
    expect(screen.queryByTestId('profile-stat-strength-empty')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Movimento, livello 4, 340 punti su 500' }),
    ).toBeOnTheScreen();
    expect(text('profile-stat-wisdom-level')).toBe('Max');
    expect(
      screen.getByRole('button', { name: 'Equilibrio, livello massimo, 5500 punti' }),
    ).toBeOnTheScreen();
  });

  it('opens the detail of a stat with points, latest gains and missions', async () => {
    const db = newGame(['meditation', 'journal', 'run']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      now: at(FRIDAY, 10),
      tzOffset: TZ,
    });
    await open(db);
    await fireEvent.press(screen.getByTestId('profile-stat-wisdom'));
    expect(await screen.findByTestId('profile-stat-sheet')).toBeOnTheScreen();
    expect(text('profile-stat-sheet-title')).toBe('Equilibrio · Lv 0');
    expect(text('profile-stat-sheet-left')).toBe('Mancano 80 punti al livello 1');
    const name = db
      .select()
      .from(missions)
      .where(eq(missions.id, missionId(db, 'meditation')))
      .get()?.name;
    expect(screen.getByTestId('profile-stat-gain-0')).toHaveTextContent(`+20 ${name}, oggi`);
    for (const key of ['meditation', 'journal']) {
      expect(screen.getByTestId(`profile-stat-mission-${missionId(db, key)}`)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId(`profile-stat-mission-${missionId(db, 'run')}`)).toBeNull();
  });

  it('says when a stat has no gains and no missions', async () => {
    await open(newGame(['meditation']));
    await fireEvent.press(screen.getByTestId('profile-stat-charisma'));
    expect(await screen.findByTestId('profile-stat-sheet-no-gains')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-stat-sheet-no-missions')).toBeOnTheScreen();
  });

  it('renames the hero with the event, and keeps the name when the field is empty', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await fireEvent.press(screen.getByTestId('profile-rename'));
    const input = screen.getByTestId('profile-name-input');
    expect(input.props.maxLength).toBe(PROFILE.nameMaxLength);
    await fireEvent.changeText(input, 'Aria la Costante');
    await fireEvent(input, 'submitEditing');

    expect(await screen.findByRole('header', { name: 'Aria la Costante' })).toBeOnTheScreen();
    expect(db.select().from(hero).get()?.name).toBe('Aria la Costante');
    const renamed = db.select().from(events).where(eq(events.type, 'hero.renamed')).all();
    expect(renamed.map((row) => row.payload)).toEqual([
      { from: 'Claudio', to: 'Aria la Costante' },
    ]);

    await fireEvent.press(screen.getByTestId('profile-rename'));
    await fireEvent.changeText(screen.getByTestId('profile-name-input'), '   ');
    await fireEvent(screen.getByTestId('profile-name-input'), 'submitEditing');
    expect(await screen.findByRole('header', { name: 'Aria la Costante' })).toBeOnTheScreen();
    expect(db.select().from(events).where(eq(events.type, 'hero.renamed')).all()).toHaveLength(1);
  });

  it('shows the companion with its stage and the coins on the links', async () => {
    await open(newGame(['meditation']));
    expect(screen.getByRole('button', { name: 'Cloudy, uovo' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Negozio e inventario, 0 monete' }),
    ).toBeOnTheScreen();
    expect(text('profile-link-trophies-value')).toBe('0');
  });

  it.each([
    ['profile-link-stats', 'stats-screen'],
    ['profile-link-companion', 'companion-screen'],
    ['profile-link-shop', 'shop-screen'],
  ])('opens the screen of %s', async (link, target) => {
    await open(newGame(['meditation']));
    await fireEvent.press(screen.getByTestId(link));
    expect(await screen.findByTestId(target)).toBeOnTheScreen();
  });

  it.each(['profile-settings', 'profile-link-settings'])(
    'opens Settings from %s',
    async (button) => {
      await open(newGame(['meditation']));
      await fireEvent.press(screen.getByTestId(button));
      expect(await screen.findByText('Questa schermata arriverà presto.')).toBeOnTheScreen();
    },
  );

  it('says that the Hall of trophies is coming', async () => {
    await open(newGame(['meditation']));
    await fireEvent.press(screen.getByTestId('profile-link-trophies'));
    expect(await screen.findByText('Traguardi arriverà presto.')).toBeOnTheScreen();
  });

  it('puts the character sheet on one column with very large text', async () => {
    await setFontScale(1.3);
    await open(newGame(['meditation']));
    const tile = StyleSheet.flatten(screen.getByTestId('profile-stat-strength').props.style);
    expect(tile.flexBasis).toBe('100%');

    await setFontScale(1);
    const half = StyleSheet.flatten(screen.getByTestId('profile-stat-strength').props.style);
    expect(half.flexBasis).toBe('45%');
  });

  it('keeps the missions of other stats out of the detail', async () => {
    const db = newGame(['meditation', 'run']);
    db.update(missions)
      .set({ statSecondary: 'wisdom' })
      .where(eq(missions.id, missionId(db, 'run')))
      .run();
    await open(db);
    await fireEvent.press(screen.getByTestId('profile-stat-wisdom'));
    expect(
      await screen.findByTestId(`profile-stat-mission-${missionId(db, 'run')}`),
    ).toBeOnTheScreen();
  });
});
