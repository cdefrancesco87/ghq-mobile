import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { completeMission, progressMission } from '@/db/repositories/completion';
import {
  createMission,
  deleteMission,
  getMission,
  updateMission,
} from '@/db/repositories/missions';
import { missionDays, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
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
import StatsRoute from '../../../app/stats';
import { clockAt, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  stats: StatsRoute,
  editor: Editor,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

/** Opens the app on `day` of November (past 30 in December) at 10 in Rome. */
async function open(db: Db, day: number, url: string) {
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
    { initialUrl: url },
  );
}

async function openDetail(db: Db, id: string, day: number) {
  await open(db, day, `/stats?missionId=${id}`);
  await screen.findByTestId('mission-detail');
}

function markDays(
  db: Db,
  id: string,
  days: readonly GameDay[],
  status: 'done' | 'partial' | 'skipped' = 'done',
  value: number | null = null,
): void {
  db.insert(missionDays)
    .values(
      days.map((gameDay) => ({
        missionId: id,
        gameDay,
        status,
        value,
        source: 'app' as const,
        doneAt: 0,
        updatedAt: 0,
      })),
    )
    .run();
}

function range(from: GameDay, to: GameDay): GameDay[] {
  const days: GameDay[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const text = (id: string) => screen.getByTestId(id).props.children as string;

/** A column of a chart: hidden from the screen reader, which reads the table instead. */
const column = (chart: string, index: number) =>
  screen.getByTestId(`${chart}-column-${index}`, { includeHiddenElements: true });

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
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('Mission detail', () => {
  it('opens from the trends of Statistics with name, frequency, difficulty and Modifica', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    const name = getMission(db, id)!.name;
    markDays(db, id, range('2026-11-20', '2026-11-25'));
    await open(db, 26, '/stats');
    await fireEvent.press(await screen.findByTestId(`stats-trend-${id}`));

    expect(await screen.findByTestId('mission-detail')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name })).toBeOnTheScreen();
    expect(text('mission-detail-frequency')).toBe('Ogni giorno');
    expect(screen.getByTestId('mission-detail-difficulty')).toHaveTextContent(/Facile/);

    await fireEvent.press(screen.getByTestId('mission-detail-edit'));
    expect(screen).toHavePathnameWithParams(`/editor?missionId=${id}`);
  });

  it('shows streak, record and the rate of the period, and the days of the week', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    db.update(missions).set({ streak: 1, streakBest: 8 }).where(eq(missions.id, id)).run();
    // Friday 20 … Tuesday 24 done, Wednesday 25 skipped.
    markDays(db, id, range('2026-11-20', '2026-11-24'));
    markDays(db, id, ['2026-11-25'], 'skipped');
    await openDetail(db, id, 26);

    const streak = getMission(db, id)!.streak;
    expect(text('mission-detail-streak-value')).toBe(String(streak));
    expect(text('mission-detail-record-value')).toBe('8');
    expect(screen.getByTestId('mission-detail-record')).toHaveTextContent(/giorni di fila/);
    expect(text('mission-detail-rate-value')).toBe('100%');
    expect(screen.getByLabelText('Ultimi 7 giorni: 100%')).toBeOnTheScreen();

    expect(screen.getByTestId('mission-detail-days-2026-11-20-done')).toBeOnTheScreen();
    expect(screen.getByTestId('mission-detail-days-2026-11-25-skipped')).toBeOnTheScreen();
    expect(screen.getByTestId('mission-detail-days-2026-11-26-open')).toBeOnTheScreen();
    expect(screen.getByLabelText('mercoledì 25 novembre: saltato')).toBeOnTheScreen();
    // A simple mission has no chart of values.
    expect(screen.queryByTestId('mission-detail-values-card')).toBeNull();
  });

  it('changes the period: rates by week in Mese, by month in Anno, with the exact value on tap', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, range('2026-11-09', '2026-11-15'));
    await openDetail(db, id, 26);

    await fireEvent.press(screen.getByRole('radio', { name: 'Mese' }));
    expect(screen.queryByTestId('mission-detail-days')).toBeNull();
    expect(screen.getByText('Percentuale per settimana')).toBeOnTheScreen();
    expect(text('mission-detail-rate-value')).toBe(String(Math.floor((7 / 20) * 100)) + '%');
    expect(screen.getByLabelText('Ultimi 30 giorni: 35%')).toBeOnTheScreen();
    // Weeks of 2, 9, 16 and 23 November: the second one all done.
    await fireEvent.press(column('mission-detail-rates', 2));
    expect(text('mission-detail-rates-selected')).toBe('settimana del 9 novembre: 100%');

    await fireEvent.press(screen.getByRole('radio', { name: 'Anno' }));
    expect(screen.getByText('Percentuale per mese')).toBeOnTheScreen();
    await fireEvent.press(column('mission-detail-rates', 10));
    expect(text('mission-detail-rates-selected')).toBe('ottobre 2026: –');
  });

  it('describes the chart for the screen reader and opens the table of the values', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, range('2026-11-09', '2026-11-15'));
    await openDetail(db, id, 26);
    await fireEvent.press(screen.getByRole('radio', { name: 'Mese' }));

    expect(screen.getByTestId('mission-detail-rates-graph')).toHaveAccessibleName(
      "Percentuale per settimana. Dal primo all'ultimo: da 0% a 0%; minimo 0%, massimo 100%.",
    );
    expect(screen.queryByTestId('mission-detail-rates-list')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mostra i valori' }));
    const list = screen.getByTestId('mission-detail-rates-list');
    expect(within(list).getByLabelText('settimana del 9 novembre: 100%')).toBeOnTheScreen();
    expect(within(list).getByLabelText('settimana del 26 ottobre: –')).toBeOnTheScreen();
  });

  it('shows the values of a measurable mission against its goal', async () => {
    const db = newGame(['drink_water']);
    const id = missionId(db, 'drink_water');
    markDays(db, id, ['2026-11-20'], 'done', 2);
    markDays(db, id, ['2026-11-22'], 'partial', 1.25);
    progressMission(db, { missionId: id, source: 'app', ...clockAt(26, 9) });
    await openDetail(db, id, 26);

    expect(screen.getByText('Valore di ogni giorno')).toBeOnTheScreen();
    expect(screen.getByTestId('mission-detail-values-goal')).toBeOnTheScreen();
    // 2, 1,25 and 0,25 of today.
    expect(text('mission-detail-average')).toBe('Media: 1,17 L al giorno · obiettivo 2 L');
    expect(screen.getByTestId('mission-detail-history-0')).toHaveAccessibleName(
      'Oggi. Avanzamento: 0,25 L',
    );
    expect(screen.getByTestId('mission-detail-values-graph')).toHaveAccessibleName(
      /^Valore di ogni giorno\. .*massimo 2 L\. Obiettivo: 2 L\.$/,
    );
    await fireEvent.press(column('mission-detail-values', 2));
    expect(text('mission-detail-values-selected')).toBe('domenica 22 novembre: 1,25 L');

    await fireEvent.press(screen.getByRole('radio', { name: 'Anno' }));
    expect(screen.getByText('Media di ogni mese')).toBeOnTheScreen();
  });

  it('lists the history and the notes', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    updateMission(db, id, { notes: 'Prima di dormire' }, clockAt(6, 10));
    completeMission(db, { missionId: id, source: 'app', ...clockAt(25, 10) });
    completeMission(db, { missionId: id, source: 'app', ...clockAt(26, 10) });
    await openDetail(db, id, 26);

    expect(screen.getByTestId('mission-detail-history-0')).toHaveAccessibleName(
      /^Oggi\. Completamento\. \+\d+ XP · \+\d+ monete$/,
    );
    expect(screen.getByTestId('mission-detail-history-1')).toHaveAccessibleName(/^Ieri\./);
    expect(text('mission-detail-notes')).toBe('Prima di dormire');
  });

  it('has no history nor notes at the start', async () => {
    const db = newGame(['journal']);
    await openDetail(db, missionId(db, 'journal'), 6);
    expect(screen.getByTestId('mission-detail-history-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('mission-detail-notes')).toBeNull();
    expect(text('mission-detail-rate-value')).toBe('–');
  });

  it('turns the charts into lists with very large text', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    markDays(db, id, range('2026-11-09', '2026-11-15'));
    await openDetail(db, id, 26);
    expect(screen.getByTestId('mission-detail-tiles')).toHaveStyle({ flexDirection: 'row' });

    await setFontScale(1.3);
    expect(screen.getByTestId('mission-detail-tiles')).not.toHaveStyle({ flexDirection: 'row' });
    expect(screen.getByTestId('mission-detail-days-list')).toBeOnTheScreen();
    expect(screen.getByLabelText('giovedì 26 novembre: da fare')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('mission-detail-period-month'));
    expect(screen.queryByTestId('mission-detail-rates-graph')).toBeNull();
    expect(screen.getByLabelText('settimana del 9 novembre: 100%')).toBeOnTheScreen();
  });

  it('shows a task with its rate only', async () => {
    const db = newGame(['journal']);
    const task = createMission(
      db,
      { name: 'Dentista', kind: 'task', dueDay: '2026-11-07' },
      clockAt(6, 9),
    ).id;
    await openDetail(db, task, 8);
    expect(text('mission-detail-rate-value')).toBe('0%');
    expect(screen.queryByTestId('mission-detail-streak')).toBeNull();
    expect(screen.queryByTestId('mission-detail-period')).toBeNull();
    expect(screen.queryByTestId('mission-detail-chart-card')).toBeNull();
  });

  it('shows a deleted mission as gone', async () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    deleteMission(db, id, clockAt(8, 9));
    await open(db, 8, `/stats?missionId=${id}`);
    expect(await screen.findByTestId('mission-detail-gone')).toBeOnTheScreen();
  });
});
