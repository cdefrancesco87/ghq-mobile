import { asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { archiveBoss, createBoss, type NewBoss } from '@/db/repositories/boss';
import { setSetting } from '@/db/repositories/settings';
import { boss, bossSteps, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
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
import Editor from '../../../app/editor';
import GoalEditor from '../../../app/goal-editor';
import GoalsArchived from '../../../app/goals-archived';
import Index from '../../../app/index';
import { at, clockAt, FRIDAY, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  editor: Editor,
  'goal-editor': GoalEditor,
  'goals-archived': GoalsArchived,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const THESIS: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  steps: ['Indice', 'Capitolo 1', 'Capitolo 2'],
};

const NOW = clockAt(FRIDAY, 10);
/** Typing 20 steps one by one renders the whole creation 40 times. */
const SLOW_MS = 30_000;

async function openGoals(db: Db) {
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
    { initialUrl: '/goals' },
  );
}

function bosses(db: Db) {
  return db.select().from(boss).where(eq(boss.status, 'active')).orderBy(asc(boss.createdAt)).all();
}

function stepTitles(db: Db, bossId: string): string[] {
  return db
    .select({ title: bossSteps.title })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all()
    .map((row) => row.title);
}

async function addSteps(titles: readonly string[]) {
  for (const title of titles) {
    await fireEvent.changeText(screen.getByTestId('goal-editor-new-step'), title);
    await fireEvent(screen.getByTestId('goal-editor-new-step'), 'submitEditing');
  }
}

async function openEditor(db: Db) {
  await openGoals(db);
  await fireEvent.press(await screen.findByTestId('goals-new'));
  await screen.findByTestId('goal-editor');
}

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Obiettivi', () => {
  it('shows the active bosses, the count and the free places', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await openGoals(db);

    expect(await screen.findByRole('header', { name: 'Grandi obiettivi' })).toBeOnTheScreen();
    expect(screen.getByText('2 di 3 attivi')).toBeOnTheScreen();
    const card = `goals-boss-${thesis.id}`;
    expect(screen.getByTestId(`${card}-name`)).toHaveTextContent('Tesi');
    expect(screen.getByTestId(`${card}-next`)).toHaveTextContent('Indice');
    // Minimal: a large ring with the share of the hit points taken instead of the creature.
    expect(screen.getByTestId(`${card}-ring`)).toHaveTextContent('0%');
    expect(
      screen.getByLabelText('Tesi, difficoltà Media, vita 60 su 60, passi 0 di 3'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('goals-slot-0')).toBeOnTheScreen();
    expect(screen.queryByTestId('goals-slot-1')).toBeNull();
    expect(screen.queryByTestId('goals-full')).toBeNull();
  });

  it('completes the next step from the card', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await openGoals(db);
    const card = `goals-boss-${thesis.id}`;

    await fireEvent.press(await screen.findByTestId(`${card}-step`));

    // The number beside the bar is only drawn: the notice says the damage aloud.
    expect(screen.getByTestId(`${card}-damage`, { includeHiddenElements: true })).toHaveTextContent(
      '−20',
    );
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Passo fatto/);
    expect(screen.getByTestId(`${card}-next`)).toHaveTextContent('Capitolo 1');
    expect(screen.getByTestId(`${card}-ring`)).toHaveTextContent('33%');
    expect(bosses(db).find((item) => item.id === thesis.id)?.hp).toBe(40);
  });

  it('keeps «Nuovo» with 3 bosses and explains the limit instead of opening the creation', async () => {
    const db = newGame(['journal']);
    createBoss(db, THESIS, NOW);
    createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    await openGoals(db);

    expect(await screen.findByText('3 di 3 attivi')).toBeOnTheScreen();
    expect(screen.queryByTestId('goals-slot-0')).toBeNull();
    expect(screen.getByTestId('goals-full')).toHaveTextContent(
      'Massimo 3 grandi obiettivi: completane uno o archivialo',
    );
    await fireEvent.press(screen.getByTestId('goals-new'));

    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Massimo 3 grandi obiettivi/);
    expect(screen.queryByTestId('goal-editor')).toBeNull();
  });

  it('shows the theme in the title and in the steps', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'theme', 'arcade', at(FRIDAY, 9));
    const thesis = createBoss(db, THESIS, NOW);
    await openGoals(db);

    expect(await screen.findByRole('header', { name: 'Boss' })).toBeOnTheScreen();
    expect(screen.getByTestId(`goals-boss-${thesis.id}-steps`)).toHaveTextContent('STAGE 0/3');
    expect(screen.getByTestId(`goals-boss-${thesis.id}-sprite`)).toBeOnTheScreen();
  });

  it('lists the archived goals from the menu «Altro», to read only', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    archiveBoss(db, thesis.id, clockAt(FRIDAY, 11));
    await openGoals(db);

    await fireEvent.press(await screen.findByTestId('goals-more'));
    await act(async () => {
      jest.advanceTimersByTime(SHEET_DURATION_MS);
    });
    await fireEvent.press(screen.getByTestId('goals-menu-archived'));

    expect(await screen.findByTestId('goals-archived-screen')).toBeOnTheScreen();
    expect(screen.getByTestId(`goals-archived-${thesis.id}`)).toHaveTextContent(
      /Tesi.*Archiviato il 6 novembre · 0 passi su 3/,
    );
    expect(screen.queryByText('Ripristina')).toBeNull();
  });

  it('opens the creation from a free place', async () => {
    const db = newGame(['journal']);
    await openGoals(db);

    await fireEvent.press(await screen.findByTestId('goals-slot-1'));

    expect(await screen.findByTestId('goal-editor')).toBeOnTheScreen();
  });
});

