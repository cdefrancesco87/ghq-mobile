import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import type { ComponentType } from 'react';

import { completeMission } from '@/db/repositories/completion';
import {
  archiveMission,
  createMission,
  deleteMission,
  pauseMission,
} from '@/db/repositories/missions';
import { missionDays, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHabitsUiStore } from '@/stores/habits';
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
import Index from '../../../app/index';
import Stats from '../../../app/stats';
import { FRIDAY, clockAt, missionId, newGame } from '../../../test/game';

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

async function openHabits(db: Db, clock = () => clockAt(FRIDAY, 10)) {
  await startApp({ openDatabase: () => Promise.resolve(db), clock });
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
    { initialUrl: '/habits' },
  );
  await screen.findByTestId('habits-screen');
}

const row = (id: string) => `habits-row-${id}`;
/** The handles and the swipe actions are hidden from the screen reader, which has them on the row. */
const hidden = { includeHiddenElements: true };

async function openMenu(id: string) {
  await fireEvent(screen.getByTestId(`${row(id)}-body`), 'longPress');
}

/** The delete dialog opens once the menu has slid away. */
async function waitForDialog() {
  await act(async () => {
    jest.advanceTimersByTime(SHEET_DURATION_MS);
  });
}

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
  useHabitsUiStore.setState({ filter: 'all' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Habits: list', () => {
  it('shows the count, the filters and the missions by category with streak and rate', async () => {
    const db = newGame(['drink_water', 'read_pages', 'journal']);
    createMission(db, { name: 'Dentista', kind: 'task' }, clockAt(FRIDAY, 9));
    const water = missionId(db, 'drink_water');
    // Done today: the rate counts today once it is done.
    completeMission(db, { missionId: water, source: 'app', ...clockAt(FRIDAY, 9) });
    db.update(missions).set({ streak: 12 }).where(eq(missions.id, water)).run();
    await openHabits(db);

    expect(screen.getByRole('header', { name: 'Abitudini' })).toBeOnTheScreen();
    expect(screen.getByText('4 attive')).toBeOnTheScreen();
    expect(screen.getByTestId('habits-filter-all')).toHaveTextContent('Tutte 4');
    expect(screen.getByTestId('habits-filter-habits')).toHaveTextContent('Abitudini 3');
    expect(screen.getByTestId('habits-filter-tasks')).toHaveTextContent('Singole 1');
    expect(screen.getByTestId('habits-filter-archived')).toHaveTextContent('Archiviate 0');
    expect(screen.getByTestId('habits-category-health')).toHaveTextContent(/Salute/);
    expect(screen.getByTestId('habits-category-mind')).toHaveTextContent(/Mente/);
    expect(screen.getByTestId('habits-category-none')).toHaveTextContent(/Senza categoria/);
    expect(screen.getByTestId(`${row(water)}-body`)).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/serie 12 giorni, 100% negli ultimi 30 giorni$/),
    );
    // Nothing expected yet: no rate.
    expect(screen.getByTestId(`${row(missionId(db, 'journal'))}-rate`)).toHaveTextContent('–');
    // No completion control in Habits (3.2 ★).
    expect(screen.queryByTestId(`${row(water)}-control`)).toBeNull();
  });

  it('filters by kind and shows a sentence for an empty filter', async () => {
    const db = newGame(['drink_water']);
    const task = createMission(db, { name: 'Dentista', kind: 'task' }, clockAt(FRIDAY, 9)).id;
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-filter-tasks'));
    expect(screen.getByTestId(row(task))).toBeOnTheScreen();
    expect(screen.queryByTestId(row(missionId(db, 'drink_water')))).toBeNull();

    await fireEvent.press(screen.getByTestId('habits-filter-habits'));
    expect(screen.queryByTestId(row(task))).toBeNull();
    expect(screen.getByTestId(row(missionId(db, 'drink_water')))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('habits-filter-archived'));
    expect(screen.getByTestId('habits-filter-empty')).toHaveTextContent(
      'Nessuna missione archiviata.',
    );
    expect(screen.getByTestId('habits-filter-archived')).toHaveProp('accessibilityState', {
      selected: true,
    });
  });

  it('closes and opens a category', async () => {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-category-health-header'));
    expect(screen.queryByTestId(row(water))).toBeNull();
    expect(screen.getByTestId('habits-category-health-header')).toHaveProp('accessibilityState', {
      expanded: false,
    });

    await fireEvent.press(screen.getByTestId('habits-category-health-header'));
    expect(screen.getByTestId(row(water))).toBeOnTheScreen();
  });

  it('opens the detail with a tap', async () => {
    const db = newGame(['drink_water']);
    await openHabits(db);

    await fireEvent.press(screen.getByTestId(`${row(missionId(db, 'drink_water'))}-body`));

    expect(screen).toHavePathnameWithParams(`/stats?missionId=${missionId(db, 'drink_water')}`);
  });

  it('shows the empty state with the companion and two actions', async () => {
    const db = newGame(['drink_water']);
    deleteMission(db, missionId(db, 'drink_water'), clockAt(FRIDAY, 9));
    await openHabits(db);

    expect(screen.getByText('0 attive')).toBeOnTheScreen();
    expect(screen.getByTestId('habits-empty')).toHaveTextContent(/Nessuna missione, per ora/);
    expect(screen.queryByTestId('habits-filter-all')).toBeNull();
    expect(screen.getByTestId('habits-empty-secondary')).toHaveTextContent('Usa un modello');

    await fireEvent.press(screen.getByTestId('habits-empty-action'));
    expect(await screen.findByRole('header', { name: 'Nuova abitudine' })).toBeOnTheScreen();
    expect(screen.queryByTestId('editor-library')).toBeNull();
  });

  it('opens the template library from «Usa un modello»', async () => {
    const db = newGame(['drink_water']);
    deleteMission(db, missionId(db, 'drink_water'), clockAt(FRIDAY, 9));
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-empty-secondary'));
    expect(await screen.findByTestId('editor-library')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Modelli' })).toBeOnTheScreen();
  });
});

