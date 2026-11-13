import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { completeMission } from '@/db/repositories/completion';
import { setSetting } from '@/db/repositories/settings';
import { companion, daySummaries, events } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import type { GameDay } from '@/rules/types';
import { runAction, startApp, useAppStore } from '@/stores/app';
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

describe('Companion mood', () => {
  /** A puppy with the closed days of 3, 4 and 5 November, before the Friday of the test. */
  function puppyWith(...days: [scheduled: number, done: number][]) {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'baby', completionsTotal: 20 }).run();
    days.forEach(([scheduledCount, doneCount], index) =>
      db
        .insert(daySummaries)
        .values({
          gameDay: `2026-11-0${3 + index}` as GameDay,
          scheduledCount,
          doneCount,
          scheduledXp: 0,
          missedXp: 0,
          hpLost: 0,
          isRestDay: false,
          fullDay: false,
          planComplete: false,
          shieldUsed: false,
          closedAt: at(4 + index, 6),
        })
        .run(),
    );
    return db;
  }

  it('has no mood card while it is an egg', async () => {
    await open(newGame(['meditation']));
    expect(screen.queryByTestId('companion-mood')).toBeNull();
  });

  it('is happy with the share of the last 3 days', async () => {
    await open(puppyWith([4, 3], [3, 3], [3, 2]));
    expect(text('companion-mood-word')).toBe('Felice');
    expect(text('companion-mood-reason')).toBe(
      'Negli ultimi 3 giorni hai completato 8 abitudini su 10 (80%).',
    );
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Cloudy, cucciolo, felice');
  });

  it('is normal between 30% and 70%', async () => {
    await open(puppyWith([2, 1], [2, 1], [2, 1]));
    expect(text('companion-mood-word')).toBe('Normale');
    expect(text('companion-mood-reason')).toBe(
      'Negli ultimi 3 giorni hai completato 3 abitudini su 6 (50%).',
    );
  });

  it('says nothing was planned when the last 3 days had no missions', async () => {
    await open(puppyWith());
    expect(text('companion-mood-word')).toBe('Normale');
    expect(text('companion-mood-reason')).toBe(
      "Negli ultimi 3 giorni non c'era nulla in programma.",
    );
  });

  it('is sad below 30%, tells how to cheer it up, and is happy again after a completion', async () => {
    const db = puppyWith([3, 0], [3, 1], [3, 0]);
    await open(db);
    expect(text('companion-mood-word')).toBe('Triste');
    expect(text('companion-mood-reason')).toBe(
      'Negli ultimi 3 giorni hai completato 1 abitudine su 9 (11%). ' +
        'Basta un completamento oggi e tornerà felice.',
    );
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Cloudy, cucciolo, triste');

    await act(() =>
      runAction((database, clock) =>
        completeMission(database, {
          missionId: missionId(database, 'meditation'),
          ...clock,
          source: 'app',
        }),
      ),
    );
    expect(text('companion-mood-word')).toBe('Felice');
    expect(text('companion-mood-reason')).toBe(
      'Oggi hai già completato qualcosa: Cloudy è felice. ' +
        'Negli ultimi 3 giorni hai completato 1 abitudine su 9 (11%).',
    );
    expect(screen.getByTestId('companion-pet')).toHaveAccessibleName('Cloudy, cucciolo, felice');
  });
});

describe('Companion evolution', () => {
  it('becomes an adult at 150 completions, with the notice in Today that closes', async () => {
    const db = newGame(['meditation', 'read_pages']);
    db.update(companion).set({ stage: 'baby', completionsTotal: 149 }).run();
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    await open(db, '/today');

    expect(await screen.findByText('Cloudy è diventato adulto.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('today-notice-grown-close'));
    expect(screen.queryByTestId('today-notice-grown')).toBeNull();
  });

  it('shows no notice in Today on the day of the hatching', async () => {
    const db = newGame(['meditation', 'read_pages']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    await open(db, '/today');
    await screen.findByTestId('today-screen');
    expect(screen.queryByTestId('today-notice-grown')).toBeNull();
  });
});
