import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import { completeMission } from '@/db/repositories/completion';
import { archiveMission, createMission, deleteMission } from '@/db/repositories/missions';
import { missionDays, missions } from '@/db/schema';
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

  it('offers the same actions to the screen reader', async () => {
    const db = newGame(['drink_water']);
    const water = missionId(db, 'drink_water');
    await openHabits(db);

    const body = screen.getByTestId(`${row(water)}-body`);
    expect(body.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      'edit',
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
