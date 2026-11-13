import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { completeMission } from '@/db/repositories/completion';
import { setSetting } from '@/db/repositories/settings';
import { companion, events } from '@/db/schema';
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
import CompanionRoute from '../../../app/companion';
import Index from '../../../app/index';
import { at, clockAt, FRIDAY, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  companion: CompanionRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function open(db: Db, url = '/companion') {
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
  if (url === '/companion') {
    await screen.findByTestId('companion-screen');
  }
}

const HIDDEN = { includeHiddenElements: true };

const text = (id: string) => screen.getByTestId(id).props.children as string;

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Companion sheet', () => {
  it('opens from the companion in Today and goes back', async () => {
    await open(newGame(['meditation']), '/today');
    await fireEvent.press(await screen.findByTestId('today-hero-companion'));
    expect(await screen.findByTestId('companion-screen')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('companion-back'));
    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
  });

  it('shows the egg waiting for the first completion, in the habitat of the theme', async () => {
    await open(newGame(['meditation']));

    expect(screen.getByRole('header', { name: 'Cloudy' })).toBeOnTheScreen();
    expect(text('companion-stage')).toBe('Uovo · stadio 1 di 3');
    expect(screen.getByText('Schiusa')).toBeOnTheScreen();
    expect(text('companion-growth-count')).toBe('0 di 1 abitudine');
    expect(text('companion-growth-hint')).toBe('Si schiude al primo completamento.');
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Cloudy, uovo');
    expect(screen.getByTestId('companion-habitat')).toBeOnTheScreen();
    // Minimal draws its habitat in SVG; the pixel themes in a PNG. The drawing is not read.
    expect(screen.queryByTestId('companion-habitat-image', HIDDEN)).toBeNull();
  });

  it('shows the puppy with its growth towards the adult stage', async () => {
    const db = newGame(['meditation']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    await open(db);

    expect(text('companion-stage')).toBe('Cucciolo · stadio 2 di 3');
    expect(screen.getByText('Crescita')).toBeOnTheScreen();
    expect(text('companion-growth-count')).toBe('1 di 150 abitudini');
    expect(text('companion-growth-hint')).toBe('Ancora 149 abitudini per diventare adulto.');
    expect(screen.getByTestId('companion-growth-bar')).toHaveAccessibilityValue({
      min: 0,
      max: 150,
      now: 1,
    });
    // Happy: a mission was completed today.
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Cloudy, cucciolo, felice');
  });

  it('shows the adult fully grown', async () => {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'adult', completionsTotal: 160 }).run();
    await open(db);

    expect(text('companion-stage')).toBe('Adulto · stadio 3 di 3');
    expect(text('companion-growth-count')).toBe('160 abitudini');
    expect(text('companion-growth-hint')).toBe("Cloudy ha raggiunto l'ultimo stadio.");
    expect(screen.getByTestId('companion-growth-bar')).toHaveAccessibilityValue({
      min: 0,
      max: 160,
      now: 160,
    });
  });

  it('renames the companion with the pencil and Invio, and logs it', async () => {
    const db = newGame(['meditation']);
    await open(db);

    await fireEvent.press(screen.getByTestId('companion-rename'));
    const input = screen.getByTestId('companion-name-input');
    expect(input.props.value).toBe('Cloudy');
    expect(input.props.maxLength).toBe(20);
    expect(screen.getByText('Fino a 20 caratteri')).toBeOnTheScreen();
    await fireEvent.changeText(input, ' Fiocco ');
    await fireEvent(input, 'submitEditing');

    expect(await screen.findByRole('header', { name: 'Fiocco' })).toBeOnTheScreen();
    expect(screen.queryByTestId('companion-name-input')).toBeNull();
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Fiocco, uovo');
    expect(db.select().from(companion).get()?.name).toBe('Fiocco');
    const renamed = db.select().from(events).where(eq(events.type, 'companion.renamed')).all();
    expect(renamed.map((event) => event.payload)).toEqual([{ from: null, to: 'Fiocco' }]);
  });

  it('keeps following the theme while the name is the default one', async () => {
    const db = newGame(['meditation']);
    await open(db);

    // Confirming the default name stores nothing: it stays the default of the theme.
    await fireEvent.press(screen.getByTestId('companion-rename'));
    await fireEvent(screen.getByTestId('companion-name-input'), 'submitEditing');
    expect(db.select().from(companion).get()?.name).toBeNull();

    await act(() => useThemeStore.getState().setTheme('arcade'));
    expect(await screen.findByRole('header', { name: 'Pixel' })).toBeOnTheScreen();
    expect(screen.getByTestId('companion-habitat-image', HIDDEN)).toBeOnTheScreen();
  });

  it('keeps the name chosen by the user when the theme changes', async () => {
    const db = newGame(['meditation']);
    db.update(companion).set({ name: 'Fiocco' }).run();
    setSetting(db, 'theme', 'fantasy', at(FRIDAY, 9));
    await open(db);

    expect(screen.getByRole('header', { name: 'Fiocco' })).toBeOnTheScreen();
    await act(() => useThemeStore.getState().setTheme('lovecraft'));
    expect(await screen.findByRole('header', { name: 'Fiocco' })).toBeOnTheScreen();
  });

  it('reacts to a touch with a bubble that changes phrase and closes with a touch', async () => {
    const db = newGame(['meditation']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    await open(db);
    expect(screen.queryByTestId('companion-bubble')).toBeNull();

    await fireEvent.press(screen.getByTestId('companion-pet'));
    expect(screen.getByTestId('companion-bubble')).toHaveAccessibleName(
      'Cloudy dice: Che bella giornata insieme!',
    );
    await fireEvent.press(screen.getByTestId('companion-pet'));
    expect(screen.getByText('Mi piace stare con te, Claudio!')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('companion-bubble'));
    expect(screen.queryByTestId('companion-bubble')).toBeNull();
  });
});
