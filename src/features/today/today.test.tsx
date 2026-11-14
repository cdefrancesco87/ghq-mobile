import { asc, eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { archiveBoss, completeBossStep, createBoss } from '@/db/repositories/boss';
import { setDayPlan } from '@/db/repositories/completion';
import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { createMission, deleteMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { buyItem } from '@/db/repositories/shop';
import {
  boss,
  bossSteps,
  dayPlan,
  daySummaries,
  hero,
  missionDays,
  missionReminders,
} from '@/db/schema';
import type { Db } from '@/db/types';
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
    expect(screen.getByTestId('today-hero-title')).toHaveTextContent('Recluta');
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
    expect(await screen.findByRole('header', { name: 'Statistiche' })).toBeOnTheScreen();
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

  it('scrolls three bosses from the nearest deadline, with the dots and the near deadline in danger', async () => {
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
    expect(treeOrder([card(later.id), card(sooner.id), card(quest.id)])).toEqual([
      card(sooner.id),
      card(later.id),
      card(quest.id),
    ]);
    expect(screen.getByTestId('today-bosses-dot-2', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId(`${card(sooner.id)}-deadline`)).toHaveTextContent('2 giorni');
    // The quest of the first launch is a boss like the others, with its name of the theme.
    expect(screen.getByTestId(`${card(quest.id)}-name`)).toHaveTextContent('Primi passi');
    // Its first step («Crea la prima abitudine») is done with the profile.
    expect(screen.getByTestId(`${card(quest.id)}-next`)).toHaveTextContent('Completala');
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

    expect(await screen.findByRole('header', { name: 'Obiettivi' })).toBeOnTheScreen();
  });
});
