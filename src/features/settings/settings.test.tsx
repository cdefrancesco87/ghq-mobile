import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { getSetting, pendingWeekRules } from '@/db/repositories/settings';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { onActionDone, startApp, useAppStore } from '@/stores/app';
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
import SettingsRoute from '../../../app/settings/index';
import QuietHoursRoute from '../../../app/settings/quiet-hours';
import ThemeRoute from '../../../app/settings/theme';
import { FRIDAY, clockAt, newGame } from '../../../test/game';

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  'settings/index': SettingsRoute,
  'settings/theme': ThemeRoute,
  'settings/quiet-hours': QuietHoursRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

/** Every action that went through `runAction`: the reminders are scheduled again after each. */
const actionDone = jest.fn();
let stopListening: () => void = () => undefined;

async function open(db: Db, url = '/settings') {
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
  if (url === '/settings') {
    await screen.findByTestId('settings-screen');
  }
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const text = (id: string) => screen.getByTestId(id).props.children as string;

/** The time picker answers like the wheel of iOS, then «Usa le …». */
async function pickTime(sheet: string, hours: number, minutes: number) {
  await fireEvent(screen.getByTestId(`${sheet}-picker`), 'change', {
    nativeEvent: { timestamp: new Date(2026, 10, 6, hours, minutes).getTime(), utcOffset: 0 },
  });
  await press(`${sheet}-done`);
}

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

beforeEach(async () => {
  // Jest starts with a font scale of 2: the layout with very large text.
  await setFontScale(1);
  mockGetPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  mockRequestPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  actionDone.mockClear();
  stopListening = onActionDone(actionDone);
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

afterEach(() => stopListening());

describe('Settings', () => {
  it('opens from the gear of the Profile with the title of the theme and the groups', async () => {
    await open(newGame(['meditation']), '/profile');
    await press('profile-settings');
    expect(await screen.findByTestId('settings-screen')).toBeOnTheScreen();
    expect(screen.getByText('Impostazioni')).toBeOnTheScreen();
    for (const group of ['ASPETTO', 'GIORNATA', 'NOTIFICHE', 'DATI', 'INFORMAZIONI']) {
      expect(screen.getByText(group)).toBeOnTheScreen();
    }
    expect(text('settings-theme-value')).toBe('Minimal · Automatico');
    expect(text('settings-language-value')).toBe('Italiano');
    expect(text('settings-day-change-value')).toBe('6:00');
    expect(text('settings-week-start-value')).toBe('Lunedì');
    expect(text('settings-rest-days-value')).toBe('Nessuno');
    expect(text('settings-quiet-hours-value')).toBe('Nessuno');
    expect(text('settings-evening-time-value')).toBe('21:00');
  });

  it('has the title of each theme', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await act(async () => useThemeStore.getState().setTheme('fantasy'));
    expect(screen.getByText('Regole del regno')).toBeOnTheScreen();
    await act(async () => useThemeStore.getState().setTheme('arcade'));
    expect(screen.getByText('OPTIONS')).toBeOnTheScreen();
  });

  it('changes the theme only with «Usa questo tema», then says «Stessi dati, nuova veste»', async () => {
    await open(newGame(['meditation']));
    await press('settings-theme');
    expect(await screen.findByTestId('settings-theme-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-theme-use')).toBeDisabled();

    await press('theme-card-fantasy');
    expect(useThemeStore.getState().theme).toBe('minimal');
    expect(screen.getByTestId('settings-theme-use')).toBeEnabled();
    await press('settings-theme-use');
    expect(useThemeStore.getState().theme).toBe('fantasy');
    expect(screen.getByText('Stessi dati, nuova veste')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-theme-use')).toBeDisabled();
  });

  it('applies a mode of Minimal from its chips', async () => {
    await open(newGame(['meditation']));
    await press('settings-theme');
    await screen.findByTestId('settings-theme-screen');
    await press('theme-mode-dark');
    await press('settings-theme-use');
    expect(useThemeStore.getState().theme).toBe('minimal-scuro');
  });

  it('changes the language at once from its sheet', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-language');
    await press('settings-language-sheet-en');
    expect(useSettingsStore.getState().settings.language).toBe('en');
    expect(getSetting(db, 'language')).toBe('en');
    expect(await screen.findByText('Settings')).toBeOnTheScreen();
    expect(text('settings-language-value')).toBe('English');
  });

  it('makes a new day change time count from tomorrow and says so on the row', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-day-change');
    expect(
      screen.getByText('Una missione fatta prima delle 6:00 conta per il giorno prima'),
    ).toBeOnTheScreen();
    await press('settings-day-change-sheet-04:00');
    expect(getSetting(db, 'day_change')).toEqual({
      value: '06:00',
      next: '04:00',
      from_day: '2026-11-07',
    });
    expect(text('settings-day-change-value')).toBe('4:00');
    expect(text('settings-day-change-caption')).toBe('Dal 7 novembre');
    expect(actionDone).toHaveBeenCalled();
  });

  it('chooses the rest days from tomorrow, in the order of the week', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-rest-days');
    await press('settings-rest-day-7');
    await press('settings-rest-day-6');
    expect(screen.getByTestId('settings-rest-day-6')).toBeChecked();
    await press('settings-rest-days-done');
    expect(pendingWeekRules(db)).toEqual({
      week_start: 1,
      rest_days: [6, 7],
      from_day: '2026-11-07',
    });
    expect(getSetting(db, 'rest_days')).toEqual([]);
    expect(text('settings-rest-days-value')).toBe('Sab, Dom');
    expect(text('settings-rest-days-caption')).toBe('Dal 7 novembre');
    expect(actionDone).toHaveBeenCalled();
  });

  it('changes the first day of the week from tomorrow', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-week-start');
    await press('settings-week-start-sheet-7');
    expect(pendingWeekRules(db)).toMatchObject({ week_start: 7, from_day: '2026-11-07' });
    expect(text('settings-week-start-value')).toBe('Domenica');
    expect(text('settings-week-start-caption')).toBe('Dal 7 novembre');
    expect(screen.queryByTestId('settings-rest-days-caption')).toBeNull();
  });

  it('adds, changes and removes an interval of «Non disturbare», scheduling the reminders', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await press('settings-quiet-hours');
    expect(await screen.findByTestId('settings-quiet-empty')).toBeOnTheScreen();

    await press('settings-quiet-add');
    expect(getSetting(db, 'quiet_hours')).toEqual([{ start: '22:00', end: '07:00' }]);
    expect(actionDone).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Intervallo 1, dalle 22:00 alle 7:00')).toBeOnTheScreen();

    await press('settings-quiet-0-end');
    await pickTime('settings-quiet-time', 6, 30);
    expect(getSetting(db, 'quiet_hours')).toEqual([{ start: '22:00', end: '06:30' }]);
    expect(actionDone).toHaveBeenCalledTimes(2);

    await press('settings-quiet-add');
    expect(getSetting(db, 'quiet_hours')).toHaveLength(2);
    await press('settings-quiet-0-remove');
    expect(getSetting(db, 'quiet_hours')).toEqual([{ start: '22:00', end: '07:00' }]);
    expect(actionDone).toHaveBeenCalledTimes(4);
  });

  it('shows the intervals of «Non disturbare» on the row', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await act(async () =>
      useSettingsStore.getState().update('quiet_hours', [
        { start: '22:00', end: '07:00' },
        { start: '13:00', end: '14:00' },
      ]),
    );
    expect(text('settings-quiet-hours-value')).toBe('22:00–7:00, 13:00–14:00');
    expect(
      screen.getByLabelText('Non disturbare, dalle 22:00 alle 7:00, dalle 13:00 alle 14:00'),
    ).toBeOnTheScreen();
  });

  it('turns the reminders off and on with the general switch', async () => {
    const db = newGame(['meditation']);
    await open(db);
    const reminders = await screen.findByTestId('settings-reminders');
    expect(reminders.props.value).toBe(true);
    await fireEvent(reminders, 'valueChange', false);
    expect(getSetting(db, 'reminders_enabled')).toBe(false);
    expect(actionDone).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('settings-reminders').props.value).toBe(false);
  });

  it('asks for the permission when the reminders are turned on and it was never asked', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, status: 'undetermined' });
    const db = newGame(['meditation']);
    await open(db);
    await fireEvent(await screen.findByTestId('settings-reminders'), 'valueChange', false);
    await fireEvent(screen.getByTestId('settings-reminders'), 'valueChange', true);
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(getSetting(db, 'reminders_enabled')).toBe(true);
  });

  it('says the notifications are blocked by the phone, with the way to its settings', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    await open(newGame(['meditation']));
    expect(await screen.findByTestId('settings-reminders-blocked')).toBeOnTheScreen();
    expect(screen.getByText('Notifiche bloccate dal telefono')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-open-system')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-reminders')).toBeNull();
  });

  it('saves the evening summary switch and time', async () => {
    const db = newGame(['meditation']);
    await open(db);
    await fireEvent(screen.getByTestId('settings-evening'), 'valueChange', false);
    expect(getSetting(db, 'evening_summary')).toEqual({ enabled: false, time: '21:00' });
    await press('settings-evening-time');
    await pickTime('settings-evening-time-sheet', 20, 30);
    expect(getSetting(db, 'evening_summary')).toEqual({ enabled: false, time: '20:30' });
    expect(text('settings-evening-time-value')).toBe('20:30');
  });

  it('filters the rows while typing in Cerca, without minding accents', async () => {
    await open(newGame(['meditation']));
    await fireEvent.changeText(screen.getByTestId('settings-search'), 'riposo');
    expect(screen.getByTestId('settings-rest-days')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-theme')).toBeNull();
    expect(screen.queryByTestId('settings-group-appearance')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('settings-search'), 'NOTIFICHE');
    expect(screen.getByTestId('settings-quiet-hours')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-day-change')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('settings-search'), 'licenze');
    expect(screen.getByTestId('settings-licenses')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('settings-search'), 'zzz');
    expect(screen.getByTestId('settings-no-results')).toBeOnTheScreen();

    await press('settings-search-clear');
    expect(screen.getByTestId('settings-theme')).toBeOnTheScreen();
  });

  it('reads each row with name, value and type', async () => {
    await open(newGame(['meditation']));
    expect(screen.getByLabelText('Cambio di giornata, 6:00')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-reminders')).toHaveProp('accessibilityLabel', 'Promemoria');
    expect(screen.getByTestId('settings-reminders')).toHaveProp('value', true);
  });

  it('puts the value under the name with very large text', async () => {
    await setFontScale(1.3);
    await open(newGame(['meditation']));
    const stacked = StyleSheet.flatten(screen.getByTestId('settings-day-change-text').props.style);
    expect(stacked.flexDirection).toBeUndefined();

    await setFontScale(1);
    const inline = StyleSheet.flatten(screen.getByTestId('settings-day-change-text').props.style);
    expect(inline.flexDirection).toBe('row');
  });
});