describe('Habits: archive and delete', () => {
  it('archives from the menu with Undo, and restores from the archive', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-archive'));

    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('archived');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Archiviata/);
    expect(screen.queryByTestId(row(water))).toBeNull();
    expect(screen.getByTestId('habits-filter-archived')).toHaveTextContent('Archiviate 1');

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('active');
    expect(screen.getByTestId(row(water))).toBeOnTheScreen();

    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-archive'));
    await fireEvent.press(screen.getByTestId('habits-filter-archived'));
    expect(screen.getByTestId(row(water))).toHaveTextContent(/Archiviata il 6 novembre/);

    await fireEvent.press(screen.getByTestId(`${row(water)}-restore`));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('active');
    expect(screen.getByTestId('habits-filter-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('habits-filter-all')).toHaveTextContent('Tutte 2');
  });

  it('keeps the pause when the archive of a paused mission is undone', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    pauseMission(db, water, '2026-11-12', clockAt(FRIDAY, 9));
    await openHabits(db);

    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-archive'));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('archived');

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()).toMatchObject({
      status: 'paused',
      pausedUntil: '2026-11-12',
      archivedAt: null,
    });
  });

  it('offers the same actions to the screen reader', async () => {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    const body = screen.getByTestId(`${row(water)}-body`);
    expect(body.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      'edit',
      'pause',
      'archive',
      'delete',
    ]);
    await fireEvent(body, 'accessibilityAction', { nativeEvent: { actionName: 'archive' } });
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('archived');
  });

  it('deletes after the dialog: the mission leaves Habits and Today', async () => {
    jest.useFakeTimers();
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-delete'));
    await waitForDialog();
    expect(screen.getByTestId('habits-delete')).toHaveTextContent(
      /Eliminare «templates\.drink_water\.name» e tutto il suo storico\?Non si può annullare\./,
    );
    await fireEvent.press(screen.getByTestId('habits-delete-confirm'));

    expect(
      db.select().from(missions).where(eq(missions.id, water)).get()?.deletedAt,
    ).not.toBeNull();
    expect(screen.queryByTestId(row(water))).toBeNull();
    expect(screen.getByTestId('habits-filter-all')).toHaveTextContent('Tutte 1');

    await fireEvent.press(screen.getByTestId('tab-today'));
    await screen.findByTestId('today-screen');
    expect(screen.queryByTestId(`today-mission-${water}`)).toBeNull();
    expect(screen.getByTestId(`today-mission-${missionId(db, 'read_pages')}`)).toBeOnTheScreen();
  });

  it('archives instead of deleting from the dialog', async () => {
    jest.useFakeTimers();
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-delete'));
    await waitForDialog();
    await fireEvent.press(screen.getByTestId('habits-delete-alternative'));

    const saved = db.select().from(missions).where(eq(missions.id, water)).get();
    expect(saved).toMatchObject({ status: 'archived', deletedAt: null });
  });

  it('has no «Archivia invece» for an archived mission', async () => {
    jest.useFakeTimers();
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    archiveMission(db, water, clockAt(FRIDAY, 9));
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-filter-archived'));
    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-delete'));
    await waitForDialog();

    expect(screen.getByTestId('habits-delete')).toBeOnTheScreen();
    expect(screen.queryByTestId('habits-delete-alternative')).toBeNull();
  });
});

