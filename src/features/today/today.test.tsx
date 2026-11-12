import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { deleteMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { daySummaries, hero } from '@/db/schema';
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
import Companion from '../../../app/companion';
import Editor from '../../../app/editor';
import Index from '../../../app/index';
import Shop from '../../../app/shop';
import Stats from '../../../app/stats';
import { FRIDAY, at, clockAt, missionId, newGame } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  companion: Companion,
  shop: Shop,
  editor: Editor,
  stats: Stats,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function openToday(db: Db) {
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

async function setFontScale(fontScale: number) {
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale },
      screen: { width: 390, height: 844, scale: 3, fontScale },
    });
  });
}

/** The test ids among `ids` in the order of the tree, the order of the screen reader. */
function treeOrder(ids: readonly string[]): string[] {
  const found: string[] = [];
  const visit = (node: unknown) => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const element = node as { props?: { testID?: string }; children?: unknown };
    const id = element.props?.testID;
    if (id !== undefined && ids.includes(id) && !found.includes(id)) {
      found.push(id);
    }
    visit(element.children);
  };
  visit(screen.toJSON());
  return found;
}

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

afterEach(async () => {
  await setFontScale(1);
});

describe('Today: header and hero card', () => {
  it('shows date, greeting, progress and the hero with bars, streak and coins', async () => {
    await openToday(newGame(['meditation', 'read_pages']));

    expect(screen.getByTestId('today-date')).toHaveTextContent('Venerdì 6 novembre');
    expect(screen.getByRole('header', { name: 'Ciao, Claudio' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Fatte 0 di 2')).toBeOnTheScreen();
    expect(screen.getByTestId('today-hero-level')).toHaveTextContent('Livello 1');
    expect(screen.getByLabelText('Energia 50 su 50')).toBeOnTheScreen();
    expect(screen.getByLabelText('XP 0 su 200')).toBeOnTheScreen();
    expect(screen.getByLabelText('Serie: 0 giorni. Apri le statistiche')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 Monete. Apri il negozio')).toBeOnTheScreen();
    // Minimal keeps the game in the background: no name and title in the card.
    expect(screen.queryByTestId('today-hero-title')).toBeNull();
  });

  it('shows name and title of the hero in a game theme', async () => {
    const db = newGame(['meditation']);
    setSetting(db, 'theme', 'fantasy', at(FRIDAY, 9));
    await openToday(db);

    expect(screen.getByTestId('today-hero-name')).toHaveTextContent('Claudio');
    expect(screen.getByTestId('today-hero-title')).toHaveTextContent('Scudiero');
  });

  it('reads date and greeting, then level, health, experience, streak and coins', async () => {
    await openToday(newGame(['meditation']));

    expect(
      treeOrder([
        'today-date',
        'today-greeting',
        'today-hero-level',
        'today-hero-hp',
        'today-hero-xp',
        'today-hero-streak',
        'today-hero-coins',
      ]),
    ).toEqual([
      'today-date',
      'today-greeting',
      'today-hero-level',
      'today-hero-hp',
      'today-hero-xp',
      'today-hero-streak',
      'today-hero-coins',
    ]);
  });

  it.each([
    ['today-hero-streak', 'Statistiche'],
    ['today-hero-coins', 'Negozio'],
    ['today-hero-companion', 'Compagno'],
  ])('opens a screen from %s', async (testID, title) => {
    await openToday(newGame(['meditation']));

    await fireEvent.press(screen.getByTestId(testID));

    expect(await screen.findByRole('header', { name: title })).toBeOnTheScreen();
  });

  it('shows the band of the exhausted hero', async () => {
    const db = newGame(['meditation']);
    db.update(hero).set({ exhaustedDay: '2026-11-06' }).run();
    await openToday(db);

    // «In recupero» is the Minimal word for exhausted.
    expect(screen.getByTestId('today-hero-exhausted')).toHaveTextContent(
      'In recupero: XP dimezzati fino a domani',
    );
  });

  it('puts the bars one under the other and the streak beside the coins with very large text', async () => {
    await setFontScale(1.3);
    await openToday(newGame(['meditation']));

    expect(screen.queryByTestId('today-hero-streak-corner')).toBeNull();
    expect(screen.getByTestId('today-hero-streak')).toBeOnTheScreen();
  });
});

describe('Today: thin bar while scrolling', () => {
  // The thin bar repeats the hero card, so it is hidden from the screen reader.
  const hidden = { includeHiddenElements: true };

  async function scrollTo(y: number) {
    await fireEvent.scroll(screen.getByTestId('today-scroll'), {
      nativeEvent: {
        contentOffset: { x: 0, y },
        contentSize: { width: 390, height: 2000 },
        layoutMeasurement: { width: 390, height: 844 },
      },
    });
  }

  async function openScrollable() {
    await openToday(newGame(['meditation']));
    await fireEvent(screen.getByTestId('today-hero-slot'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 120, width: 358, height: 180 } },
    });
  }

  it('takes the place of the hero card once it has scrolled away', async () => {
    await openScrollable();
    expect(screen.queryByTestId('today-sticky', hidden)).toBeNull();

    await scrollTo(400);
    expect(screen.getByTestId('today-sticky', hidden)).toHaveTextContent(/Lv 1/);
    expect(screen.getByTestId('today-sticky-hp', hidden)).toBeTruthy();
    expect(screen.getByTestId('today-sticky-xp', hidden)).toBeTruthy();

    await scrollTo(0);
    expect(screen.queryByTestId('today-sticky', hidden)).toBeNull();
  });

  it('shows only the level with very large text', async () => {
    await setFontScale(1.3);
    await openScrollable();

    await scrollTo(400);

    expect(screen.getByTestId('today-sticky', hidden)).toHaveTextContent(/Lv 1/);
    expect(screen.queryByTestId('today-sticky-hp', hidden)).toBeNull();
  });
});

describe('Today: particular states', () => {
  it('shows the notice of the shield used yesterday, which can be closed', async () => {
    const db = newGame(['meditation']);
    db.insert(daySummaries)
      .values({
        gameDay: '2026-11-05',
        scheduledCount: 1,
        doneCount: 0,
        scheduledXp: 15,
        missedXp: 15,
        hpLost: 0,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: true,
        closedAt: at(FRIDAY, 6),
      })
      .run();
    await openToday(db);

    expect(screen.getByText('Lo scudo ha protetto la tua serie ieri.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Chiudi'));

    expect(screen.queryByTestId('today-notice-shield')).toBeNull();
  });

  it('shows the rest day without actions', async () => {
    const db = newGame(['meditation']);
    setSetting(db, 'rest_days', [5], at(FRIDAY, 9));
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Giorno di riposo' })).toBeOnTheScreen();
    expect(screen.queryByTestId('today-rest-action')).toBeNull();
    expect(screen.queryByTestId('today-progress')).toBeNull();
  });

  it('offers to create a mission when the day has none', async () => {
    const db = newGame(['meditation']);
    deleteMission(db, missionId(db, 'meditation'), clockAt(FRIDAY, 9));
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Nessuna missione' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('today-empty-action'));

    expect(await screen.findByRole('header', { name: 'Editor missione' })).toBeOnTheScreen();
  });
});
