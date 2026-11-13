import { and, asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { StyleSheet } from 'react-native';

import { completeBossStep, createBoss, type NewBoss } from '@/db/repositories/boss';
import { completeMission } from '@/db/repositories/completion';
import { loadHero } from '@/db/repositories/hero';
import { setSetting } from '@/db/repositories/settings';
import { boss, bossSteps, events } from '@/db/schema';
import type { Db } from '@/db/types';
import { MOMENT_MAX_MS } from '@/features/shared/MomentQueue';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { starterQuestReward, victoryReward } from '@/rules/boss';
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
import { at, clockAt, expectHeroMatchesLog, FRIDAY, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'boss/[id]': BossRoute,
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

/** Obiettivi, then a touch on the card of the boss. */
async function openBoss(db: Db, bossId: string) {
  await open(db, '/goals');
  await fireEvent.press(await screen.findByTestId(`goals-boss-${bossId}-open`));
  await screen.findByTestId('boss-screen');
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

function bossRow(db: Db, bossId: string) {
  return db.select().from(boss).where(eq(boss.id, bossId)).get();
}

function victoryEvent(db: Db, bossId: string) {
  return db
    .select()
    .from(events)
    .where(and(eq(events.type, 'boss.defeated'), eq(events.bossId, bossId)))
    .get();
}

const styleOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Scheda del boss', () => {
  it('opens from Obiettivi with the arena, the bar, the chips and the steps', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, { ...THESIS, deadlineDay: '2026-11-08' }, NOW);
    completeBossStep(db, stepIds(db, thesis.id)[0]!, clockAt(FRIDAY, 11));
    await openBoss(db, thesis.id);

    expect(screen.getByRole('header', { name: 'Tesi' })).toBeOnTheScreen();
    // Minimal: the large ring with the share of the hit points taken.
    expect(screen.getByTestId('boss-ring', { includeHiddenElements: true })).toHaveTextContent(
      '33%',
    );
    expect(screen.getByLabelText('Vita di Tesi 40 su 60')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-chip-steps')).toHaveTextContent('Passi 1/3');
    // 2 days to the deadline: the colour of danger with the icon (5.6).
    expect(screen.getByTestId('boss-chip-deadline')).toHaveTextContent('2 giorni');
    expect(screen.getByLabelText('difficoltà Media')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-step-0')).toHaveTextContent('Indice6 novembre');
    expect(screen.getByLabelText('Indice, fatto il 6 novembre')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-step-1-next')).toHaveTextContent('Prossimo');
    expect(screen.queryByTestId('boss-step-2-next')).toBeNull();
    expect(screen.getByTestId('boss-step-2-control')).toBeOnTheScreen();
  });

  it('opens also from the card in Today', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await open(db, '/today');

    await fireEvent.press(await screen.findByTestId(`today-boss-${thesis.id}-open`));

    expect(await screen.findByTestId('boss-screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Tesi' })).toBeOnTheScreen();
  });

  it('draws the protected hit points striped, 10 for each step left, with the note', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    completeBossStep(db, stepIds(db, thesis.id)[0]!, clockAt(FRIDAY, 11));
    await openBoss(db, thesis.id);

    // 40 of 60 hit points, 20 of them protected by the 2 steps left.
    expect(styleOf('boss-hp-fill').width).toBe(`${(40 / 60) * 100}%`);
    expect(styleOf('boss-hp-protected').flex).toBeCloseTo(20 / 60);
    expect(screen.getByTestId('boss-protected-note')).toHaveTextContent(
      "Serve l'ultimo passo per il colpo finale.",
    );
  });

  it('completes a step with the damage said aloud, and undoes it', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await openBoss(db, thesis.id);

    await fireEvent.press(screen.getByTestId('boss-step-0-control'));

    expect(bossRow(db, thesis.id)?.hp).toBe(40);
    expect(screen.getByTestId('boss-damage')).toHaveTextContent('−20');
    expect(screen.getByLabelText('20 danni, vita 40 su 60')).toBeOnTheScreen();
    expect(
      screen.getByTestId('boss-step-0-done', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('boss-step-1-next')).toBeOnTheScreen();
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Passo fatto · −20/);

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(bossRow(db, thesis.id)?.hp).toBe(60);
    expect(screen.getByTestId('boss-step-0-control')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-step-0-next')).toBeOnTheScreen();
    expectHeroMatchesLog(db);
  });

  it('completes a step that is not the next one', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await openBoss(db, thesis.id);

    await fireEvent.press(screen.getByTestId('boss-step-2-control'));

    expect(
      screen.getByTestId('boss-step-2-done', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('boss-step-0-next')).toBeOnTheScreen();
    expect(bossRow(db, thesis.id)?.hp).toBe(40);
  });

  it('wins at the last step without «Annulla», with the reward of the boss, and shows the trophy', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    const [first, second] = stepIds(db, thesis.id);
    completeBossStep(db, first!, clockAt(FRIDAY, 11));
    completeBossStep(db, second!, clockAt(FRIDAY, 11));
    const before = loadHero(db);
    await openBoss(db, thesis.id);

    await fireEvent.press(screen.getByTestId('boss-step-2-control'));

    const reward = victoryReward(3, 'medium');
    expect(bossRow(db, thesis.id)?.status).toBe('defeated');
    expect(victoryEvent(db, thesis.id)).toMatchObject({ dXp: reward.xp, dCoins: reward.coins });
    expect(loadHero(db).coins).toBe(before.coins + reward.coins);
    expect(screen.queryByTestId('undo-toast-undo')).toBeNull();
    expect(await screen.findByTestId('moment-boss_defeated')).toBeOnTheScreen();
    expect(screen.getByText('Obiettivo raggiunto')).toBeOnTheScreen();
    await act(async () => jest.advanceTimersByTime(MOMENT_MAX_MS));
    expect(screen.getByText(`+${reward.xp} XP · +${reward.coins} Monete`)).toBeOnTheScreen();
    expectHeroMatchesLog(db);

    await fireEvent.press(screen.getByTestId('moment-trophy'));

    expect(screen.queryByTestId('moment-boss_defeated')).toBeNull();
    expect(screen.getByTestId('boss-status')).toHaveTextContent('Sconfitto il 6 novembre');
    // A victory is never undone (choice 25): the card is only read.
    expect(screen.queryByTestId('boss-more')).toBeNull();
    expect(screen.queryByTestId('boss-step-2-control')).toBeNull();
    expect(screen.queryByTestId('boss-protected-note')).toBeNull();
    // Opened from its own card, the trophy is the same screen: back goes to Obiettivi.
    await fireEvent.press(screen.getByTestId('boss-header-back'));
    expect(await screen.findByTestId('goals-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('boss-screen')).toBeNull();
  });

  it('gives the XP to level 2 and 50 coins for the quest of the first launch', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const quest = db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
    const steps = db
      .select()
      .from(bossSteps)
      .where(eq(bossSteps.bossId, quest.id))
      .orderBy(asc(bossSteps.position))
      .all();
    const left = steps.filter((step) => step.doneAt === null);
    for (const step of left.slice(0, -1)) {
      completeBossStep(db, step.id, clockAt(FRIDAY, 11));
    }
    const reward = starterQuestReward(loadHero(db));
    await openBoss(db, quest.id);

    // No difficulty for the quest of the first launch.
    expect(screen.queryByTestId('boss-chip-difficulty')).toBeNull();
    await fireEvent.press(screen.getByTestId(`boss-step-${steps.length - 1}-control`));

    expect(victoryEvent(db, quest.id)).toMatchObject({ dXp: reward.xp, dCoins: 50 });
    expect(loadHero(db).level).toBe(2);
    // The level comes first, then the victory (A7).
    expect(await screen.findByTestId('moment-level_up')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.getByTestId('moment-boss_defeated')).toBeOnTheScreen();
    await act(async () => jest.advanceTimersByTime(MOMENT_MAX_MS));
    expect(screen.getByText(`+${reward.xp} XP · +50 Monete`)).toBeOnTheScreen();
    expectHeroMatchesLog(db);
  });

  it('lists the linked missions with their damage and the damage they dealt', async () => {
    const db = newGame(['journal', 'read_pages']);
    const read = missionId(db, 'read_pages');
    const thesis = createBoss(db, { ...THESIS, missionIds: [read] }, NOW);
    completeMission(db, { missionId: read, source: 'app', ...clockAt(FRIDAY, 11) });
    await openBoss(db, thesis.id);

    expect(screen.getByTestId(`boss-mission-${read}`)).toHaveTextContent(/5 danni · 5 inflitti$/);
    expect(
      screen.getByLabelText(/5 danni a ogni completamento, 5 inflitti in totale/),
    ).toBeOnTheScreen();
  });

  it('archives the boss from «Altro» after the dialog and goes back to Obiettivi', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, NOW);
    await openBoss(db, thesis.id);

    await fireEvent.press(screen.getByTestId('boss-more'));
    await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
    await fireEvent.press(screen.getByTestId('boss-menu-archive'));
    await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
    expect(screen.getByText('Archiviare «Tesi»?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('boss-archive-dialog-confirm'));

    expect(bossRow(db, thesis.id)?.status).toBe('archived');
    expect(await screen.findByTestId('goals-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId(`goals-boss-${thesis.id}`)).toBeNull();
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Obiettivo archiviato');
  });

  it('shows the arena and the steps in the words of the theme', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'theme', 'arcade', at(FRIDAY, 9));
    const thesis = createBoss(db, THESIS, NOW);
    await openBoss(db, thesis.id);

    expect(screen.getByRole('header', { name: 'Boss' })).toBeOnTheScreen();
    expect(screen.getByTestId('boss-sprite', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('STAGE 0/3')).toBeOnTheScreen();
  });
});
