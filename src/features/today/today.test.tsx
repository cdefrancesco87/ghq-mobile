import { and, asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions, StyleSheet } from 'react-native';

import { archiveBoss, completeBossStep, createBoss } from '@/db/repositories/boss';
import { setDayPlan } from '@/db/repositories/completion';
import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { createMission, deleteMission, getMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { buyItem } from '@/db/repositories/shop';
import {
  boss,
  bossSteps,
  companion,
  dayPlan,
  daySummaries,
  events,
  hero,
  missionDays,
  missionReminders,
} from '@/db/schema';
import type { Db } from '@/db/types';
import { MOMENT_MAX_MS } from '@/features/shared/MomentQueue';
import { UNDO_TOAST_MS } from '@/features/shared/UndoToast';
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
import {
  FRIDAY,
  TZ,
  at,
  clockAt,
  expectHeroMatchesLog,
  missionId,
  newGame,
} from '../../../test/game';

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

async function openToday(db: Db, clock = () => clockAt(FRIDAY, 10)) {
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
    ['today-hero-companion', 'Cloudy'],
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

    expect(await screen.findByRole('header', { name: 'Nuova abitudine' })).toBeOnTheScreen();
  });
});

describe('Today: missions and completion', () => {
  const hidden = { includeHiddenElements: true };
  const heroRow = (db: Db) => db.select().from(hero).get();
  const row = (id: string) => `today-mission-${id}`;

  async function completeFromScreen(id: string) {
    await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
  }

  async function openMenu(id: string) {
    await fireEvent(screen.getByTestId(`${row(id)}-body`), 'longPress');
  }

  /** Coins earned before the test, written in the log like every gain. */
  function giveCoins(db: Db, coins: number) {
    const change = changeHero(db, { coins }, at(FRIDAY, 9));
    appendEvent(db, {
      type: 'bonus.plan',
      occurredAt: at(FRIDAY, 9),
      tzOffset: TZ,
      source: 'system',
      gameDay: '2026-11-05',
      deltas: change.deltas,
    });
  }

  it('lists the overdue tasks, then the missions by time, then the others', async () => {
    const db = newGame(['read_pages', 'journal'], FRIDAY - 2);
    const pages = missionId(db, 'read_pages');
    const journal = missionId(db, 'journal');
    db.insert(missionReminders).values({ id: 'r1', missionId: journal, time: '21:00' }).run();
    const task = createMission(
      db,
      { name: 'Chiama il dentista', kind: 'task', difficulty: 'easy', dueDay: '2026-11-05' },
      clockAt(FRIDAY - 2, 10),
    );
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Abitudini di oggi' })).toBeOnTheScreen();
    expect(screen.getByTestId('today-missions-count', hidden)).toHaveTextContent('0 di 3');
    expect(treeOrder([row(pages), row(journal), row(task.id)])).toEqual([
      row(task.id),
      row(journal),
      row(pages),
    ]);
    expect(screen.getByTestId(`${row(task.id)}-warning`)).toHaveTextContent('Scaduta ieri');
    expect(screen.getByTestId(row(journal))).toHaveTextContent(/21:00/);
  });

  it('completes a mission with a touch: gains in the database and in the store, celebration, notice', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    await openToday(db);

    await completeFromScreen(journal);

    expect(heroRow(db)).toMatchObject({ xpTotal: 10, coins: 2 });
    expect(useHeroStore.getState().hero).toMatchObject({ xpTotal: 10, coins: 2 });
    expect(db.select().from(missionDays).get()).toMatchObject({ status: 'done', source: 'app' });
    expect(screen.getByLabelText(/completata, più 10 XP e 2 Monete$/)).toBeOnTheScreen();
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Fatto/);
    expect(screen.getByLabelText('Fatte 1 di 2')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fatte (1)', expanded: true })).toBeOnTheScreen();
    expect(screen.getByTestId(row(journal))).toHaveTextContent(/fatta alle 10:00/);
    expectHeroMatchesLog(db);
  });

  it('closes and opens again the group of the done missions', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    await openToday(db);
    await completeFromScreen(journal);

    await fireEvent.press(screen.getByTestId('today-done-toggle'));
    expect(screen.queryByTestId(row(journal))).toBeNull();

    await fireEvent.press(screen.getByTestId('today-done-toggle'));
    expect(screen.getByTestId(row(journal))).toBeOnTheScreen();
  });

  it('undoes the completion from the notice', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    await openToday(db);
    await completeFromScreen(journal);

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(heroRow(db)).toMatchObject({ xpTotal: 0, coins: 0 });
    expect(useHeroStore.getState().hero).toMatchObject({ xpTotal: 0, coins: 0 });
    expect(screen.queryByTestId('today-done-toggle')).toBeNull();
    expect(screen.getByTestId(`${row(journal)}-control`)).toBeOnTheScreen();
    expectHeroMatchesLog(db);
  });

  it('hides the notice after 5 seconds, then undoes from the menu of the row', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    await openToday(db);
    jest.useFakeTimers();
    try {
      await completeFromScreen(journal);
      await act(async () => {
        jest.advanceTimersByTime(UNDO_TOAST_MS);
      });
      expect(screen.queryByTestId('undo-toast')).toBeNull();
    } finally {
      jest.useRealTimers();
    }

    await openMenu(journal);
    expect(screen.queryByTestId('today-mission-menu-plan')).toBeNull();
    await fireEvent.press(screen.getByTestId('today-mission-menu-undo'));

    expect(heroRow(db)).toMatchObject({ xpTotal: 0, coins: 0 });
    expect(screen.getByTestId(`${row(journal)}-control`)).toBeOnTheScreen();
    expectHeroMatchesLog(db);
  });

  it('refuses the undo after the day change, with a clear message', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    let clock = clockAt(FRIDAY, 10);
    await openToday(db, () => clock);
    await completeFromScreen(journal);

    clock = clockAt(FRIDAY + 1, 7);
    await openMenu(journal);
    await fireEvent.press(screen.getByTestId('today-mission-menu-undo'));

    expect(screen.getByTestId('undo-toast')).toHaveTextContent(
      'La giornata è cambiata: il completamento non si può più annullare.',
    );
    expect(heroRow(db)).toMatchObject({ xpTotal: 10 });
    expectHeroMatchesLog(db);
  });

  it('refuses the undo when the coins of the completion are already spent', async () => {
    const db = newGame(['journal', 'read_pages']);
    const journal = missionId(db, 'journal');
    giveCoins(db, 48);
    await openToday(db);
    await completeFromScreen(journal);
    buyItem(db, 'potion', clockAt(FRIDAY, 11));

    await openMenu(journal);
    await fireEvent.press(screen.getByTestId('today-mission-menu-undo'));

    expect(screen.getByTestId('undo-toast')).toHaveTextContent(
      'Le monete di questo completamento sono già state spese: non si può annullare.',
    );
    expect(heroRow(db)).toMatchObject({ xpTotal: 10, coins: 0 });
    expectHeroMatchesLog(db);
  });

  it('adds a mission to the priorities from the menu of the row', async () => {
    const db = newGame(['journal', 'read_pages']);
    const pages = missionId(db, 'read_pages');
    await openToday(db);

    await openMenu(pages);
    expect(screen.queryByTestId('today-mission-menu-undo')).toBeNull();
    await fireEvent.press(screen.getByTestId('today-mission-menu-plan'));

    expect(db.select().from(dayPlan).all()).toEqual([
      { gameDay: '2026-11-06', missionId: pages, position: 0 },
    ]);
  });

  it('opens the detail of the mission from its name', async () => {
    const db = newGame(['journal', 'read_pages']);
    const pages = missionId(db, 'read_pages');
    await openToday(db);

    await fireEvent.press(screen.getByTestId(`${row(pages)}-body`));
    expect(await screen.findByTestId('mission-detail')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: getMission(db, pages)!.name })).toBeOnTheScreen();
  });

  it('opens the editor from the menu of the row', async () => {
    const db = newGame(['journal', 'read_pages']);
    const pages = missionId(db, 'read_pages');
    await openToday(db);

    await openMenu(pages);
    await fireEvent.press(screen.getByTestId('today-mission-menu-edit'));

    expect(await screen.findByRole('header', { name: 'Modifica abitudine' })).toBeOnTheScreen();
    expect(screen.getByTestId('editor-name')).toHaveProp('value', 'templates.read_pages.name');
  });

  it('shows the level-up moment when the completion takes the hero to the next level', async () => {
    const db = newGame(['journal', 'read_pages']);
    db.update(hero).set({ xpInLevel: 195, xpTotal: 195 }).run();
    await openToday(db);

    await completeFromScreen(missionId(db, 'journal'));

    expect(await screen.findByTestId('moment-level_up')).toBeOnTheScreen();
  });
});

