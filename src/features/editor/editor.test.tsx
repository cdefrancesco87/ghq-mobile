import { eq } from 'drizzle-orm';
import { Stack, router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions, Linking } from 'react-native';

import { archiveBoss, createBoss } from '@/db/repositories/boss';
import { createMission, missionReminderTimes, updateMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { boss, missionReminders, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { NO_HEALTH } from '@/features/health/source';
import { setHealthSource } from '@/features/health/system';
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
import { createFakeHealthSource, type FakeHealthSource } from '../../../test/health';

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
  setHealthSource(null);
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

  async function openOption(option: 'frequency' | 'due' | 'reminders' | 'boss' | 'goal') {
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

  it('saves a quantity goal with the proposed increment and reads it again', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Acqua');
    await openOption('goal');
    await fireEvent.press(screen.getByTestId('editor-goal-type-quantity'));
    expect(screen.getByTestId('editor-goal-done')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('editor-goal-target'), '2');
    // About an eighth of the target, rounded to a handy number (T60 proposal).
    expect(screen.getByTestId('editor-goal-increment')).toHaveProp('value', '0.25');
    await fireEvent.press(screen.getByTestId('editor-goal-unit-milliliter'));
    await fireEvent.changeText(screen.getByTestId('editor-goal-target'), '2000');
    expect(screen.getByTestId('editor-goal-increment')).toHaveProp('value', '250');
    await fireEvent.changeText(screen.getByTestId('editor-goal-increment'), '200');
    await fireEvent.changeText(screen.getByTestId('editor-goal-target'), '1500');
    // A changed increment is the user's: no new proposal.
    expect(screen.getByTestId('editor-goal-increment')).toHaveProp('value', '200');
    expect(screen.getByTestId('editor-goal-summary')).toHaveTextContent(
      'Ogni tocco aggiunge 200 ml fino a 1500 ml.',
      { exact: false },
    );
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    expect(screen.getByTestId('editor-option-goal-value')).toHaveTextContent('1500 ml');
    await fireEvent.press(screen.getByTestId('editor-save'));

    const water = created(db, 'Acqua')!;
    expect(water).toMatchObject({
      goalType: 'quantity',
      goalTarget: 1500,
      goalUnit: 'milliliter',
      goalStep: 200,
    });

    await openToEdit(db, water.id);
    expect(screen.getByTestId('editor-option-goal-value')).toHaveTextContent('1500 ml');
    await openOption('goal');
    expect(screen.getByTestId('editor-goal-target')).toHaveProp('value', '1500');
    expect(screen.getByTestId('editor-goal-increment')).toHaveProp('value', '200');
  });

  it('saves a custom unit and goes back to yes/no', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await name('Tè');
    await openOption('goal');
    await fireEvent.press(screen.getByTestId('editor-goal-type-quantity'));
    await fireEvent.changeText(screen.getByTestId('editor-goal-target'), '3,5');
    await fireEvent.press(screen.getByTestId('editor-goal-unit-custom'));
    expect(screen.getByTestId('editor-goal-done')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('editor-goal-unit-text'), 'tazze');
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    const tea = created(db, 'Tè')!;
    expect(tea).toMatchObject({ goalType: 'quantity', goalTarget: 3.5, goalUnit: 'tazze' });

    await openToEdit(db, tea.id);
    await openOption('goal');
    expect(screen.getByTestId('editor-goal-unit-text')).toHaveProp('value', 'tazze');
    await fireEvent.press(screen.getByTestId('editor-goal-type-none'));
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Tè')).toMatchObject({ goalType: 'none', goalTarget: null });
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

describe('Mission editor: other frequencies and templates', () => {
  async function openFrequency() {
    if (screen.queryByTestId('editor-options') === null) {
      await fireEvent.press(screen.getByTestId('editor-more'));
    }
    await fireEvent.press(screen.getByTestId('editor-option-frequency'));
  }

  it('saves «N volte a settimana» with the counter and reads it again', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Piscina');
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-times'));
    // Starts from 3 and stays between 1 and 6 (design-sezioni.md 4.6).
    expect(screen.getByTestId('editor-frequency-times-value')).toHaveTextContent('3');
    await fireEvent.press(screen.getByTestId('editor-frequency-times-less'));
    await fireEvent.press(screen.getByTestId('editor-frequency-times-less'));
    expect(screen.getByTestId('editor-frequency-times-less')).toBeDisabled();
    for (let i = 0; i < 6; i += 1) {
      await fireEvent.press(screen.getByTestId('editor-frequency-times-more'));
    }
    expect(screen.getByTestId('editor-frequency-times-value')).toHaveTextContent('6');
    expect(screen.getByTestId('editor-frequency-times-more')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('editor-frequency-times-less'));
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      '5 volte a settimana',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));

    const pool = created(db, 'Piscina')!;
    expect(pool.frequency).toEqual({ type: 'times_per_week', times: 5 });

    await openToEdit(db, pool.id);
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      '5 volte a settimana',
    );
    await openFrequency();
    expect(screen.getByRole('radio', { name: 'N volte a settimana', checked: true })).toBeTruthy();
    expect(screen.getByTestId('editor-frequency-times-value')).toHaveTextContent('5');
  });

  it('saves «Ogni N giorni» with the first day and reads it again', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Innaffia le piante');
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-every'));
    expect(screen.getByTestId('editor-frequency-every-value')).toHaveTextContent('2');
    expect(screen.getByTestId('editor-frequency-every-less')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('editor-frequency-every-more'));
    // The first day is today, until it is changed.
    expect(screen.getByTestId('editor-frequency-from')).toHaveTextContent(/Dal 6 novembre/);
    await fireEvent.press(screen.getByTestId('editor-frequency-from'));
    await fireEvent(screen.getByTestId('editor-frequency-picker'), 'change', {
      nativeEvent: { timestamp: new Date(2026, 10, 8, 12, 0).getTime(), utcOffset: 0 },
    });
    expect(screen.getByTestId('editor-frequency-from')).toHaveTextContent(/Dal 8 novembre/);
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent('Ogni 3 giorni');
    await fireEvent.press(screen.getByTestId('editor-save'));

    const plants = created(db, 'Innaffia le piante')!;
    expect(plants.frequency).toEqual({ type: 'every_n_days', n: 3, from: '2026-11-08' });

    await openToEdit(db, plants.id);
    await openFrequency();
    expect(screen.getByTestId('editor-frequency-every-value')).toHaveTextContent('3');
    expect(screen.getByTestId('editor-frequency-from')).toHaveTextContent(/Dal 8 novembre/);
  });

  it('keeps the values of each form while trying another one', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-times'));
    await fireEvent.press(screen.getByTestId('editor-frequency-times-more'));
    await fireEvent.press(screen.getByTestId('editor-frequency-daily'));
    expect(screen.queryByTestId('editor-frequency-times-value')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-frequency-times'));
    expect(screen.getByTestId('editor-frequency-times-value')).toHaveTextContent('4');
    // The screen reader changes the counter with a swipe up or down.
    await fireEvent(
      screen.getByRole('adjustable', { name: 'N volte a settimana' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } },
    );
    expect(screen.getByTestId('editor-frequency-times-value')).toHaveTextContent('3');
  });

  it('fills the editor from a template without creating the mission', async () => {
    const db = newGame(['journal']);
    const before = db.select().from(missions).all().length;
    await openEditor(db);
    await fireEvent.press(screen.getByTestId('editor-use-template'));
    expect(screen.getByRole('header', { name: 'Modelli' })).toBeOnTheScreen();
    // Salute first, with its templates only.
    expect(screen.getByTestId('editor-library-template-drink_water')).toBeOnTheScreen();
    expect(screen.queryByTestId('editor-library-template-journal')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-library-category-mind'));
    expect(screen.getByTestId('editor-library-template-journal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('editor-library-category-health'));
    await fireEvent.press(screen.getByTestId('editor-library-template-run'));

    expect(db.select().from(missions).all()).toHaveLength(before);
    expect(screen.getByTestId('editor-name')).toHaveProp('value', 'Corsa 30 min');
    expect(screen.getByTestId('editor-difficulty-medium')).toBeChecked();
    expect(screen.getByTestId('editor-stat-strength')).toBeChecked();
    // The frequency of the template is shown: «Altre opzioni» opens by itself.
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      '3 volte a settimana',
    );

    await fireEvent.press(screen.getByTestId('editor-difficulty-hard'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Corsa 30 min')).toMatchObject({
      kind: 'habit',
      difficulty: 'hard',
      statPrimary: 'strength',
      frequency: { type: 'times_per_week', times: 3 },
      goalType: 'duration',
      goalTarget: 30,
      templateKey: 'run',
      categoryKey: 'health',
    });
  });

  it('fills a quantity goal from a template', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.press(screen.getByTestId('editor-use-template'));
    await fireEvent.press(screen.getByTestId('editor-library-template-drink_water'));
    expect(screen.getByTestId('editor-option-goal-value')).toHaveTextContent('2 L');
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, "Bevi 2 litri d'acqua")).toMatchObject({
      goalType: 'quantity',
      goalTarget: 2,
      goalUnit: 'liter',
      goalStep: 0.25,
      frequency: { type: 'daily' },
    });
  });

  it('searches the templates of every category, without accents', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.press(screen.getByTestId('editor-use-template'));
    await fireEvent.changeText(screen.getByTestId('editor-library-search'), 'DIARIO');
    expect(screen.getByTestId('editor-library-template-journal')).toBeOnTheScreen();
    expect(screen.queryByTestId('editor-library-template-drink_water')).toBeNull();
    expect(screen.getByTestId('editor-library-category-health')).not.toBeSelected();

    await fireEvent.changeText(screen.getByTestId('editor-library-search'), 'zzz');
    expect(screen.getByTestId('editor-library-empty')).toHaveTextContent('Nessun modello trovato');

    await fireEvent.press(screen.getByTestId('editor-library-search-clear'));
    expect(screen.getByTestId('editor-library-template-drink_water')).toBeOnTheScreen();
  });

  it('has no templates when editing a saved mission', async () => {
    const db = newGame(['journal']);
    const [journal] = db.select().from(missions).all();
    await openToEdit(db, journal.id);
    expect(screen.queryByTestId('editor-use-template')).toBeNull();
  });
});

