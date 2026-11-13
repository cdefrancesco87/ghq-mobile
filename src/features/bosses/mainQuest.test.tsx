import { asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { completeBossStep, createBoss, setMainQuest, type NewBoss } from '@/db/repositories/boss';
import { setSetting } from '@/db/repositories/settings';
import { boss, bossSteps } from '@/db/schema';
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
import BossRoute from '../../../app/boss/[id]';
import GoalEditor from '../../../app/goal-editor';
import Index from '../../../app/index';
import { at, clockAt, FRIDAY, newGame, withBadgesUnlocked } from '../../../test/game';

// Main Quest and chains of goals (task T83; design-sezioni.md 5.8).

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'boss/[id]': BossRoute,
  'goal-editor': GoalEditor,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const THESIS: NewBoss = { name: 'Tesi', difficulty: 'medium', steps: ['Indice', 'Capitolo 1'] };

const NOW = clockAt(FRIDAY, 10);

async function open(db: Db, url: string) {
  withBadgesUnlocked(db);
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

/** «Altro», then an item of the menu once the menu has slid away. */
async function fromMenu(item: string) {
  await fireEvent.press(screen.getByTestId('boss-more'));
  await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
  await fireEvent.press(screen.getByTestId(`boss-menu-${item}`));
  await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
}

function bossRow(db: Db, bossId: string) {
  return db.select().from(boss).where(eq(boss.id, bossId)).get();
}

function stepIds(db: Db, bossId: string): string[] {
  return db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, bossId))
    .orderBy(asc(bossSteps.position))
    .all()
    .map((row) => row.id);
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

describe('Main Quest', () => {
  it('is pinned from «Altro» with a crown, and taken away the same way', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await open(db, `/boss/${thesis.id}`);
    expect(screen.queryByTestId('boss-crown')).toBeNull();

    await fromMenu('main');
    expect(bossRow(db, thesis.id)?.isMain).toBe(true);
    expect(screen.getByTestId('boss-crown')).toBeOnTheScreen();
    expect(screen.getByLabelText('Main Quest')).toBeOnTheScreen();
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('«Tesi» è la Main Quest');

    await fireEvent.press(screen.getByTestId('boss-more'));
    expect(screen.getByTestId('boss-menu-main')).toHaveTextContent('Togli dalla Main Quest');
    await fireEvent.press(screen.getByTestId('boss-menu-main'));
    expect(bossRow(db, thesis.id)?.isMain).toBe(false);
  });

  it('shows the Main Quest at the top of Today with its crown, out of the other bosses', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    setMainQuest(db, thesis.id, true, NOW);
    await open(db, '/today');

    expect(await screen.findByTestId('today-main-quest')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Main Quest' })).toBeOnTheScreen();
    expect(
      screen.getByTestId(`today-main-${thesis.id}-crown`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(`today-boss-${move.id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`today-boss-${thesis.id}`)).toBeNull();

    // Its next step is done from Today too.
    await fireEvent.press(screen.getByTestId(`today-main-${thesis.id}-step`));
    expect(
      db.select().from(bossSteps).where(eq(bossSteps.bossId, thesis.id)).all()[0].doneAt,
    ).not.toBeNull();
  });

  it('is not in Today in the Essential mode', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    setMainQuest(db, thesis.id, true, NOW);
    setSetting(db, 'game_mode', 'essential', at(FRIDAY, 9));
    await open(db, '/today');
    await screen.findByTestId('today-screen');
    expect(screen.queryByTestId('today-main-quest')).toBeNull();
  });
});

describe('Catene di obiettivi', () => {
  it('creates the next boss from «Altro», locked under the first one with a line and a padlock', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    createBoss(db, { ...THESIS, name: 'Trasloco' }, NOW);
    await open(db, `/boss/${thesis.id}`);

    await fromMenu('chain');
    expect(await screen.findByTestId('goal-editor-after')).toHaveTextContent(
      'Dopo «Tesi»: si sblocca alla sua vittoria',
    );
    await fireEvent.changeText(screen.getByTestId('goal-editor-name'), 'Discussione');
    for (const title of ['Slide', 'Prova']) {
      await fireEvent.changeText(screen.getByTestId('goal-editor-new-step'), title);
      await fireEvent(screen.getByTestId('goal-editor-new-step'), 'submitEditing');
    }
    // 3 active bosses already, the starter quest included: the next one of a chain still fits.
    await fireEvent.press(screen.getByTestId('goal-editor-save'));
    expect(await screen.findByTestId('boss-screen')).toBeOnTheScreen();
    const next = db.select().from(boss).where(eq(boss.name, 'Discussione')).get();
    expect(next).toMatchObject({ status: 'locked', chainPrevId: thesis.id });
    expect(screen.getByTestId('boss-chain-next')).toHaveTextContent('Poi «Discussione»');

    await fireEvent.press(screen.getByTestId('boss-chain-next'));
    expect(await screen.findByTestId('boss-locked')).toHaveTextContent(
      'Bloccato · Si sblocca sconfiggendo «Tesi»',
    );
    expect(screen.getByTestId('boss-chain-prev')).toHaveTextContent('Viene dopo «Tesi»');
    expect(screen.queryByTestId('boss-step-0-control')).toBeNull();
    await fireEvent.press(screen.getByTestId('boss-more'));
    expect(screen.getByTestId('boss-menu-edit')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-menu-delete')).toBeOnTheScreen();
    expect(screen.queryByTestId('boss-menu-archive')).toBeNull();
    expect(screen.queryByTestId('boss-menu-main')).toBeNull();
  });

  it('draws the chain in Obiettivi and unlocks the next boss at the victory', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const next = createBoss(db, { ...THESIS, name: 'Discussione', chainPrevId: thesis.id }, NOW);
    await open(db, '/goals');

    await screen.findByTestId('goals-screen');
    expect(screen.getByTestId('goals-header')).toHaveTextContent(/2 di 3 attivi/);
    expect(screen.getByTestId(`goals-chain-line-${next.id}`)).toBeOnTheScreen();
    expect(
      screen.getByTestId(`goals-boss-${next.id}-locked`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(`goals-boss-${next.id}-locked-note`)).toHaveTextContent(
      'Si sblocca sconfiggendo «Tesi»',
    );
    expect(screen.queryByTestId(`goals-boss-${next.id}-step`)).toBeNull();

    await act(async () => {
      for (const id of stepIds(db, thesis.id)) {
        completeBossStep(db, id, NOW);
      }
    });
    expect(bossRow(db, next.id)?.status).toBe('active');
  });
});
