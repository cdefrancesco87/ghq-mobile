import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { setSetting } from '@/db/repositories/settings';
import { missionDays } from '@/db/schema';
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
import Index from '../../../app/index';
import StatsRoute from '../../../app/stats';
import { at, clockAt, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  stats: StatsRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

/** Opens the app on `day` of November (past 30 in December) at 10 in Rome. */
async function open(db: Db, day: number, url = '/stats') {
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
  if (url === '/stats') {
    await screen.findByTestId('stats-screen');
  }
}

function markDays(
  db: Db,
  id: string,
  days: readonly GameDay[],
  status: 'done' | 'skipped' = 'done',
): void {
  db.insert(missionDays)
    .values(
      days.map((gameDay) => ({
        missionId: id,
        gameDay,
        status,
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

describe('Statistics', () => {
  it('opens from the streak of the hero card and goes back', async () => {
    await open(newGame(['journal']), 6, '/today');
    await fireEvent.press(await screen.findByTestId('today-hero-streak'));
    expect(await screen.findByTestId('stats-screen')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Statistiche' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('stats-header-back'));
    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
  });

  it('shows the summary with the positive comparisons', async () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    // Tuesday 17: 11 days in a row, 4 at the close of Monday 9; Monday 9 alone last week.
    markDays(db, journal, range('2026-11-06', '2026-11-17'));
    await open(db, 17);

    expect(text('stats-streak-value')).toBe('11');
    expect(text('stats-streak-note')).toBe('+7 rispetto alla settimana scorsa');
    expect(text('stats-record-value')).toBe('11');
    expect(screen.getByTestId('stats-record')).toHaveTextContent(/giorni di fila/);
    expect(text('stats-week-value')).toBe('2');
    // Monday 16 and Tuesday 17 against Monday 9 and Tuesday 10: no change, no line.
    expect(screen.queryByTestId('stats-week-note')).toBeNull();
    // 100% of the last 30 days, nothing to compare with before the hero.
    expect(text('stats-rate-value')).toBe('100%');
    expect(screen.queryByTestId('stats-rate-note')).toBeNull();
    expect(screen.getByLabelText('Serie: 11. +7 rispetto alla settimana scorsa')).toBeOnTheScreen();
  });

  it('shows a positive change of the week and of the 30 days', async () => {
    const db = newGame(['journal', 'meditation']);
    // Thursday 10 December. The 30 days before (6–10 November): 0 done of 10.
    // This week (Monday 7 – Thursday 10): 6 done; last week to Thursday 3: 1.
    markDays(db, missionId(db, 'journal'), ['2026-12-03', ...range('2026-12-07', '2026-12-09')]);
    markDays(db, missionId(db, 'meditation'), range('2026-12-07', '2026-12-09'));
    await open(db, 40);

    expect(text('stats-week-value')).toBe('6');
    expect(text('stats-week-note')).toBe('+5 abitudini');
    expect(text('stats-rate-note')).toMatch(/^\+\d+% rispetto ai 30 giorni prima$/);
  });

  it('hides a negative comparison', async () => {
    const db = newGame(['journal']);
    // Thursday 10 December: all done in the 30 days before (6–10 November), nothing since.
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-10'));
    await open(db, 40);

    expect(text('stats-rate-value')).toBe('0%');
    expect(screen.queryByTestId('stats-rate-note')).toBeNull();
    expect(screen.queryByTestId('stats-week-note')).toBeNull();
    expect(screen.queryByTestId('stats-streak-note')).toBeNull();
  });

  it('shows zeros and no trends in the first days', async () => {
    await open(newGame(['journal']), 6);

    expect(text('stats-streak-value')).toBe('0');
    expect(text('stats-week-value')).toBe('0');
    expect(text('stats-rate-value')).toBe('–');
    expect(screen.getByLabelText('Ultimi 30 giorni: nessun dato')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats-streak-note')).toBeNull();
    expect(text('stats-trends-empty')).toBe(
      "Completa qualche abitudine: tra qualche giorno vedrai l'andamento.",
    );
  });

  it('lists the missions from the least constant, by period', async () => {
    const db = newGame(['journal', 'meditation']);
    const journal = missionId(db, 'journal');
    const meditation = missionId(db, 'meditation');
    // Thursday 10 December. Journal all November, meditation only the last days.
    markDays(db, journal, range('2026-11-06', '2026-11-30'));
    markDays(db, meditation, range('2026-12-04', '2026-12-09'));
    await open(db, 40);

    const order = () =>
      screen
        .getAllByTestId(/^stats-trend-[^-]+(-[^-]+)*$/)
        .map((row) => String(row.props.testID))
        .filter((id) => !/-(rate|streak)$/.test(id));
    expect(screen.getByText('Andamento · abitudini')).toBeOnTheScreen();
    expect(order()).toEqual([`stats-trend-${journal}`, `stats-trend-${meditation}`]);
    expect(text(`stats-trend-${journal}-rate`)).toBe('0%');
    expect(screen.getByTestId(`stats-trend-${meditation}`)).toHaveAccessibleName(
      /100% nel periodo\. Tocca due volte per aprire il dettaglio$/,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Mese' }));
    expect(order()).toEqual([`stats-trend-${meditation}`, `stats-trend-${journal}`]);

    await fireEvent.press(screen.getByTestId(`stats-trend-${journal}`));
    expect(screen).toHavePathnameWithParams(`/stats?missionId=${journal}`);
  });

  it('has the Log as a placeholder', async () => {
    await open(newGame(['journal']), 6);
    await fireEvent.press(screen.getByRole('radio', { name: 'Registro' }));
    expect(screen.getByText('Il Registro arriverà presto.')).toBeOnTheScreen();
    expect(screen.queryByTestId('stats-summary')).toBeNull();
  });

  it('takes the names of the theme', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'theme', 'arcade', at(6, 9));
    await open(db, 6);

    expect(screen.getByRole('header', { name: 'HIGH SCORE' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Combo: 0')).toBeOnTheScreen();
  });

  it('puts the summary in one column with very large text', async () => {
    await open(newGame(['journal']), 6);
    expect(screen.getByTestId('stats-summary').children).toHaveLength(2);

    await setFontScale(1.3);
    expect(screen.getByTestId('stats-summary').children).toHaveLength(4);
  });
});

describe('Statistics: heatmap', () => {
  const has = (id: string) => expect(screen.getByTestId(id)).toBeOnTheScreen();

  it('colours the days in four levels and leaves empty a day without missions', async () => {
    const db = newGame(['journal', 'meditation', 'read_pages', 'no_social_evening']);
    setSetting(db, 'rest_days', [7], at(6, 9));
    const [journal, meditation, read, social] = [
      'journal',
      'meditation',
      'read_pages',
      'no_social_evening',
    ].map((key) => missionId(db, key));
    // Friday 6: nothing; Saturday 7: 1 of 4; Sunday 8: rest; Monday 9: 2 of 4; Tuesday 10: all.
    markDays(db, journal, ['2026-11-07', '2026-11-09', '2026-11-10']);
    markDays(db, meditation, ['2026-11-09', '2026-11-10']);
    markDays(db, read, ['2026-11-10']);
    markDays(db, social, ['2026-11-10']);
    await open(db, 11);

    has('stats-heatmap-2026-11-06-0');
    has('stats-heatmap-2026-11-07-1');
    has('stats-heatmap-2026-11-08-empty');
    has('stats-heatmap-2026-11-09-2');
    has('stats-heatmap-2026-11-10-3');
    // Today, nothing done yet; before the hero, outside.
    has('stats-heatmap-2026-11-11-0');
    has('stats-heatmap-2026-11-05-out');
    expect(text('stats-heatmap-caption')).toBe('Ultimi 12 mesi');
  });

  it('says that the days will come in the first days', async () => {
    await open(newGame(['journal']), 6);
    expect(text('stats-heatmap-caption')).toBe('I tuoi giorni compariranno qui.');
  });

  it('opens the sheet of a day with its missions, skipped ones out of the total', async () => {
    const db = newGame(['journal', 'meditation', 'read_pages']);
    const [journal, meditation, read] = ['journal', 'meditation', 'read_pages'].map((key) =>
      missionId(db, key),
    );
    // Saturday 7: journal done, meditation skipped, reading missed.
    markDays(db, journal, ['2026-11-07']);
    markDays(db, meditation, ['2026-11-07'], 'skipped');
    await open(db, 9);

    has('stats-heatmap-2026-11-07-2');
    await fireEvent.press(screen.getByTestId('stats-heatmap-2026-11-07'));
    expect(await screen.findByText('Sabato 7 novembre')).toBeOnTheScreen();
    expect(text('stats-day-count')).toBe('1 abitudine su 2 · 50%');
    has(`stats-day-${journal}-done`);
    has(`stats-day-${meditation}-skipped`);
    has(`stats-day-${read}-missed`);
    expect(screen.getByTestId(`stats-day-${read}-missed`)).toHaveAccessibleName(/: mancato$/);
  });

  it('reads the heatmap by week and reaches a day with the actions', async () => {
    const db = newGame(['journal']);
    // Week of Monday 2: the hero exists from Friday 6, all done on 6, 7 and 8.
    markDays(db, missionId(db, 'journal'), range('2026-11-06', '2026-11-08'));
    await open(db, 10);

    const week = screen.getByTestId('stats-heatmap-week-2026-11-02');
    expect(week).toHaveAccessibleName('Settimana del 2 novembre: tutto fatto in 3 giorni su 3');
    expect(week.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(week.props.accessibilityActions[1].label).toBe('sabato 7 novembre: tutto fatto');
    await fireEvent(week, 'accessibilityAction', { nativeEvent: { actionName: '2026-11-08' } });
    expect(await screen.findByText('Domenica 8 novembre')).toBeOnTheScreen();
    expect(text('stats-day-count')).toBe('1 abitudine su 1 · 100%');
  });

  it('shows today with the missions still to do', async () => {
    const db = newGame(['journal', 'meditation']);
    markDays(db, missionId(db, 'journal'), ['2026-11-06']);
    await open(db, 6);

    has('stats-heatmap-2026-11-06-2');
    await fireEvent.press(screen.getByTestId('stats-heatmap-2026-11-06'));
    expect(await screen.findByText('Venerdì 6 novembre')).toBeOnTheScreen();
    has(`stats-day-${missionId(db, 'meditation')}-open`);
  });
});
