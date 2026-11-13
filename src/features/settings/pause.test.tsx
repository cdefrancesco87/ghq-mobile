import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { AccessibilityInfo } from 'react-native';

import { createBoss } from '@/db/repositories/boss';
import { getGeneralPause, startPause } from '@/db/repositories/pause';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { onActionDone, startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import SettingsRoute from '../../../app/settings/index';
import { FRIDAY, clockAt, newGame } from '../../../test/game';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'settings/index': SettingsRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
};

/** Every action that went through `runAction`: the notifications are scheduled again after each. */
const actionDone = jest.fn();
let stopListening: () => void = () => undefined;

async function open(db: Db, day = FRIDAY) {
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
    { initialUrl: '/settings' },
  );
  await screen.findByTestId('settings-screen');
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const value = (id: string) => screen.getByTestId(`${id}-value`).props.children as string;

/** The calendar answers like the one of iOS, in the sheet. */
async function pick(day: number) {
  await fireEvent(screen.getByTestId('settings-pause-picker'), 'change', {
    nativeEvent: { timestamp: new Date(2026, 10, day, 12, 0).getTime(), utcOffset: 0 },
  });
}

beforeEach(() => {
  actionDone.mockClear();
  stopListening = onActionDone(actionDone);
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});

afterEach(() => {
  stopListening();
  jest.restoreAllMocks();
});

describe('Settings: general pause (design 10.5)', () => {
  it('is the last row of Giornata, «No» without a pause, with the sheet that explains it', async () => {
    await open(newGame(['meditation']));
    const group = screen.getByTestId('settings-group-day');
    expect(group).toContainElement(screen.getByTestId('settings-pause'));
    expect(value('settings-pause')).toBe('No');
    await press('settings-pause');
    expect(screen.getByTestId('settings-pause-sheet')).toHaveTextContent(
      /promemoria e riepilogo serale tacciono/,
    );
    expect(value('settings-pause-start')).toBe('6 novembre');
    expect(value('settings-pause-end')).toBe('Senza data');
  });

  it('starts today without an end date, with the reminders scheduled again', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-pause');
    await press('settings-pause-confirm');
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: null });
    expect(actionDone).toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Pausa iniziata');
    expect(value('settings-pause')).toBe('Senza data');
  });

  it('starts on a later day until a last day chosen in the calendar', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-pause');
    await press('settings-pause-start');
    await pick(10);
    await press('settings-pause-end');
    // The end starts from the first day, never before it.
    expect(value('settings-pause-end')).toBe('10 novembre');
    await pick(20);
    expect(value('settings-pause-end')).toBe('20 novembre');
    await press('settings-pause-confirm');
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-10', untilDay: '2026-11-20' });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Pausa programmata dal 10 novembre',
    );
    // Before the start the row says when it begins.
    expect(value('settings-pause')).toBe('Dal 10 nov');
    // The screen reader hears the whole month.
    expect(screen.getByLabelText(/^Pausa generale, Dal 10 novembre/)).toBeOnTheScreen();
  });

  it('cancels a scheduled pause before it starts', async () => {
    const db = newGame(['meditation']);
    startPause(db, { fromDay: '2026-11-10', untilDay: null }, clockAt(FRIDAY, 9));
    await open(db);
    await press('settings-pause');
    expect(screen.getByTestId('settings-pause-state')).toHaveTextContent(
      'La pausa inizia il 10 novembre.',
    );
    await press('settings-pause-cancel');
    expect(getGeneralPause(db)).toBeNull();
    expect(value('settings-pause')).toBe('No');
  });

  it('changes the end during the pause with «Cambia»', async () => {
    const db = newGame(['meditation']);
    startPause(db, { fromDay: '2026-11-06', untilDay: '2026-11-20' }, clockAt(FRIDAY, 9));
    await open(db);
    expect(value('settings-pause')).toBe('Fino al 20 nov');
    await press('settings-pause');
    expect(screen.getByTestId('settings-pause-state')).toHaveTextContent(
      'In pausa dal 6 novembre.',
    );
    await press('settings-pause-change');
    await press('settings-pause-end');
    await pick(25);
    await press('settings-pause-save');
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: '2026-11-25' });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Fine della pausa cambiata',
    );
    expect(value('settings-pause')).toBe('Fino al 25 nov');
    // No end any more.
    await press('settings-pause-change');
    await press('settings-pause-no-end');
    await press('settings-pause-save');
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: null });
  });

  it('resumes with the dialog of Today', async () => {
    const db = newGame(['meditation']);
    createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', deadlineDay: '2026-11-20', steps: ['A', 'B'] },
      clockAt(FRIDAY, 8),
    );
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 9));
    await open(db, FRIDAY + 1);
    await press('settings-pause');
    await press('settings-pause-resume');
    expect(screen.getByTestId('settings-pause-dialog')).toHaveTextContent(
      /Le scadenze dei boss sono spostate di 2 giorni\./,
    );
    await press('settings-pause-dialog-confirm');
    expect(getGeneralPause(db)).toEqual({ fromDay: '2026-11-06', untilDay: '2026-11-07' });
    expect(screen.getByTestId('settings-pause-state')).toHaveTextContent(
      "Oggi è l'ultimo giorno di pausa: si riparte domani.",
    );
    expect(screen.queryByTestId('settings-pause-resume')).toBeNull();
  });
});