describe('Mission editor: advanced fields (T78)', () => {
  async function openOptions() {
    if (screen.queryByTestId('editor-options') === null) {
      await fireEvent.press(screen.getByTestId('editor-more'));
    }
  }

  async function openFrequency() {
    await openOptions();
    await fireEvent.press(screen.getByTestId('editor-option-frequency'));
  }

  it('saves «Mensile» with the grid of the days and reads it again', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Paga le bollette');
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-monthly'));
    // Starts from the day of today, 6 November.
    expect(screen.getByRole('radio', { name: 'Giorno 6', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('editor-frequency-month-day-15'));
    expect(screen.getByRole('radio', { name: 'Giorno 15', checked: true })).toBeOnTheScreen();
    expect(screen.queryByTestId('editor-frequency-month-note')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      'Ogni mese il giorno 15',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));
    const bills = created(db, 'Paga le bollette')!;
    expect(bills.frequency).toEqual({ type: 'monthly', day: 15 });

    await openToEdit(db, bills.id);
    await openFrequency();
    expect(screen.getByRole('radio', { name: 'Mensile', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Giorno 15', checked: true })).toBeOnTheScreen();
  });

  it('saves «Ultimo giorno del mese» as day 31, which falls on the last day of every month', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Rendiconto');
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-monthly'));
    await fireEvent.press(screen.getByTestId('editor-frequency-month-last'));
    expect(
      screen.getByRole('radio', { name: 'Ultimo giorno del mese', checked: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('editor-frequency-month-note')).toHaveTextContent(
      "Nei mesi più corti vale l'ultimo giorno.",
    );
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      "Ogni mese l'ultimo giorno",
    );
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Rendiconto')!.frequency).toEqual({ type: 'monthly', day: 31 });
  });

  it('saves «Annuale» with day and month, keeping the day inside the month', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Revisione auto');
    await openFrequency();
    await fireEvent.press(screen.getByTestId('editor-frequency-yearly'));
    expect(screen.getByTestId('editor-frequency-year-day-value')).toHaveTextContent('6');
    expect(screen.getByTestId('editor-frequency-year-month-11')).toBeSelected();
    for (let i = 0; i < 25; i += 1) {
      await fireEvent.press(screen.getByTestId('editor-frequency-year-day-more'));
    }
    // November has 30 days.
    expect(screen.getByTestId('editor-frequency-year-day-value')).toHaveTextContent('30');
    expect(screen.getByTestId('editor-frequency-year-day-more')).toBeDisabled();
    // February keeps the 29th, which exists in leap years.
    await fireEvent.press(screen.getByTestId('editor-frequency-year-month-2'));
    expect(screen.getByTestId('editor-frequency-year-day-value')).toHaveTextContent('29');
    await fireEvent.press(screen.getByTestId('editor-frequency-done'));
    expect(screen.getByTestId('editor-option-frequency-value')).toHaveTextContent(
      'Ogni anno il 29 febbraio',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));
    const car = created(db, 'Revisione auto')!;
    expect(car.frequency).toEqual({ type: 'yearly', month: 2, day: 29 });

    await openToEdit(db, car.id);
    await openFrequency();
    expect(screen.getByTestId('editor-frequency-year-day-value')).toHaveTextContent('29');
    expect(screen.getByTestId('editor-frequency-year-month-2')).toBeSelected();
  });

  it('saves the secondary stat with the main one disabled, and shows it in the preview', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Yoga');
    await openOptions();
    // Without a main stat the secondary one gets nothing: every stat is disabled.
    await fireEvent.press(screen.getByTestId('editor-option-secondary'));
    expect(screen.getByTestId('editor-secondary-wisdom')).toBeDisabled();
    expect(screen.getByTestId('editor-secondary-note')).toHaveTextContent(
      'Scegli prima la statistica principale.',
    );
    await fireEvent.press(screen.getByTestId('editor-secondary-none'));

    await fireEvent.press(screen.getByTestId('editor-stat-strength'));
    await fireEvent.press(screen.getByTestId('editor-option-secondary'));
    expect(screen.getByTestId('editor-secondary-strength')).toBeDisabled();
    expect(screen.getByTestId('editor-secondary-note')).toHaveTextContent(
      'Riceve il 30% dei punti della principale.',
    );
    await fireEvent.press(screen.getByTestId('editor-secondary-wisdom'));
    expect(screen.getByTestId('editor-option-secondary-value')).toHaveTextContent('Equilibrio');
    // 30% of 20 points, rounded down (CLAUDE.md, choice 1).
    expect(screen.getByTestId('editor-reward')).toHaveTextContent(
      '+25 XP · +5 Monete · +20 Movimento · +6 Equilibrio',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));
    const yoga = created(db, 'Yoga')!;
    expect(yoga).toMatchObject({ statPrimary: 'strength', statSecondary: 'wisdom' });

    await openToEdit(db, yoga.id);
    expect(screen.getByTestId('editor-option-secondary-value')).toHaveTextContent('Equilibrio');
    // The main stat cannot be the secondary one too: choosing it clears the secondary.
    await fireEvent.press(screen.getByTestId('editor-stat-wisdom'));
    expect(screen.getByTestId('editor-option-secondary-value')).toHaveTextContent('Nessuna');
    expect(screen.getByTestId('editor-reward')).toHaveTextContent(
      '+25 XP · +5 Monete · +20 Equilibrio',
    );
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Yoga')).toMatchObject({ statPrimary: 'wisdom', statSecondary: null });
  });

  it('saves category and icon; the icon of the category is the default', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Stendi i panni');
    await openOptions();
    expect(screen.getByTestId('editor-option-category-value')).toHaveTextContent('Nessuna');
    await fireEvent.press(screen.getByTestId('editor-option-category'));
    expect(screen.getByTestId('editor-icon-missioni')).toBeChecked();
    await fireEvent.press(screen.getByTestId('editor-category-home'));
    expect(screen.getByTestId('editor-category-home')).toBeChecked();
    expect(screen.getByTestId('editor-icon-casa')).toBeChecked();
    await fireEvent.press(screen.getByTestId('editor-category-done'));
    expect(screen.getByTestId('editor-option-category-value')).toHaveTextContent('Casa');
    await fireEvent.press(screen.getByTestId('editor-save'));
    const laundry = created(db, 'Stendi i panni')!;
    expect(laundry).toMatchObject({ categoryKey: 'home', iconKey: null });

    await openToEdit(db, laundry.id);
    await fireEvent.press(screen.getByTestId('editor-option-category'));
    expect(screen.getByTestId('editor-icon-casa')).toBeChecked();
    await fireEvent.press(screen.getByTestId('editor-icon-sole'));
    expect(screen.getByTestId('editor-icon-sole')).toBeChecked();
    await fireEvent.press(screen.getByTestId('editor-category-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Stendi i panni')).toMatchObject({ categoryKey: 'home', iconKey: 'sole' });

    await openToEdit(db, laundry.id);
    await fireEvent.press(screen.getByTestId('editor-option-category'));
    expect(screen.getByTestId('editor-icon-sole')).toBeChecked();
    // Choosing the icon of the category again follows the category; «Nessuna» clears it.
    await fireEvent.press(screen.getByTestId('editor-icon-casa'));
    await fireEvent.press(screen.getByTestId('editor-category-none'));
    await fireEvent.press(screen.getByTestId('editor-category-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Stendi i panni')).toMatchObject({ categoryKey: null, iconKey: null });
  });

  it('saves notes on several lines and shows them in the detail of the mission', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Leggi');
    await openOptions();
    expect(screen.getByTestId('editor-option-notes-value')).toHaveTextContent('Nessuna nota');
    await fireEvent.press(screen.getByTestId('editor-option-notes'));
    await fireEvent.changeText(
      screen.getByTestId('editor-notes-text'),
      ' Dal comodino\nPrima di dormire ',
    );
    expect(screen.queryByTestId('editor-notes-count')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-notes-done'));
    expect(screen.getByTestId('editor-option-notes-value')).toHaveTextContent('Dal comodino');
    await fireEvent.press(screen.getByTestId('editor-save'));
    const read = created(db, 'Leggi')!;
    expect(read.notes).toBe('Dal comodino\nPrima di dormire');

    await openToEdit(db, read.id);
    // A saved mission with notes opens «Altre opzioni» by itself (4.5).
    expect(screen.getByTestId('editor-option-notes-value')).toHaveTextContent('Dal comodino');
    await fireEvent.press(screen.getByTestId('editor-option-notes'));
    expect(screen.getByTestId('editor-notes-text')).toHaveProp(
      'value',
      'Dal comodino\nPrima di dormire',
    );
    await fireEvent.changeText(screen.getByTestId('editor-notes-text'), 'a'.repeat(450));
    expect(screen.getByTestId('editor-notes-count')).toHaveTextContent('450 di 500 caratteri');

    await act(async () => {
      router.push(`/stats?missionId=${read.id}`);
    });
    expect(await screen.findByTestId('mission-detail-notes')).toHaveTextContent(
      'Dal comodino Prima di dormire',
    );
  });
});