describe('Habits: single tasks done', () => {
  it('keeps a done task for 7 days in muted text, then archives it at the start', async () => {
    const db = newGame(['drink_water']);
    const task = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-06' },
      clockAt(FRIDAY, 9),
    ).id;
    completeMission(db, { missionId: task, source: 'app', ...clockAt(FRIDAY, 9) });
    await openHabits(db, () => clockAt(12, 10));

    await fireEvent.press(screen.getByTestId('habits-filter-tasks'));
    expect(screen.getByTestId(row(task))).toHaveTextContent(/Fatta il 6 novembre/);

    // The next start, a week after the completion.
    await act(async () => {
      await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(13, 10) });
    });

    expect(db.select().from(missions).where(eq(missions.id, task)).get()?.status).toBe('archived');
    expect(db.select().from(missionDays).where(eq(missionDays.missionId, task)).all()).toHaveLength(
      1,
    );
  });
});

describe('Habits: search', () => {
  it('filters while typing inside the active filter, with the archived at the bottom in «Tutte»', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const run = createMission(db, { name: 'Corsa al parco' }, clockAt(FRIDAY, 9)).id;
    const old = createMission(db, { name: 'Corsa in salita' }, clockAt(FRIDAY, 9)).id;
    const task = createMission(
      db,
      { name: 'Comprare scarpe da corsa', kind: 'task' },
      clockAt(FRIDAY, 9),
    ).id;
    archiveMission(db, old, clockAt(FRIDAY, 9));
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-search-open'));
    await fireEvent.changeText(screen.getByTestId('habits-search'), 'CORSA');

    expect(screen.getByTestId(row(run))).toBeOnTheScreen();
    expect(screen.getByTestId(row(task))).toBeOnTheScreen();
    expect(screen.queryByTestId(row(missionId(db, 'drink_water')))).toBeNull();
    // The archived match comes last, muted, with Restore.
    expect(screen.getByTestId('habits-archived')).toContainElement(screen.getByTestId(row(old)));
    expect(screen.getByTestId(`${row(old)}-restore`)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('habits-filter-habits'));
    expect(screen.getByTestId(row(run))).toBeOnTheScreen();
    expect(screen.queryByTestId(row(task))).toBeNull();
    expect(screen.queryByTestId(row(old))).toBeNull();

    await fireEvent.press(screen.getByTestId('habits-search-cancel'));
    expect(screen.getByTestId(row(missionId(db, 'drink_water')))).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Abitudini' })).toBeOnTheScreen();
  });

  it('offers «Crea “…”» with no result, which opens the editor with the name', async () => {
    const db = newGame(['drink_water']);
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-search-open'));
    await fireEvent.changeText(screen.getByTestId('habits-search'), ' Zumba ');

    expect(screen.getByTestId('habits-search-empty')).toHaveTextContent(
      /Nessun risultato per «Zumba»/,
    );
    await fireEvent.press(screen.getByTestId('habits-search-create'));
    expect(await screen.findByRole('header', { name: 'Nuova abitudine' })).toBeOnTheScreen();
    expect(screen.getByTestId('editor-name')).toHaveProp('value', 'Zumba');
    expect(screen.queryByTestId('editor-name-taken')).toBeNull();
  });

  it('remembers the filter when coming back to the screen', async () => {
    const db = newGame(['drink_water']);
    await openHabits(db);

    await fireEvent.press(screen.getByTestId('habits-filter-tasks'));
    await fireEvent.press(screen.getByTestId('tab-today'));
    await screen.findByTestId('today-screen');
    await fireEvent.press(screen.getByTestId('tab-habits'));
    await screen.findByTestId('habits-screen');

    expect(screen.getByTestId('habits-filter-tasks')).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(useHabitsUiStore.getState().filter).toBe('tasks');
  });
});

