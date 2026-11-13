import { asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { completeBossStep, createBoss, type NewBoss } from '@/db/repositories/boss';
import { boss, bossSteps, hero } from '@/db/schema';
import type { Db } from '@/db/types';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { victoryReward } from '@/rules/boss';
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
import TrophiesRoute from '../../../app/trophies';
import { clockAt, FRIDAY, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'boss/[id]': BossRoute,
  trophies: TrophiesRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const THESIS: NewBoss = { name: 'Tesi', difficulty: 'medium', steps: ['Indice', 'Capitolo'] };

async function open(db: Db, url: string, day = FRIDAY) {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(day, 12) });
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

/** A boss created on `from` and defeated on `to`. */
function defeated(db: Db, name: string, from: number, to: number): string {
  const created = createBoss(db, { ...THESIS, name }, clockAt(from, 10));
  const steps = db
    .select({ id: bossSteps.id })
    .from(bossSteps)
    .where(eq(bossSteps.bossId, created.id))
    .orderBy(asc(bossSteps.position))
    .all();
  for (const step of steps) {
    completeBossStep(db, step.id, clockAt(to, 11));
  }
  return created.id;
}

function bossRow(db: Db, bossId: string) {
  return db.select().from(boss).where(eq(boss.id, bossId)).get();
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

describe('Sala dei trofei', () => {
  it('lists the trophies from the most recent, with date and days, and opens the detail', async () => {
    const db = newGame(['journal']);
    const first = defeated(db, 'Maratona', FRIDAY, FRIDAY + 2);
    const second = defeated(db, 'Libro', FRIDAY, FRIDAY + 5);
    await open(db, '/trophies', FRIDAY + 6);

    expect(await screen.findByText('Traguardi')).toBeOnTheScreen();
    const grid = screen.getByTestId('trophies-grid');
    expect(grid).toHaveTextContent(
      /Libro.*11 novembre · 5 giorni.*Maratona.*8 novembre · 2 giorni/,
    );
    expect(
      screen.getByLabelText('Maratona, sconfitto il 8 novembre in 2 giorni'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(`trophies-grid-${second}`));
    expect(await screen.findByTestId('boss-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('boss-trophy-span')).toHaveTextContent(
      'Dal 6 novembre al 11 novembre · 5 giorni impiegati',
    );
    const reward = victoryReward(2, 'medium');
    expect(screen.getByTestId('boss-trophy-rewards')).toHaveTextContent(
      `Ricompense: +${reward.xp} XP e +${reward.coins} Monete`,
    );
    expect(first).not.toBe(second);
  });

  it('shows an empty pedestal before the first victory', async () => {
    await open(newGame(['journal']), '/trophies');
    expect(await screen.findByTestId('trophies-empty')).toHaveTextContent(
      'Il primo trofeo ti aspetta',
    );
  });

  it('previews the last 3 trophies under the bosses, and «Vedi tutti» opens the Hall', async () => {
    const db = newGame(['journal']);
    await open(db, '/goals');
    expect(await screen.findByTestId('goals-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('goals-trophies')).toBeNull();
    useAppStore.getState().reset();

    const ids = [1, 2, 3, 4].map((index) => defeated(db, `Boss ${index}`, FRIDAY, FRIDAY + index));
    await open(db, '/goals', FRIDAY + 5);
    const preview = await screen.findByTestId('goals-trophies');
    expect(preview).toHaveTextContent(/Boss 4.*Boss 3.*Boss 2/);
    expect(screen.queryByTestId(`goals-trophy-${ids[0]}`)).toBeNull();

    await fireEvent.press(screen.getByTestId('goals-trophies-all'));
    expect(await screen.findByTestId('trophies-screen')).toBeOnTheScreen();
    expect(screen.getByTestId(`trophies-grid-${ids[0]}`)).toBeOnTheScreen();
  });
});

describe('Scadenze', () => {
  it('says «Mancano 3 giorni» in the colour of danger from 3 days before', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, { ...THESIS, deadlineDay: '2026-11-09' }, clockAt(FRIDAY, 10));
    await open(db, '/goals');
    expect(await screen.findByTestId(`goals-boss-${thesis.id}-deadline`)).toHaveTextContent(
      'Mancano 3 giorni',
    );
  });

  it('opens the sheet of the missed deadline once, and sets a new deadline', async () => {
    jest.useFakeTimers();
    const db = newGame(['journal']);
    db.update(hero).set({ coins: 340 }).run();
    const thesis = createBoss(db, { ...THESIS, deadlineDay: '2026-11-07' }, clockAt(FRIDAY, 10));
    completeBossStep(
      db,
      db.select().from(bossSteps).where(eq(bossSteps.bossId, thesis.id)).all()[0].id,
      clockAt(FRIDAY, 11),
    );
    await open(db, '/today', FRIDAY + 2);

    expect(await screen.findByText('Scadenza mancata')).toBeOnTheScreen();
    expect(screen.getByText('«Tesi» è scaduto.')).toBeOnTheScreen();
    expect(screen.getByTestId('missed-deadline-taunt')).toHaveTextContent(
      'Scadenza passata: 34 monete perse',
    );
    expect(screen.getByTestId('missed-deadline-coins')).toHaveTextContent('−34 monete');
    expect(screen.getByTestId('missed-deadline-steps')).toHaveTextContent('Il tuo passo resta.');

    await fireEvent.press(screen.getByTestId('missed-deadline-new'));
    await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
    await fireEvent.press(screen.getByTestId('editor-due-day'));
    await fireEvent.press(screen.getByTestId('editor-due-done'));
    expect(bossRow(db, thesis.id)).toMatchObject({ status: 'active', deadlineDay: '2026-11-08' });
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Scadenza aggiornata');

    // A new start of the app: the sheet does not open again.
    await act(async () => jest.advanceTimersByTime(SHEET_DURATION_MS));
    useAppStore.getState().reset();
    await open(db, '/today', FRIDAY + 2);
    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
    expect(screen.queryByText('Scadenza mancata')).toBeNull();
  });

  it('archives the goal from the sheet', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, { ...THESIS, deadlineDay: '2026-11-07' }, clockAt(FRIDAY, 10));
    await open(db, '/today', FRIDAY + 2);
    expect(await screen.findByTestId('missed-deadline-steps')).toHaveTextContent(
      'Nessun passo va perso.',
    );
    expect(screen.getByTestId('missed-deadline-coins')).toHaveTextContent('−0 monete');

    await fireEvent.press(screen.getByTestId('missed-deadline-archive'));
    expect(bossRow(db, thesis.id)?.status).toBe('archived');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent('Obiettivo archiviato');
  });
});