describe('Mission editor: health data', () => {
  let health: FakeHealthSource;

  beforeEach(() => {
    health = createFakeHealthSource('apple');
    setHealthSource(health);
  });

  async function stepsGoal() {
    await fireEvent.changeText(screen.getByTestId('editor-name'), 'Cammina');
    await fireEvent.press(screen.getByTestId('editor-more'));
    await fireEvent.press(screen.getByTestId('editor-option-goal'));
    await fireEvent.press(screen.getByTestId('editor-goal-type-quantity'));
    await fireEvent.changeText(screen.getByTestId('editor-goal-target'), '8000');
  }

  it('links the steps, asking the permission only when they are chosen', async () => {
    const db = newGame(['journal']);
    await openEditor(db);
    await stepsGoal();
    expect(screen.getByTestId('editor-goal-health')).toHaveTextContent('Collega a Salute', {
      exact: false,
    });
    expect(health.requested).toEqual([]);
    await fireEvent.press(screen.getByTestId('editor-goal-health-steps'));
    expect(health.requested).toEqual(['steps']);
    expect(screen.getByTestId('editor-goal-unit-linked')).toHaveTextContent('passi');
    expect(screen.getByTestId('editor-goal-health-status')).toHaveTextContent(
      'Si leggono solo i passi di oggi da Salute',
      { exact: false },
    );
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Cammina')).toMatchObject({
      goalType: 'quantity',
      goalTarget: 8000,
      goalUnit: 'step',
      healthMetric: 'steps',
    });

    // Back to «No»: the mission is completed by hand again.
    await openToEdit(db, created(db, 'Cammina')!.id);
    await fireEvent.press(screen.getByTestId('editor-option-goal'));
    expect(screen.getByRole('button', { name: 'Passi', selected: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('editor-goal-health-none'));
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Cammina')?.healthMetric).toBeNull();
  });

  it('says that the permission was denied and leaves the mission to do by hand', async () => {
    health.answers.steps = 'denied';
    const db = newGame(['journal']);
    await openEditor(db);
    await stepsGoal();
    await fireEvent.press(screen.getByTestId('editor-goal-health-steps'));
    expect(screen.getByTestId('editor-goal-health-status')).toHaveTextContent(
      'Permesso non dato: la missione resta da completare a mano.',
      { exact: false },
    );
    expect(screen.queryByTestId('editor-goal-unit-linked')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-goal-unit-step'));
    await fireEvent.press(screen.getByTestId('editor-goal-done'));
    await fireEvent.press(screen.getByTestId('editor-save'));
    expect(created(db, 'Cammina')).toMatchObject({ goalUnit: 'step', healthMetric: null });
  });

  it('says that a linked mission lost its permission', async () => {
    const db = newGame(['journal']);
    const walk = createMission(
      db,
      {
        name: 'Cammina',
        goal: { type: 'quantity', target: 8000, unit: 'step', increment: 1000 },
        healthMetric: 'steps',
      },
      { now: at(FRIDAY, 9), tzOffset: 60 },
    );
    health.permissions.steps = 'denied';
    await openToEdit(db, walk.id);
    await fireEvent.press(screen.getByTestId('editor-option-goal'));
    expect(await screen.findByText('Permesso non dato', { exact: false })).toBeOnTheScreen();
  });

  it('says that a phone without health data cannot link', async () => {
    setHealthSource(NO_HEALTH);
    const db = newGame(['journal']);
    await openEditor(db);
    await stepsGoal();
    await fireEvent.press(screen.getByTestId('editor-goal-health-sleep_hours'));
    expect(screen.getByTestId('editor-goal-health-status')).toHaveTextContent(
      'I dati di salute non sono disponibili su questo telefono',
      { exact: false },
    );
  });
});
