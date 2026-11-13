import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { BADGE_LIST } from '@/content/badges';
import { completeMission } from '@/db/repositories/completion';
import { hero } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { createI18n } from '@/i18n';
import { BADGES } from '@/rules/config';
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
import BadgesRoute from '../../../app/badges';
import Index from '../../../app/index';
import { clockAt, FRIDAY, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  badges: BadgesRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const TOTAL = BADGE_LIST.length;

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

const text = (id: string) => screen.getByTestId(id).props.children as string;

/** Completes the journal through the actions of the app: the badges follow (runAction). */
async function completeJournal(db: Db) {
  await act(async () => {
    runAction((actionDb, clock) =>
      completeMission(actionDb, {
        missionId: missionId(db, 'journal'),
        source: 'app',
        now: clock.now,
        tzOffset: clock.tzOffset,
      }),
    );
  });
}

beforeEach(async () => {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale: 1 },
      screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
    });
  });
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Badges in the Profile', () => {
  it('shows the counter and the empty row before the first badge', async () => {
    await open(newGame(['journal']), '/profile');
    expect(await screen.findByTestId('profile-screen')).toBeOnTheScreen();
    expect(text('profile-badges-counter')).toBe(`Badge · 0 di ${TOTAL}`);
    expect(screen.getByTestId('profile-badges-none')).toBeOnTheScreen();
  });

  it('unlocks the badges after an action, with their moment and the bonus coins', async () => {
    const db = newGame(['journal']);
    await open(db, '/profile');
    await screen.findByTestId('profile-screen');
    const before = db.select().from(hero).get()?.coins ?? 0;
    await completeJournal(db);
    expect(await screen.findByTestId('moment-badge')).toBeOnTheScreen();
    expect(screen.getByText('Badge sbloccato')).toBeOnTheScreen();
    expect(screen.getByText(`Primo passo · +${BADGES.coins} monete`)).toBeOnTheScreen();
    // The journal gives its own coins, plus three badges: first step, full day, hatching.
    expect(db.select().from(hero).get()?.coins).toBeGreaterThanOrEqual(before + 3 * BADGES.coins);
    expect(text('profile-badges-counter')).toBe(`Badge · 3 di ${TOTAL}`);
    expect(screen.getByTestId('profile-badges-completions_1')).toBeOnTheScreen();
  });

  it('opens the grid from «Vedi tutti»', async () => {
    await open(newGame(['journal']), '/profile');
    await fireEvent.press(await screen.findByTestId('profile-badges-all'));
    expect(await screen.findByTestId('badges-screen')).toBeOnTheScreen();
  });
});

describe('Badges grid', () => {
  it('shows unlocked badges with the date and locked ones with condition and progress', async () => {
    const db = newGame(['journal']);
    db.update(hero).set({ streakBest: 23 }).where(eq(hero.id, 'hero')).run();
    await open(db, '/badges');
    await screen.findByTestId('badges-screen');
    await completeJournal(db);
    expect(screen.getByRole('header', { name: `Badge · 6 di ${TOTAL}` })).toBeOnTheScreen();
    expect(text('badges-grid-streakBest_7-caption')).toBe('6 novembre');
    expect(text('badges-grid-streakBest_30-caption')).toBe('23 di 30');
    expect(
      screen.getByLabelText('Serie di 30, bloccato. Serie: 30 giorni di fila: 23 di 30'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie di 7, sbloccato il 6 novembre')).toBeOnTheScreen();
  });

  it('opens the detail with condition, date and coins, or with the progress', async () => {
    jest.useFakeTimers();
    try {
      const db = newGame(['journal']);
      await open(db, '/badges');
      await screen.findByTestId('badges-screen');
      await completeJournal(db);
      await fireEvent.press(screen.getByTestId('badges-grid-completions_1'));
      await act(async () => {
        jest.advanceTimersByTime(SHEET_DURATION_MS);
      });
      expect(text('badge-sheet-name')).toBe('Primo passo');
      expect(text('badge-sheet-condition')).toBe('Completa 1 abitudine');
      expect(text('badge-sheet-date')).toBe('Sbloccato il 6 novembre');
      expect(text('badge-sheet-coins')).toBe(`+${BADGES.coins} monete bonus`);
      await fireEvent.press(screen.getByTestId('badges-grid-completions_10'));
      await act(async () => {
        jest.advanceTimersByTime(SHEET_DURATION_MS);
      });
      expect(text('badge-sheet-name')).toBe('10 abitudini');
      expect(text('badge-sheet-progress')).toBe('1 di 10');
      expect(screen.queryByTestId('badge-sheet-coins')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