describe('Today: plan of the day', () => {
  const hidden = { includeHiddenElements: true };
  const heroRow = (db: Db) => db.select().from(hero).get();
  const planRow = (id: string) => `today-plan-${id}`;
  const listRow = (id: string) => `today-mission-${id}`;
  const planIds = (db: Db) =>
    db
      .select()
      .from(dayPlan)
      .all()
      .map((item) => item.missionId);

  it('explains the empty plan, then adds a priority from the sheet', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    const meal = missionId(db, 'healthy_meal');
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Priorità' })).toBeOnTheScreen();
    expect(screen.getByTestId('today-plan-intro')).toHaveTextContent(
      'Scegli fino a 3 priorità da cui iniziare: completarle tutte vale +25 XP.',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Scegli una priorità' }));
    expect(screen.getByTestId('today-plan-picker-confirm')).toBeDisabled();
    expect(screen.getByRole('radio', { name: /journal/, checked: false })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`today-plan-picker-${journal}`));
    await fireEvent.press(screen.getByTestId('today-plan-picker-confirm'));

    expect(planIds(db)).toEqual([journal]);
    expect(screen.queryByTestId('today-plan-intro')).toBeNull();
    expect(screen.getByTestId(`${planRow(journal)}-position`)).toHaveTextContent('1');
    // In the plan only: the list below leaves it out but its counter still counts it.
    expect(screen.queryByTestId(listRow(journal))).toBeNull();
    expect(screen.getByTestId(listRow(meal))).toBeOnTheScreen();
    expect(screen.getByTestId('today-missions-count', hidden)).toHaveTextContent('0 di 2');
    expect(screen.getByLabelText('1 priorità su 3')).toHaveTextContent('1 di 3');
  });

  it('removes a priority from the menu of its row', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    setDayPlan(db, journal, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent(screen.getByTestId(`${planRow(journal)}-body`), 'longPress');
    await fireEvent.press(screen.getByTestId('today-mission-menu-unplan'));

    expect(planIds(db)).toEqual([]);
    expect(screen.queryByTestId(planRow(journal))).toBeNull();
    expect(screen.getByTestId(listRow(journal))).toBeOnTheScreen();
    expect(screen.getByTestId('today-plan-intro')).toBeOnTheScreen();
  });

  it('refuses a fourth priority and says why', async () => {
    const db = newGame(['journal', 'healthy_meal', 'bed_by_eleven', 'no_social_evening']);
    const planned = ['journal', 'healthy_meal', 'bed_by_eleven'].map((key) => missionId(db, key));
    planned.forEach((id) => setDayPlan(db, id, clockAt(FRIDAY, 9)));
    const fourth = missionId(db, 'no_social_evening');
    await openToday(db);

    planned.forEach((id, index) =>
      expect(screen.getByTestId(`${planRow(id)}-position`)).toHaveTextContent(String(index + 1)),
    );
    expect(screen.queryByTestId('today-plan-add')).toBeNull();
    await fireEvent(screen.getByTestId(`${listRow(fourth)}-body`), 'longPress');
    await fireEvent.press(screen.getByTestId('today-mission-menu-plan'));

    expect(await screen.findByTestId('today-plan-picker-full')).toHaveTextContent(
      'Hai già 3 priorità: togline una.',
    );
    expect(screen.getByRole('radio', { name: /no_social_evening/ })).toBeDisabled();
    expect(screen.getByTestId('today-plan-picker-confirm')).toBeDisabled();
    expect(planIds(db)).toEqual(planned);
  });

  it('gives the bonus with the last priority and takes it back with its undo', async () => {
    const db = newGame(['journal', 'healthy_meal', 'bed_by_eleven']);
    const journal = missionId(db, 'journal');
    const meal = missionId(db, 'healthy_meal');
    setDayPlan(db, journal, clockAt(FRIDAY, 9));
    setDayPlan(db, meal, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent.press(screen.getByTestId(`${planRow(journal)}-control`));
    expect(screen.queryByTestId('today-plan-seal')).toBeNull();
    await fireEvent.press(screen.getByTestId(`${planRow(meal)}-control`));

    expect(heroRow(db)).toMatchObject({ xpTotal: 45, coins: 4 });
    expect(screen.getByTestId('today-plan-seal')).toHaveProp(
      'accessibilityLabel',
      'Priorità tutte fatte, più 25 XP',
    );
    expect(
      screen.getByLabelText(/completata, più 10 XP e 2 Monete\. Priorità tutte fatte, più 25 XP$/),
    ).toBeOnTheScreen();
    // Done priorities stay in the plan, out of the group of the done missions.
    expect(screen.getByTestId(planRow(meal))).toHaveTextContent(/fatta alle 10:00/);
    expect(screen.queryByTestId('today-done-toggle')).toBeNull();
    expectHeroMatchesLog(db);

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(heroRow(db)).toMatchObject({ xpTotal: 10, coins: 2 });
    expect(screen.queryByTestId('today-plan-seal')).toBeNull();
    expect(screen.getByTestId(`${planRow(meal)}-position`)).toHaveTextContent('2');
    expectHeroMatchesLog(db);
  });
});