describe('Creazione del boss', () => {
  it('creates a boss with 2 steps and shows its hit points and reward', async () => {
    const db = newGame(['journal']);
    await openEditor(db);

    await fireEvent.changeText(screen.getByTestId('goal-editor-name'), '  Maratona ');
    await addSteps(['Iscrizione']);
    expect(screen.getByTestId('goal-editor-steps-count')).toHaveTextContent('Passi · 1 di 20');
    expect(screen.getByTestId('goal-editor-save')).toBeDisabled();
    expect(screen.getByTestId('goal-editor-preview')).toHaveTextContent('Servono almeno 2 passi');

    await addSteps(['Corsa 10 km']);
    expect(screen.getByTestId('goal-editor-preview')).toHaveTextContent(
      'Vita 40 · Ricompensa 30 XP e 6 Monete',
    );
    await fireEvent.press(screen.getByTestId('goal-editor-difficulty-hard'));
    expect(screen.getByTestId('goal-editor-preview')).toHaveTextContent(
      'Vita 40 · Ricompensa 40 XP e 8 Monete',
    );
    expect(screen.getByLabelText(/^Difficile, ricompensa ×2, 3 di 3$/)).toBeOnTheScreen();
    expect(screen.getByTestId('goal-editor-difficulty-medium')).toHaveTextContent('Media×1,5');
    await fireEvent.press(screen.getByTestId('goal-editor-stat-strength'));
    await fireEvent.press(screen.getByTestId('goal-editor-save'));

    const created = bosses(db).find((item) => item.kind === 'normal');
    expect(created).toMatchObject({
      name: 'Maratona',
      difficulty: 'hard',
      statKey: 'strength',
      hpMax: 40,
      deadlineDay: null,
    });
    expect(stepTitles(db, created?.id ?? '')).toEqual(['Iscrizione', 'Corsa 10 km']);
    expect(await screen.findByTestId(`goals-boss-${created?.id}`)).toBeOnTheScreen();
  });

  it(
    'takes up to 20 steps and no more',
    async () => {
      const db = newGame(['journal']);
      await openEditor(db);

      await fireEvent.changeText(screen.getByTestId('goal-editor-name'), 'Libri');
      await addSteps(Array.from({ length: 20 }, (_, index) => `Libro ${index + 1}`));

      expect(screen.getByTestId('goal-editor-steps-count')).toHaveTextContent('Passi · 20 di 20');
      expect(screen.queryByTestId('goal-editor-new-step')).toBeNull();
      expect(screen.getByTestId('goal-editor-steps-full')).toHaveTextContent(
        'Hai raggiunto il massimo di 20 passi',
      );
      expect(screen.getByTestId('goal-editor-preview')).toHaveTextContent(
        'Vita 400 · Ricompensa 300 XP e 60 Monete',
      );
      await fireEvent.press(screen.getByTestId('goal-editor-save'));

      const created = bosses(db).find((item) => item.name === 'Libri');
      expect(stepTitles(db, created?.id ?? '')).toHaveLength(20);
    },
    SLOW_MS,
  );

  it('moves and removes steps before saving', async () => {
    const db = newGame(['journal']);
    await openEditor(db);

    await fireEvent.changeText(screen.getByTestId('goal-editor-name'), 'Trasloco');
    await addSteps(['Scatole', 'Furgone', 'Pulizie']);
    await fireEvent.press(screen.getByTestId('goal-editor-step-1-up'));
    await fireEvent.press(screen.getByTestId('goal-editor-step-2-remove'));
    expect(screen.getByTestId('goal-editor-step-0-up')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('goal-editor-save'));

    const created = bosses(db).find((item) => item.name === 'Trasloco');
    expect(stepTitles(db, created?.id ?? '')).toEqual(['Furgone', 'Scatole']);
  });

  it('asks before moving a mission linked to another boss', async () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'read_pages');
    const journal = missionId(db, 'journal');
    const thesis = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    await openEditor(db);

    expect(screen.getByTestId(`goal-editor-mission-${journal}`)).toHaveTextContent(/2 danni/);
    expect(screen.getByTestId(`goal-editor-mission-${read}`)).toHaveTextContent(
      /Colpisce già Tesi.*5 danni/,
    );
    await fireEvent.changeText(screen.getByTestId('goal-editor-name'), 'Esame');
    await addSteps(['Capitolo 1', 'Capitolo 2']);
    await fireEvent.press(screen.getByTestId(`goal-editor-mission-${journal}`));
    await fireEvent.press(screen.getByTestId(`goal-editor-mission-${read}`));
    expect(screen.getByTestId('goal-editor-move')).toHaveTextContent(/Ora colpisce Tesi/);
    await fireEvent.press(screen.getByTestId('goal-editor-move-confirm'));
    expect(screen.getByTestId(`goal-editor-mission-${read}`)).toHaveProp('accessibilityState', {
      checked: true,
    });
    await fireEvent.press(screen.getByTestId('goal-editor-save'));

    const created = bosses(db).find((item) => item.name === 'Esame');
    const linkedTo = (id: string) =>
      db.select().from(missions).where(eq(missions.id, id)).get()?.bossId;
    expect(linkedTo(read)).toBe(created?.id);
    expect(linkedTo(journal)).toBe(created?.id);
    expect(linkedTo(read)).not.toBe(thesis.id);
  });

  it('keeps the mission on its boss when the move is cancelled', async () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'read_pages');
    createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    await openEditor(db);

    await fireEvent.press(screen.getByTestId(`goal-editor-mission-${read}`));
    await fireEvent.press(screen.getByTestId('goal-editor-move-cancel'));

    expect(screen.getByTestId(`goal-editor-mission-${read}`)).toHaveProp('accessibilityState', {
      checked: false,
    });
  });

  it('says it failed when a fourth boss is refused', async () => {
    const db = newGame(['journal']);
    createBoss(db, THESIS, NOW);
    await openEditor(db);
    // Another boss arrives while the creation is open: the limit of 3 is reached.
    createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);

    await fireEvent.changeText(screen.getByTestId('goal-editor-name'), 'Maratona');
    await addSteps(['Uno', 'Due']);
    await fireEvent.press(screen.getByTestId('goal-editor-save'));

    expect(screen.getByTestId('goal-editor-error')).toBeOnTheScreen();
    expect(bosses(db)).toHaveLength(3);
  });

  it('uses the button of the theme', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'theme', 'fantasy', at(FRIDAY, 9));
    await openEditor(db);

    expect(screen.getByTestId('goal-editor-save')).toHaveTextContent('Sfida la Nemesi');
  });
});