describe('Habits: pause', () => {
  const statusOf = (db: Db, id: string) =>
    db.select().from(missions).where(eq(missions.id, id)).get();

  async function openPause(id: string) {
    await openMenu(id);
    await fireEvent.press(screen.getByTestId('habits-menu-pause'));
    await waitForDialog();
  }

  it('pauses for a week by default: «In pausa» group, lock on the streak, «Riprendi» first', async () => {
    jest.useFakeTimers();
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    db.update(missions).set({ streak: 4 }).where(eq(missions.id, water)).run();
    await openHabits(db);

    await openPause(water);
    expect(screen.getByTestId('habits-pause')).toHaveTextContent(/Fino a quando\?/);
    expect(screen.getByTestId('habits-pause-7')).toHaveProp('accessibilityState', {
      checked: true,
    });
    await fireEvent.press(screen.getByTestId('habits-pause-confirm'));

    // Friday 6: paused 6–12, active again on the 13th.
    expect(statusOf(db, water)).toMatchObject({ status: 'paused', pausedUntil: '2026-11-13' });
    expect(screen.getByTestId('habits-category-paused')).toContainElement(
      screen.getByTestId(row(water)),
    );
    expect(screen.getByTestId(row(water))).toHaveTextContent(/In pausa fino al 12 novembre/);
    expect(
      screen.getByTestId(`${row(water)}-lock`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId(`${row(water)}-rate`)).toBeNull();
    expect(screen.getByTestId(`${row(water)}-body`)).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/In pausa fino al 12 novembre, .*serie 4 giorni congelata$/),
    );

    const body = screen.getByTestId(`${row(water)}-body`);
    expect(body.props.accessibilityActions[0].name).toBe('resume');
    await openMenu(water);
    await fireEvent.press(screen.getByTestId('habits-menu-resume'));
    expect(statusOf(db, water)).toMatchObject({ status: 'active', pausedUntil: null });
    expect(screen.queryByTestId('habits-category-paused')).toBeNull();
  });

  it('pauses without an end, or until a chosen date', async () => {
    jest.useFakeTimers();
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    const read = missionId(db, 'read_pages');
    await openHabits(db);

    await openPause(water);
    await fireEvent.press(screen.getByTestId('habits-pause-open'));
    await fireEvent.press(screen.getByTestId('habits-pause-confirm'));
    expect(statusOf(db, water)).toMatchObject({ status: 'paused', pausedUntil: null });
    expect(screen.getByTestId(row(water))).toHaveTextContent(/In pausa, senza data di fine/);

    await waitForDialog();
    await openPause(read);
    await fireEvent.press(screen.getByTestId('habits-pause-date'));
    await fireEvent(screen.getByTestId('habits-pause-picker'), 'change', {
      nativeEvent: { timestamp: new Date(2026, 10, 20, 12, 0).getTime(), utcOffset: 0 },
    });
    expect(screen.getByTestId('habits-pause-date')).toHaveTextContent('Fino al 20 novembre');
    await fireEvent.press(screen.getByTestId('habits-pause-confirm'));
    expect(statusOf(db, read)).toMatchObject({ status: 'paused', pausedUntil: '2026-11-21' });
    expect(screen.getByTestId(row(read))).toHaveTextContent(/In pausa fino al 20 novembre/);
  });

  it('brings the mission back by itself on the end day, with a notice in Today', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    pauseMission(db, water, '2026-11-09', clockAt(FRIDAY, 10));
    await openHabits(db, () => clockAt(9, 10));

    expect(screen.queryByTestId('habits-category-paused')).toBeNull();
    expect(screen.getByTestId('habits-category-health')).toContainElement(
      screen.getByTestId(row(water)),
    );

    await fireEvent.press(screen.getByTestId('tab-today'));
    await screen.findByTestId('today-screen');
    expect(screen.getByTestId('today-notice-resumed')).toHaveTextContent(
      /Pausa finita: «templates\.drink_water\.name» torna da oggi\./,
    );
    expect(screen.getByTestId(`today-mission-${water}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('today-notice-resumed-close'));
    expect(screen.queryByTestId('today-notice-resumed')).toBeNull();
  });
});

describe('Habits: reorder (design-sezioni.md 3.4, 3.11)', () => {
  function threeMissions() {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    const run = createMission(db, { name: 'Corsa', categoryKey: 'health' }, clockAt(FRIDAY, 9)).id;
    const think = createMission(db, { name: 'Medita', categoryKey: 'mind' }, clockAt(FRIDAY, 9)).id;
    return { db, water, run, think };
  }

  const order = (db: Db) =>
    db
      .select({ id: missions.id, categoryKey: missions.categoryKey })
      .from(missions)
      .orderBy(missions.sortOrder)
      .all();

  async function startReorder() {
    await fireEvent.press(screen.getByTestId('habits-more'));
    await fireEvent.press(screen.getByTestId('habits-more-menu-reorder'));
  }

  const moveBy = (id: string, actionName: 'moveUp' | 'moveDown') =>
    fireEvent(screen.getByTestId(`${row(id)}-body`), 'accessibilityAction', {
      nativeEvent: { actionName },
    });

  it('shows the handles and «Fine», and moves a row in the same category for the screen reader', async () => {
    const { db, water, run, think } = threeMissions();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await openHabits(db);
    await startReorder();

    expect(screen.getByTestId('habits-reorder-hint')).toBeOnTheScreen();
    expect(screen.getByTestId(`${row(water)}-reorder-handle`, hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('habits-filter-all')).toBeNull();
    // The first row cannot go up; the last one cannot go down.
    expect(
      screen
        .getByTestId(`${row(water)}-body`)
        .props.accessibilityActions.map((action: { name: string }) => action.name),
    ).toEqual(['moveDown']);
    expect(
      screen
        .getByTestId(`${row(think)}-body`)
        .props.accessibilityActions.map((action: { name: string }) => action.name),
    ).toEqual(['moveUp']);

    await moveBy(run, 'moveUp');

    expect(order(db).map((mission) => mission.id)).toEqual([run, water, think]);
    expect(announce).toHaveBeenCalledWith('Corsa: Salute, posizione 1 di 2');

    await fireEvent.press(screen.getByTestId('habits-reorder-done'));
    expect(screen.queryByTestId(`${row(water)}-reorder-handle`, hidden)).toBeNull();
    expect(screen.getByTestId('habits-filter-all')).toBeOnTheScreen();
    announce.mockRestore();
  });

  it('moves a row into another category, which changes its category', async () => {
    const { db, water, run, think } = threeMissions();
    await openHabits(db);
    await startReorder();

    await moveBy(run, 'moveDown');

    expect(order(db)).toEqual([
      { id: water, categoryKey: 'health' },
      { id: run, categoryKey: 'mind' },
      { id: think, categoryKey: 'mind' },
    ]);
    expect(screen.getByTestId('habits-category-mind')).toContainElement(
      screen.getByTestId(row(run)),
    );
  });

  it('moves a row by dragging its handle', async () => {
    const { db, water, run, think } = threeMissions();
    await openHabits(db);
    await startReorder();
    await fireEvent(screen.getByTestId(`${row(water)}-reorder`), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 64 } },
    });

    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${row(water)}-reorder-handle`), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 0 },
        { translationY: 70 },
        { state: State.END, translationY: 70 },
      ]);
    });

    expect(order(db).map((mission) => mission.id)).toEqual([run, water, think]);
  });

  it('uses the new order in Today for the missions without a time', async () => {
    const { db, water, run } = threeMissions();
    await openHabits(db);
    await startReorder();
    await moveBy(run, 'moveUp');
    await fireEvent.press(screen.getByTestId('habits-reorder-done'));

    await fireEvent.press(screen.getByTestId('tab-today'));
    await screen.findByTestId('today-screen');
    const ids = screen
      .getAllByTestId(new RegExp(`^today-mission-(${run}|${water})$`))
      .map((element) => element.props.testID as string);
    expect(ids.indexOf(`today-mission-${run}`)).toBeLessThan(ids.indexOf(`today-mission-${water}`));
  });
});

