import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createBoss } from '@/db/repositories/boss';
import { getGeneralPause, startPause } from '@/db/repositories/pause';
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
import Index from '../../../app/index';
import { FRIDAY, clockAt, newGame, withBadgesUnlocked } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const SUNDAY = FRIDAY + 2;

async function openToday(db: Db, day = FRIDAY) {
  withBadgesUnlocked(db);
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(day, 10) });
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
}

const THESIS = {
  name: 'Tesi',
  difficulty: 'medium',
  deadlineDay: '2026-11-20',
  steps: ['Indice', 'Capitolo'],
} as const;

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Today: general pause (design 2.8)', () => {
  it('shows the band with the last day and «Riprendi», and the deadline of the boss on hold', async () => {
    const db = newGame(['meditation']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 8));
    startPause(db, { fromDay: '2026-11-06', untilDay: '2026-11-20' }, clockAt(FRIDAY, 9));
    await openToday(db);

    const band = screen.getByTestId('today-pause-banner');
    expect(band).toHaveTextContent(/In pausa fino al 20 novembre · La vita è al sicuro/);
    expect(
      within(band).getByRole('button', { name: 'Riprendi: la pausa finisce oggi' }),
    ).toBeOnTheScreen();
    // No close button: the band stays.
    expect(within(band).queryByLabelText('Chiudi')).toBeNull();
    expect(screen.getByTestId(`today-boss-${thesis.id}-deadline`)).toHaveTextContent(
      'Scadenza ferma',
    );
    // The missions stay visible (the test database keeps the template keys as names).
    expect(screen.getByTestId('today-scroll')).toHaveTextContent(/templates.meditation.name/);
  });

  it('shows the band without an end date', async () => {
    const db = newGame(['meditation']);
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 9));
    await openToday(db);

    expect(screen.getByTestId('today-pause-banner')).toHaveTextContent(
      /^In pausa · La vita è al sicuro/,
    );
  });

  it('shows nothing for a pause that starts later', async () => {
    const db = newGame(['meditation']);
    startPause(db, { fromDay: '2026-11-08', untilDay: null }, clockAt(FRIDAY, 9));
    await openToday(db);

    expect(screen.queryByTestId('today-pause-banner')).toBeNull();
    expect(screen.queryByTestId('today-pause-last-day')).toBeNull();
  });

  it('asks before «Riprendi», says by how many days the deadlines move, then «Si riparte domani»', async () => {
    const db = newGame(['meditation']);
    createBoss(db, THESIS, clockAt(FRIDAY, 8));
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 9));
    await openToday(db, SUNDAY);

    await fireEvent.press(screen.getByTestId('today-pause-resume'));
    const dialog = screen.getByTestId('today-pause-dialog');
    expect(dialog).toHaveTextContent(
      /La pausa finisce oggi\. Da domani le missioni tornano a contare\. Le scadenze dei boss sono spostate di 3 giorni\./,
    );
    // «Annulla» leaves the pause as it is.
    await fireEvent.press(screen.getByTestId('today-pause-dialog-cancel'));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: null });

    await fireEvent.press(screen.getByTestId('today-pause-resume'));
    await fireEvent.press(screen.getByTestId('today-pause-dialog-confirm'));
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: '2026-11-08' });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Pausa finita: si riparte domani',
    );
    expect(screen.queryByTestId('today-pause-banner')).toBeNull();
    const lastDay = screen.getByTestId('today-pause-last-day');
    expect(lastDay).toHaveTextContent(/Si riparte domani/);
    await fireEvent.press(screen.getByTestId('today-pause-last-day-close'));
    expect(screen.queryByTestId('today-pause-last-day')).toBeNull();
  });

  it('leaves the bosses out of the dialog when no deadline is on hold', async () => {
    const db = newGame(['meditation']);
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent.press(screen.getByTestId('today-pause-resume'));
    expect(screen.getByTestId('today-pause-dialog')).not.toHaveTextContent(/scadenze/);
  });
});