describe('Today: bosses', () => {
  const card = (id: string) => `today-boss-${id}`;
  const bossRow = (db: Db, id: string) => db.select().from(boss).where(eq(boss.id, id)).get();
  const starter = (db: Db) => db.select().from(boss).where(eq(boss.kind, 'starter')).get()!;
  const stepsOf = (db: Db, id: string) =>
    db
      .select()
      .from(bossSteps)
      .where(eq(bossSteps.bossId, id))
      .orderBy(asc(bossSteps.position))
      .all();

  it('shows the compact card of the boss with bar, steps, deadline and next step', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, starter(db).id, clockAt(FRIDAY, 9));
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', deadlineDay: '2026-11-20', steps: ['A', 'B', 'C'] },
      clockAt(FRIDAY, 9),
    );
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Grande obiettivo' })).toBeOnTheScreen();
    expect(screen.getByTestId(`${card(thesis.id)}-name`)).toHaveTextContent('Tesi');
    expect(screen.getByLabelText('Vita di Tesi 60 su 60')).toBeOnTheScreen();
    expect(screen.getByTestId(card(thesis.id))).toHaveTextContent(/Passi 0 di 3/);
    expect(screen.getByTestId(`${card(thesis.id)}-deadline`)).toHaveTextContent('14 giorni');
    expect(screen.getByTestId(`${card(thesis.id)}-next`)).toHaveTextContent('A');
    expect(screen.queryByTestId('today-bosses-scroll')).toBeNull();
  });

  it('scrolls the bosses from the nearest deadline, with the dots and the near deadline in danger', async () => {
    const db = newGame(['journal']);
    const later = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', deadlineDay: '2026-11-30', steps: ['A', 'B'] },
      clockAt(FRIDAY, 9),
    );
    const sooner = createBoss(
      db,
      { name: 'Trasloco', difficulty: 'easy', deadlineDay: '2026-11-08', steps: ['A', 'B'] },
      clockAt(FRIDAY, 9),
    );
    const quest = starter(db);
    await openToday(db);

    expect(screen.getByRole('header', { name: 'Grandi obiettivi' })).toBeOnTheScreen();
    expect(screen.getByTestId('today-bosses-scroll')).toBeOnTheScreen();
    expect(treeOrder([card(later.id), card(sooner.id)])).toEqual([card(sooner.id), card(later.id)]);
    expect(screen.getByTestId('today-bosses-dot-1', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId(`${card(sooner.id)}-deadline`)).toHaveTextContent('Mancano 2 giorni');
    // The quest of the first launch has its own card above the bosses (design 1.7).
    expect(screen.queryByTestId(card(quest.id))).toBeNull();
    expect(treeOrder(['today-starter', 'today-bosses'])).toEqual(['today-starter', 'today-bosses']);
  });

  it('completes a step from the card and undoes it from the notice', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, starter(db).id, clockAt(FRIDAY, 9));
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', steps: ['A', 'B', 'C'] },
      clockAt(FRIDAY, 9),
    );
    await openToday(db);

    await fireEvent.press(screen.getByTestId(`${card(thesis.id)}-step`));

    expect(bossRow(db, thesis.id)?.hp).toBe(40);
    expect(screen.getByLabelText('Vita di Tesi 40 su 60')).toBeOnTheScreen();
    // The notice says the damage aloud: the number beside the bar is only drawn.
    expect(
      screen.getByTestId(`${card(thesis.id)}-damage`, { includeHiddenElements: true }),
    ).toHaveTextContent('−20');
    expect(screen.getByTestId(card(thesis.id))).toHaveTextContent(/Passi 1 di 3/);
    expect(screen.getByTestId(`${card(thesis.id)}-next`)).toHaveTextContent('B');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/Passo fatto · −20/);

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(bossRow(db, thesis.id)?.hp).toBe(60);
    expect(stepsOf(db, thesis.id)[0].doneAt).toBeNull();
    expect(screen.getByTestId(`${card(thesis.id)}-next`)).toHaveTextContent('A');
    expectHeroMatchesLog(db);
  });

  it('wins from the last step without «Annulla»', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, starter(db).id, clockAt(FRIDAY, 9));
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'easy', steps: ['A', 'B'] },
      clockAt(FRIDAY, 9),
    );
    completeBossStep(db, stepsOf(db, thesis.id)[0].id, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent.press(screen.getByTestId(`${card(thesis.id)}-step`));

    expect(bossRow(db, thesis.id)?.status).toBe('defeated');
    expect(await screen.findByTestId('moment-boss_defeated')).toBeOnTheScreen();
    expect(screen.queryByTestId('undo-toast-undo')).toBeNull();
    expectHeroMatchesLog(db);
  });

  it('says why the step before the victory cannot be undone any more', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, starter(db).id, clockAt(FRIDAY, 9));
    const thesis = createBoss(
      db,
      { name: 'Tesi', difficulty: 'easy', steps: ['A', 'B'] },
      clockAt(FRIDAY, 9),
    );
    await openToday(db);
    await fireEvent.press(screen.getByTestId(`${card(thesis.id)}-step`));
    const undoFirstStep = screen.getByTestId('undo-toast-undo');

    // The victory has no notice of its own: the one of the first step is still there.
    await fireEvent.press(screen.getByTestId(`${card(thesis.id)}-step`));
    await fireEvent.press(undoFirstStep);

    expect(bossRow(db, thesis.id)?.status).toBe('defeated');
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(
      'Questo boss è già sconfitto: la vittoria non si annulla.',
    );
    expectHeroMatchesLog(db);
  });

  it('leads to Obiettivi when there is no boss', async () => {
    const db = newGame(['journal']);
    archiveBoss(db, starter(db).id, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Dividi un grande obiettivo in passi' }),
    );

    // Obiettivi has the name of the theme: «Grandi obiettivi» in Minimal (design-sezioni.md 5.1).
    expect(await screen.findByRole('header', { name: 'Grandi obiettivi' })).toBeOnTheScreen();
  });
});

