import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { AccessibilityInfo } from 'react-native';

import { completeMission } from '@/db/repositories/completion';
import { startPause } from '@/db/repositories/pause';
import { getSetting, setSetting } from '@/db/repositories/settings';
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
import { FRIDAY, clockAt, missionId, newGame, withBadgesUnlocked } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const SATURDAY = FRIDAY + 1;

async function openToday(db: Db, day: number) {
  useAppStore.getState().reset();
  withBadgesUnlocked(db);
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(day, 10) });
  const i18n = await createI18n('it');
  const rendered = await renderRouter(
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
  return rendered;
}

/** Two daily missions, one of them done on Friday. */
function halfDoneFriday(): Db {
  const db = newGame(['journal', 'meditation']);
  completeMission(db, {
    missionId: missionId(db, 'journal'),
    source: 'app',
    ...clockAt(FRIDAY, 12),
  });
  return db;
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

const TEXT = 'Ieri 1 su 2. Ogni passo conta. Iniziamo da una cosa piccola?';

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

describe('Today: morning bubble of the companion (design 6.14)', () => {
  it('stays away on the first day of use', async () => {
    const db = newGame(['journal']);
    await openToday(db, FRIDAY);
    expect(screen.queryByTestId('today-tale')).toBeNull();
    expect(getSetting(db, 'tale').last_open_day).toBe('2026-11-06');
  });

  it('tells yesterday under the hero card, the numbers in bold, read as «Cloudy dice: …»', async () => {
    await openToday(halfDoneFriday(), SATURDAY);
    const bubble = screen.getByTestId('today-tale');
    expect(bubble.props.accessibilityLabel).toBe(`Cloudy dice: ${TEXT}`);
    expect(screen.getByTestId('today-tale-text')).toHaveTextContent(TEXT);
    expect(within(screen.getByTestId('today-tale-text')).getByText('1 su 2')).toBeTruthy();
    // Under the hero card and before the plan of the day.
    expect(treeOrder(['today-hero', 'today-tale', 'today-plan'])).toEqual([
      'today-hero',
      'today-tale',
      'today-plan',
    ]);
  });

  it('closes with the X and does not come back until tomorrow', async () => {
    const db = halfDoneFriday();
    const first = await openToday(db, SATURDAY);
    await fireEvent.press(screen.getByTestId('today-tale-close'));
    expect(screen.queryByTestId('today-tale')).toBeNull();
    // The app opened again the same day, then the next day.
    first.unmount();
    const second = await openToday(db, SATURDAY);
    expect(screen.queryByTestId('today-tale')).toBeNull();
    second.unmount();
    await openToday(db, SATURDAY + 1);
    expect(screen.getByTestId('today-tale')).toBeTruthy();
  });

  it('closes with a touch anywhere on the bubble', async () => {
    await openToday(halfDoneFriday(), SATURDAY);
    await fireEvent.press(screen.getByTestId('today-tale'));
    expect(screen.queryByTestId('today-tale')).toBeNull();
  });

  it('stays away during the general pause', async () => {
    const db = halfDoneFriday();
    startPause(db, { fromDay: '2026-11-07', untilDay: null }, clockAt(FRIDAY, 13));
    await openToday(db, SATURDAY);
    expect(screen.queryByTestId('today-tale')).toBeNull();
    expect(getSetting(db, 'tale').last_open_day).toBe('2026-11-07');
  });

  it('speaks with the voice of the theme', async () => {
    const db = halfDoneFriday();
    setSetting(db, 'theme', 'arcade', clockAt(FRIDAY, 13).now);
    await openToday(db, SATURDAY);
    expect(screen.getByTestId('today-tale-text')).toHaveTextContent(`Bip! ${TEXT}`);
    expect(screen.getByTestId('today-tale').props.accessibilityLabel).toBe(
      `Pixel dice: Bip! ${TEXT}`,
    );
  });
});
