import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { missionReminders, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useHighlightStore } from '@/stores/highlight';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Editor from '../../../app/editor';
import Index from '../../../app/index';
import Stats from '../../../app/stats';
import { FRIDAY, clockAt, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  editor: Editor,
  stats: Stats,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function openEditor(db: Db) {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
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
    { initialUrl: '/' },
  );
  await screen.findByTestId('today-screen');
  await fireEvent.press(screen.getByTestId('tab-new'));
  await screen.findByTestId('editor');
}

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

const created = (db: Db, name: string) =>
  db.select().from(missions).where(eq(missions.name, name)).get();

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
  useHighlightStore.getState().clear();
});

afterEach(async () => {
  await setFontScale(1);
});

describe('Mission editor: basic fields', () => {
  it('saves a daily medium habit with only the name and Enter, and highlights it in Today', async () => {
    const db = newGame(['journal']);
    await openEditor(db);

    expect(screen.getByRole('header', { name: 'Nuova abitudine' })).toBeOnTheScreen();
    expect(screen.getByTestId('editor-save')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Leggi 20 pagine');
    await fireEvent(screen.getByTestId('editor-name'), 'submitEditing');

    const mission = created(db, 'Leggi 20 pagine');
    expect(mission).toMatchObject({
      kind: 'habit',
      difficulty: 'medium',
      frequency: { type: 'daily' },
      statPrimary: null,
      goalType: 'none',
    });
    expect(
      db.select().from(missionReminders).where(eq(missionReminders.missionId, mission!.id)).all(),
    ).toEqual([]);
    await screen.findByTestId('today-screen');
    expect(screen.getByTestId(`today-mission-${mission!.id}-highlight`)).toBeTruthy();
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Missione creata/);
  });

  it('deletes the mission just created with «Annulla»', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Corsa');
    await fireEvent.press(screen.getByTestId('editor-save'));
    const id = created(db, 'Corsa')!.id;
    await screen.findByTestId('today-screen');

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(created(db, 'Corsa')?.deletedAt).not.toBeNull();
    expect(screen.queryByTestId(`today-mission-${id}`)).toBeNull();
  });

  it('saves a single task with the chosen difficulty and stat', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Chiama il dentista');
    await fireEvent.press(screen.getByTestId('editor-kind-task'));
    expect(screen.getByRole('header', { name: 'Nuova attività' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('editor-difficulty-easy'));
    await fireEvent.press(screen.getByTestId('editor-stat-charisma'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    expect(created(db, 'Chiama il dentista')).toMatchObject({
      kind: 'task',
      difficulty: 'easy',
      frequency: null,
      dueDay: null,
      statPrimary: 'charisma',
    });
  });

  it('changes the preview of the rewards with difficulty and stat', async () => {
    await openEditor(newGame(['journal']));

    expect(screen.getByTestId('editor-reward')).toHaveTextContent('+25 XP · +5 Monete');
    expect(screen.getByTestId('editor-stat-missing')).toHaveTextContent(
      "Scegli una statistica: senza, questa missione non fa crescere l'eroe",
    );
    expect(
      screen.getByRole('radio', { name: 'Media, 25 XP, 2 di 3', checked: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('editor-difficulty-hard'));
    expect(screen.getByTestId('editor-reward')).toHaveTextContent('+50 XP · +10 Monete');

    await fireEvent.press(screen.getByTestId('editor-stat-intelligence'));
    expect(screen.getByTestId('editor-reward')).toHaveTextContent(
      '+50 XP · +10 Monete · +30 Mente',
    );
    expect(screen.queryByTestId('editor-stat-missing')).toBeNull();
    expect(screen.getByText('Statistica principale · Mente')).toBeOnTheScreen();
  });

  it('warns about a name already used without blocking, and counts a long name', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    const journal = db.select().from(missions).get()!.name;

    await fireEvent.changeText(screen.getByTestId('editor-name'), ` ${journal.toUpperCase()} `);
    expect(screen.getByTestId('editor-name-taken')).toBeOnTheScreen();
    expect(screen.getByTestId('editor-save')).toBeEnabled();

    await fireEvent.changeText(screen.getByTestId('editor-name'), 'x'.repeat(61));
    expect(screen.queryByTestId('editor-name-taken')).toBeNull();
    expect(screen.getByTestId('editor-name-count')).toHaveTextContent('61 caratteri');
  });

  it('puts the difficulty buttons one under the other with very large text', async () => {
    await setFontScale(1.3);
    await openEditor(newGame(['journal']));

    expect(screen.getByTestId('editor-difficulty')).not.toHaveStyle({ flexDirection: 'row' });

    await setFontScale(1);
    expect(screen.getByTestId('editor-difficulty')).toHaveStyle({ flexDirection: 'row' });
  });
});
