import { eq } from 'drizzle-orm';
import { Stack, router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions, Linking } from 'react-native';

import { archiveBoss, createBoss } from '@/db/repositories/boss';
import { missionReminderTimes, updateMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { boss, missionReminders, missions } from '@/db/schema';
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
import { FRIDAY, at, clockAt, newGame } from '../../../test/game';

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

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
}));

async function openApp(db: Db) {
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
}

async function openEditor(db: Db) {
  await openApp(db);
  await fireEvent.press(screen.getByTestId('tab-new'));
  await screen.findByTestId('editor');
}

/** The editor of a saved mission, as «Modifica» of the menu of Today opens it. */
async function openToEdit(db: Db, missionId: string) {
  await openApp(db);
  await act(async () => {
    router.push({ pathname: '/editor', params: { missionId } });
  });
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
  mockGetPermissions.mockReset().mockResolvedValue({ granted: true, status: 'granted' });
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true, status: 'granted' });
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
    expect(useHighlightStore.getState().missionId).toBeNull();
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
    // A task without a due day is not in Today: there is no row to highlight.
    expect(useHighlightStore.getState().missionId).toBeNull();
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

describe('Mission editor: other options and editing', () => {
  async function name(text: string) {
    await fireEvent.changeText(screen.getByTestId('editor-name'), text);
  }

  async function openOption(option: 'frequency' | 'due' | 'reminders' | 'boss') {
    if (screen.queryByTestId('editor-options') === null) {
      await fireEvent.press(screen.getByTestId('editor-more'));
    }
    await fireEvent.press(screen.getByTestId(`editor-option-${option}`));
  }

  /** The time picker answers like the wheel of iOS, then «Aggiungi». */
  async function addTime(hours: number, minutes: number) {
    await fireEvent.press(screen.getByTestId('editor-reminders-add'));
    await fireEvent(screen.getByTestId('editor-reminders-picker'), 'change', {
      nativeEvent: { timestamp: new Date(2026, 10, 6, hours, minutes).getTime(), utcOffset: 0 },
    });
    await fireEvent.press(screen.getByTestId('editor-reminders-confirm'));
  }

  it('saves the days of the week and reads them again when editing', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Palestra');
    await openOption('frequency');
    await fireEvent.press(screen.getByTestId('editor-frequency-weekdays'));
    expect(screen.getByTestId('editor-frequency-done')).toBeDisabled();
    for (const day of [1, 3, 5]) {
      await fireEvent.press(screen.getByTestId(`editor-frequency-day-${day}`));
    }
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent('Lun, mer, ven');
    await fireEvent.press(screen.getByTestId('editor-save'));

    const gym = created(db, 'Palestra')!;
    expect(gym.frequency).toEqual({ type: 'weekdays', days: [1, 3, 5] });

    await openToEdit(db, gym.id);
    // An advanced value is set: «Altre opzioni» is already open.
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent('Lun, mer, ven');
    await openOption('frequency');
    expect(screen.getByRole('checkbox', { name: 'mer', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'mar', checked: false })).toBeOnTheScreen();
  });

  it('starts the circles of the week from the first day of the settings', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'week_start', 7, at(FRIDAY, 9));
    await openEditor(db);
    await openOption('frequency');
    await fireEvent.press(screen.getByTestId('editor-frequency-weekdays'));

    const order = screen
      .getAllByRole('checkbox')
      .map((element) => element.props.accessibilityLabel as string);
    expect(order).toEqual(['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']);
  });

  it('gives a single task a due day instead of a frequency, and no reminders', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Dentista');
    await fireEvent.press(screen.getByTestId('editor-kind-task'));
    await fireEvent.press(screen.getByTestId('editor-more'));
    expect(screen.queryByTestId('editor-option-frequency')).toBeNull();
    expect(screen.queryByTestId('editor-option-reminders')).toBeNull();
    expect(screen.getByTestId('editor-option-due-value')).toHaveTextContent('Senza scadenza');

    await openOption('due');
    await fireEvent.press(screen.getByTestId('editor-due-day'));
    await fireEvent(screen.getByTestId('editor-due-picker'), 'change', {
      nativeEvent: { timestamp: new Date(2026, 10, 10, 12, 0).getTime(), utcOffset: 0 },
    });
    await fireEvent.press(screen.getByTestId('editor-due-done'));
    expect(screen.getByTestId('editor-option-due-value')).toHaveTextContent('Scade il 10 novembre');
    await fireEvent.press(screen.getByTestId('editor-save'));

    expect(created(db, 'Dentista')).toMatchObject({
      kind: 'task',
      frequency: null,
      dueDay: '2026-11-10',
    });
  });

  it('adds and removes the reminder times', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Leggi');
    await openOption('reminders');
    await addTime(21, 30);
    await addTime(8, 0);
    expect(screen.getByTestId('editor-reminder-08:00')).toHaveTextContent('8:00');
    await fireEvent.press(screen.getByLabelText('Togli il promemoria delle 8:00'));
    expect(screen.queryByTestId('editor-reminder-08:00')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-reminders-done'));
    expect(screen.getByTestId('editor-option-reminders-value')).toHaveTextContent('21:30');
    await fireEvent.press(screen.getByTestId('editor-save'));

    expect(missionReminderTimes(db, created(db, 'Leggi')!.id)).toEqual(['21:30']);
  });

  it('says that notifications are denied and leads to the settings, without blocking the save', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Leggi');
    await openOption('reminders');

    expect(await screen.findByTestId('editor-reminders-denied')).toHaveTextContent(
      /Le notifiche sono disattivate/,
    );
    await fireEvent.press(screen.getByTestId('editor-reminders-settings'));
    expect(openSettings).toHaveBeenCalledTimes(1);
    await addTime(7, 15);
    await fireEvent.press(screen.getByTestId('editor-reminders-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));

    expect(missionReminderTimes(db, created(db, 'Leggi')!.id)).toEqual(['07:15']);
    openSettings.mockRestore();
  });

  it('asks for the permission never asked, with the words of the first launch', async () => {
    mockGetPermissions.mockResolvedValue({ granted: false, status: 'undetermined' });
    await openEditor(newGame(['journal']));
    await openOption('reminders');

    expect(await screen.findByTestId('editor-reminders-ask')).toHaveTextContent(
      /Vuoi i promemoria\?/,
    );
    await fireEvent.press(screen.getByTestId('editor-reminders-enable'));

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('editor-reminders-ask')).toBeNull();
  });

  it('links a boss, then moves the mission to another one', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', steps: ['A', 'B'] },
      clockAt(FRIDAY, 9),
    );
    const quest = db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
    await openEditor(db);
    await name('Scrivi');
    await openOption('boss');
    await fireEvent.press(screen.getByTestId(`editor-boss-${thesis.id}`));
    expect(screen.getByTestId('editor-option-boss-value')).toHaveTextContent('Tesi');
    await fireEvent.press(screen.getByTestId('editor-save'));
    const mission = created(db, 'Scrivi')!;
    expect(mission.bossId).toBe(thesis.id);

    await openToEdit(db, mission.id);
    await openOption('boss');
    expect(screen.getByRole('radio', { name: /Tesi/, checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`editor-boss-${quest.id}`));
    await fireEvent.press(screen.getByTestId('editor-save'));

    expect(created(db, 'Scrivi')?.bossId).toBe(quest.id);
  });

  it('offers to create a goal when there is no active boss', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, db.select().from(boss).get()!.id, clockAt(FRIDAY, 9));
    await openEditor(db);
    await openOption('boss');

    expect(screen.getByTestId('editor-boss-create')).toHaveTextContent(
      'Nessun grande obiettivo attivo · Crea un obiettivo',
    );
  });

  it('edits a mission: new difficulty from the next completions', async () => {
    const db = newGame(['journal']);
    const journal = db.select().from(missions).get()!;
    await openToEdit(db, journal.id);

    expect(screen.getByRole('header', { name: 'Modifica abitudine' })).toBeOnTheScreen();
    expect(screen.getByTestId('editor-name')).toHaveProp('value', journal.name);
    expect(screen.queryByTestId('editor-kind-habit')).toBeNull();
    expect(screen.queryByTestId('editor-difficulty-note')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-difficulty-hard'));
    expect(screen.getByTestId('editor-difficulty-note')).toHaveTextContent(
      'Vale dai prossimi completamenti.',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('today-screen');
    expect(created(db, journal.name)?.difficulty).toBe('hard');
  });

  it('asks before discarding the changes, and closes at once without changes', async () => {
    const db = newGame(['journal']);
    const journal = db.select().from(missions).get()!;
    await openToEdit(db, journal.id);
    await name('Diario della sera');

    await act(async () => router.back());
    expect(screen.getByTestId('editor-discard')).toHaveTextContent(/Scartare le modifiche\?/);
    await fireEvent.press(screen.getByTestId('editor-discard-cancel'));
    expect(screen.getByTestId('editor')).toBeOnTheScreen();

    await act(async () => router.back());
    await fireEvent.press(screen.getByTestId('editor-discard-confirm'));
    await screen.findByTestId('today-screen');
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(created(db, journal.name)).toBeDefined();

    await openToEdit(db, journal.id);
    await act(async () => router.back());
    expect(screen.queryByTestId('editor-discard')).toBeNull();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('keeps the reminder rows when the times did not change', async () => {
    const db = newGame(['journal']);
    const journal = db.select().from(missions).get()!;
    updateMission(db, journal.id, { reminders: ['08:00'] }, clockAt(FRIDAY, 9));
    const before = db.select().from(missionReminders).all();
    await openToEdit(db, journal.id);
    await name('Diario della sera');
    await fireEvent.press(screen.getByTestId('editor-save'));

    await screen.findByTestId('today-screen');
    expect(created(db, 'Diario della sera')).toBeDefined();
    expect(db.select().from(missionReminders).all()).toEqual(before);
  });

  it('archives without asking about changes not saved, which are left out', async () => {
    const db = newGame(['journal']);
    const journal = db.select().from(missions).get()!;
    await openToEdit(db, journal.id);
    await name('Diario della sera');
    await fireEvent.press(screen.getByTestId('editor-archive'));

    await screen.findByTestId('today-screen');
    expect(screen.queryByTestId('editor-discard')).toBeNull();
    expect(created(db, journal.name)?.status).toBe('archived');
    expect(created(db, 'Diario della sera')).toBeUndefined();
  });

  it('archives with «Annulla» and deletes after the dialog', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const [journal, meal] = db.select().from(missions).all();
    await openToEdit(db, journal.id);
    await fireEvent.press(screen.getByTestId('editor-archive'));

    await screen.findByTestId('today-screen');
    expect(created(db, journal.name)?.status).toBe('archived');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Missione archiviata/);
    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(created(db, journal.name)?.status).toBe('active');

    await openToEdit(db, meal.id);
    await fireEvent.press(screen.getByTestId('editor-delete'));
    expect(screen.getByTestId('editor-delete-dialog')).toHaveTextContent(
      /Lo storico di questa missione si perde/,
    );
    await fireEvent.press(screen.getByTestId('editor-delete-dialog-confirm'));

    await screen.findByTestId('today-screen');
    expect(created(db, meal.name)?.deletedAt).not.toBeNull();
  });
});