describe('Habits: swipe (design-sezioni.md 3.5)', () => {
  const swipe = (id: string) => `${row(id)}-swipe`;
  const translation = (
    jest.requireMock('react-native-gesture-handler/ReanimatedSwipeable') as {
      __translation: { value: number };
    }
  ).__translation;

  afterEach(() => {
    translation.value = 0;
  });

  it('archives at once with a long swipe to the left, with Undo', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);
    await fireEvent(screen.getByTestId(swipe(water)), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 64 } },
    });

    // A short swipe only shows the actions.
    translation.value = -120;
    await fireEvent(screen.getByTestId(swipe(water)), 'swipeableWillOpen', 'left');
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('active');

    translation.value = -300;
    await fireEvent(screen.getByTestId(swipe(water)), 'swipeableWillOpen', 'left');
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('archived');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Archiviata/);
    expect(screen.queryByTestId(row(water))).toBeNull();

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('active');
  });

  it('shows Pausa and Archivia to the left and Modifica to the right', async () => {
    const db = newGame(['drink_water', 'read_pages']);
    const water = missionId(db, 'drink_water');
    const read = missionId(db, 'read_pages');
    await openHabits(db);

    await fireEvent.press(screen.getByTestId(`${swipe(water)}-archive`, hidden));
    expect(db.select().from(missions).where(eq(missions.id, water)).get()?.status).toBe('archived');

    await fireEvent.press(screen.getByTestId(`${swipe(read)}-pause`, hidden));
    expect(screen.getByTestId('habits-pause-confirm')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId(swipe(read)), 'swipeableWillOpen', 'right');
    expect(screen).toHavePathnameWithParams(`/editor?missionId=${read}`);
  });
});