describe('Today: skip today and full day', () => {
  const row = (id: string) => `today-mission-${id}`;
  const heroRow = (db: Db) => db.select().from(hero).get();
  const hidden = { includeHiddenElements: true };
  /** The mission day of today, Friday 6 November. */
  const dayOf = (db: Db, id: string) =>
    db
      .select()
      .from(missionDays)
      .where(and(eq(missionDays.missionId, id), eq(missionDays.gameDay, '2026-11-06')))
      .get();

  async function openSkipFromMenu(id: string) {
    await fireEvent(screen.getByTestId(`${row(id)}-body`), 'longPress');
    await fireEvent.press(screen.getByTestId('today-mission-menu-skip'));
    await screen.findByTestId('today-skip-left');
  }

  it('skips with a reason: the row goes among the done ones and nothing is lost', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    await openToday(db);

    await openSkipFromMenu(journal);
    expect(screen.getByTestId('today-skip-left')).toHaveTextContent(
      'Ti restano 3 salti questa settimana',
    );
    expect(screen.getByTestId('today-skip-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('today-skip-reason-illness'));
    expect(screen.getByRole('radio', { name: 'Malattia' })).toBeChecked();
    await fireEvent.press(screen.getByTestId('today-skip-confirm'));

    expect(dayOf(db, journal)).toMatchObject({ status: 'skipped', skipReason: 'illness' });
    expect(heroRow(db)).toMatchObject({ xpTotal: 0, coins: 0, hp: 50 });
    expect(screen.getByTestId('undo-toast')).toHaveTextContent(/^Saltata/);
    expect(screen.getByTestId('today-done')).toHaveTextContent(/saltata · malattia/);
    expect(screen.getByTestId('today-done-toggle')).toHaveTextContent('Fatte (1)');
    // The skipped mission is out of the counters of the day.
    expect(screen.getByTestId('today-missions-count', hidden)).toHaveTextContent('0 di 1');
    expect(screen.queryByTestId(`${row(journal)}-swipe`, hidden)).toBeNull();
    expectHeroMatchesLog(db);
  });

  it('opens the sheet from the swipe and says the skips left this week', async () => {
    const db = newGame(['journal', 'healthy_meal'], FRIDAY - 2);
    const journal = missionId(db, 'journal');
    db.insert(missionDays)
      .values({
        missionId: journal,
        gameDay: '2026-11-04',
        status: 'skipped',
        skipReason: 'rest',
        source: 'app',
        updatedAt: at(4, 10),
      })
      .run();
    await openToday(db);

    // The action of the swipe is hidden from the screen reader, which has it on the row.
    await fireEvent.press(screen.getByTestId(`${row(journal)}-swipe-skip`, hidden));

    expect(await screen.findByTestId('today-skip-left')).toHaveTextContent(
      'Ti restano 2 salti questa settimana',
    );
    expect(screen.getByText(/^Salta «.+»$/)).toBeOnTheScreen();
  });

  it('refuses a fourth skip in the week with a message', async () => {
    const db = newGame(['journal', 'healthy_meal'], FRIDAY - 4);
    const journal = missionId(db, 'journal');
    db.insert(missionDays)
      .values(
        (['2026-11-02', '2026-11-03', '2026-11-04'] as const).map((gameDay) => ({
          missionId: journal,
          gameDay,
          status: 'skipped' as const,
          skipReason: 'travel',
          source: 'app' as const,
          updatedAt: at(4, 10),
        })),
      )
      .run();
    await openToday(db);

    await openSkipFromMenu(journal);

    expect(screen.getByTestId('today-skip-left')).toHaveTextContent(
      'Hai già usato i 3 salti di questa settimana.',
    );
    expect(screen.getByRole('radio', { name: 'Viaggio' })).toBeDisabled();
    expect(screen.getByTestId('today-skip-confirm')).toBeDisabled();
    expect(dayOf(db, journal)).toBeUndefined();
  });

  it('undoes a skip from the notice and from the menu of the row', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    await openToday(db);
    await openSkipFromMenu(journal);
    await fireEvent.press(screen.getByTestId('today-skip-reason-rest'));
    await fireEvent.press(screen.getByTestId('today-skip-confirm'));

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(dayOf(db, journal)).toBeUndefined();
    expect(screen.getByTestId(`${row(journal)}-control`)).toBeOnTheScreen();

    await openSkipFromMenu(journal);
    await fireEvent.press(screen.getByTestId('today-skip-reason-other'));
    await fireEvent.press(screen.getByTestId('today-skip-confirm'));
    await fireEvent(screen.getByTestId(`${row(journal)}-body`), 'longPress');
    expect(screen.queryByTestId('today-mission-menu-skip')).toBeNull();
    await fireEvent.press(screen.getByTestId('today-mission-menu-unskip'));

    expect(dayOf(db, journal)).toBeUndefined();
    expectHeroMatchesLog(db);
  });

  it('shows «Giornata completa» with the last mission and hides it when an undo opens the day', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    await openToday(db);
    await fireEvent.press(screen.getByTestId(`${row(missionId(db, 'journal'))}-control`));
    expect(screen.queryByTestId('today-full-day')).toBeNull();

    await fireEvent.press(screen.getByTestId(`${row(missionId(db, 'healthy_meal'))}-control`));

    expect(screen.getByTestId('today-full-day')).toHaveTextContent(/Giornata completa/);
    expect(screen.getByTestId('today-full-day-rewards')).toHaveTextContent(
      '+10 monete · +5 energia',
    );
    expect(screen.getByLabelText('Giornata completa, più 10 monete e 5 energia')).toBeOnTheScreen();
    expect(screen.queryByTestId('today-missions-count', hidden)).toBeNull();
    expect(heroRow(db)?.coins).toBe(14);

    await fireEvent.press(screen.getByTestId('undo-toast-undo'));

    expect(screen.queryByTestId('today-full-day')).toBeNull();
    expect(screen.getByTestId('today-missions-count', hidden)).toHaveTextContent('1 di 2');
    expect(heroRow(db)?.coins).toBe(2);
    expectHeroMatchesLog(db);
  });

  it('completes the day when the last mission left is skipped', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const meal = missionId(db, 'healthy_meal');
    await openToday(db);
    await fireEvent.press(screen.getByTestId(`${row(missionId(db, 'journal'))}-control`));

    await openSkipFromMenu(meal);
    await fireEvent.press(screen.getByTestId('today-skip-reason-travel'));
    await fireEvent.press(screen.getByTestId('today-skip-confirm'));

    expect(screen.getByTestId('today-full-day')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('undo-toast-undo'));
    expect(screen.queryByTestId('today-full-day')).toBeNull();
    expectHeroMatchesLog(db);
  });

  it('frees the place of a skipped priority', async () => {
    const db = newGame(['journal', 'healthy_meal']);
    const journal = missionId(db, 'journal');
    setDayPlan(db, journal, clockAt(FRIDAY, 9));
    await openToday(db);

    await fireEvent(screen.getByTestId(`today-plan-${journal}-body`), 'longPress');
    await fireEvent.press(screen.getByTestId('today-mission-menu-skip'));
    await fireEvent.press(await screen.findByTestId('today-skip-reason-rest'));
    await fireEvent.press(screen.getByTestId('today-skip-confirm'));

    expect(db.select().from(dayPlan).all()).toEqual([]);
    expect(screen.getByTestId('today-plan-add')).toBeOnTheScreen();
    expect(screen.getByTestId('today-done')).toHaveTextContent(/saltata · riposo/);
  });
});

describe('Today: measurable missions', () => {
  const row = (id: string) => `today-mission-${id}`;
  const heroRow = (db: Db) => db.select().from(hero).get();
  const dayOf = (db: Db, id: string) =>
    db
      .select()
      .from(missionDays)
      .where(and(eq(missionDays.missionId, id), eq(missionDays.gameDay, '2026-11-06')))
      .get();

  async function tap(id: string, times = 1) {
    for (let count = 0; count < times; count += 1) {
      await fireEvent.press(screen.getByTestId(`${row(id)}-control`));
    }
  }

  it('adds the increment with a touch and shows the progress with the decimals of the language', async () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    await openToday(db);

    expect(screen.getByTestId(row(water))).toHaveTextContent(/0 di 2 L/);
    await tap(water, 5);

    expect(dayOf(db, water)).toMatchObject({ status: 'partial', value: 1.25 });
    expect(screen.getByTestId(row(water))).toHaveTextContent(/1,25 di 2 L/);
    // A partial value gives nothing yet.
    expect(heroRow(db)).toMatchObject({ xpTotal: 0, coins: 0 });
    expectHeroMatchesLog(db);
  });

  it('gives the rewards once when the target is reached, and nothing more beyond it', async () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    await openToday(db);

    await tap(water, 8);
    expect(dayOf(db, water)).toMatchObject({ status: 'done', value: 2 });
    const gained = heroRow(db)!;
    expect(gained.xpTotal).toBeGreaterThan(0);
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );

    // Done, the row is among the done ones: «Inserisci valore» from the menu is gone.
    await fireEvent(screen.getByTestId(`${row(water)}-body`), 'longPress');
    expect(screen.queryByTestId('today-mission-menu-value')).toBeNull();
    expectHeroMatchesLog(db);
  });

  it('adds a value typed by hand from a long press on the control', async () => {
    const db = newGame(['drink_water', 'journal']);
    const water = missionId(db, 'drink_water');
    await openToday(db);

    await fireEvent(screen.getByTestId(`${row(water)}-control`), 'longPress');
    await screen.findByTestId('today-value-input');
    expect(screen.getByTestId('today-value-today')).toHaveTextContent('Oggi: 0 di 2 L');
    expect(screen.getByTestId('today-value-add')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('today-value-input'), '1,5');
    await fireEvent.press(screen.getByTestId('today-value-add'));
    expect(dayOf(db, water)).toMatchObject({ status: 'partial', value: 1.5 });

    // From the menu of the row too; going past the target completes it once.
    await fireEvent(screen.getByTestId(`${row(water)}-body`), 'longPress');
    await fireEvent.press(screen.getByTestId('today-mission-menu-value'));
    // The sheet opens again once the menu has slid away.
    await waitFor(() =>
      expect(screen.getByTestId('today-value-today')).toHaveTextContent('Oggi: 1,5 di 2 L'),
    );
    await fireEvent.changeText(screen.getByTestId('today-value-input'), '3');
    await fireEvent.press(screen.getByTestId('today-value-add'));
    expect(dayOf(db, water)).toMatchObject({ status: 'done', value: 4.5 });
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );
    expectHeroMatchesLog(db);
  });
});

describe('Today: quest of the first launch', () => {
  const control = (db: Db) => `today-mission-${missionId(db, 'journal')}-control`;
  const companionName = (db: Db) => db.select().from(companion).get()?.name ?? null;

  it('plays the quest from the arrival on Today to the small victory', async () => {
    const db = newGame(['journal']);
    await openToday(db);

    // Arrival (design 1.7): its own card, the first step already done, the companion's tip.
    expect(screen.getByTestId('today-starter-name')).toHaveTextContent('Primi passi');
    expect(screen.getByTestId('today-starter-count')).toHaveTextContent('1 di 3');
    expect(
      screen.getByTestId('today-starter-step-0-done', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Completala, da fare')).toBeOnTheScreen();
    expect(screen.getByTestId('today-starter-reward')).toHaveTextContent(
      'Ricompensa: livello 2 e 50 monete',
    );
    expect(screen.getByTestId('today-starter-hint')).toHaveTextContent(
      "Tocca il cerchio quando l'hai fatta",
    );
    expect(screen.queryByTestId('today-bosses-empty')).toBeNull();
    expect(screen.queryByTestId('today-hero-stats-pulse')).toBeNull();

    // First completion: the egg hatches with the choice of the name, the second step is done.
    await fireEvent.press(screen.getByTestId(control(db)));
    expect(await screen.findByTestId('moment-hatch')).toBeOnTheScreen();
    expect(screen.getByText('È nato!')).toBeOnTheScreen();
    expect(screen.getByTestId('moment-hatch-name')).toHaveProp('value', 'Cloudy');
    // It waits for the name instead of going away after 2.5 seconds.
    jest.useFakeTimers();
    try {
      await act(async () => jest.advanceTimersByTime(MOMENT_MAX_MS * 2));
    } finally {
      jest.useRealTimers();
    }
    expect(screen.getByTestId('moment-hatch')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('moment-hatch-name'), 'Fiocco');
    await fireEvent.press(screen.getByTestId('moment-continue'));
    expect(screen.queryByTestId('moment-hatch')).toBeNull();
    expect(companionName(db)).toBe('Fiocco');
    expect(screen.queryByTestId('today-starter-hint')).toBeNull();
    expect(screen.getByTestId('today-starter-count')).toHaveTextContent('2 di 3');
    expect(screen.getByTestId('today-hero-stats-pulse')).toBeOnTheScreen();

    // Statistiche wins the quest; the victory shows back on Today (design 1.8).
    await fireEvent.press(screen.getByTestId('today-hero-streak'));
    expect(await screen.findByTestId('stats-screen')).toBeOnTheScreen();
    expect(db.select().from(boss).where(eq(boss.kind, 'starter')).get()?.status).toBe('defeated');
    expect(screen.queryByTestId('moment-boss_defeated')).toBeNull();
    expect(screen.queryByTestId('moment-level_up')).toBeNull();
    await fireEvent.press(screen.getByTestId('stats-header-back'));

    expect(await screen.findByTestId('moment-level_up')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.getByTestId('moment-boss_defeated')).toBeOnTheScreen();
    // Smaller than the victory over a boss: a small emblem, no confetti, no trophy.
    expect(StyleSheet.flatten(screen.getByTestId('moment-icon-emblem').props.style).width).toBe(96);
    expect(screen.queryByTestId('moment-particle')).toBeNull();
    expect(screen.queryByTestId('moment-trophy')).toBeNull();
    const victory = db.select().from(events).where(eq(events.type, 'boss.defeated')).get();
    expect(victory).toMatchObject({ dCoins: 50 });
    expect(db.select().from(hero).get()?.level).toBe(2);
    expectHeroMatchesLog(db);
    await fireEvent.press(screen.getByTestId('moment-continue'));

    // Then the row «Trasforma un obiettivo in un boss» takes the place of the quest.
    expect(screen.queryByTestId('today-starter')).toBeNull();
    expect(screen.getByTestId('today-bosses-empty')).toHaveTextContent(
      'Dividi un grande obiettivo in passi',
    );
  });

  it('closes the companion tip at a touch elsewhere', async () => {
    const db = newGame(['journal']);
    await openToday(db);
    expect(screen.getByTestId('today-starter-hint')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('today-screen'), 'touchStart');
    expect(screen.queryByTestId('today-starter-hint')).toBeNull();
  });

  it('hatches with only a fade under «Riduci movimento» and keeps the name with «Salta»', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'reduce_motion', 'on', at(FRIDAY, 9));
    await openToday(db);

    await fireEvent.press(screen.getByTestId(control(db)));
    expect(await screen.findByTestId('moment-hatch')).toBeOnTheScreen();
    expect(screen.getByTestId('moment-hatch-puppy')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('moment-skip'));
    expect(screen.queryByTestId('moment-hatch')).toBeNull();
    expect(companionName(db)).toBeNull();
  });

  it('does not win the quest when Statistiche opens before the first completion', async () => {
    const db = newGame(['journal']);
    await openToday(db);
    await fireEvent.press(screen.getByTestId('today-hero-streak'));
    expect(await screen.findByTestId('stats-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('stats-header-back'));
    expect(await screen.findByTestId('today-starter')).toBeOnTheScreen();
    expect(screen.getByTestId('today-starter-count')).toHaveTextContent('1 di 3');
    expect(screen.queryByTestId('moment-boss_defeated')).toBeNull();
  });
});
