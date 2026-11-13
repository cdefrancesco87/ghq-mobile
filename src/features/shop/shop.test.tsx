import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { appendEvent } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { createReward } from '@/db/repositories/rewards';
import { buyItem } from '@/db/repositories/shop';
import { setSetting } from '@/db/repositories/settings';
import { events, hero, inventory, rewards } from '@/db/schema';
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
import Index from '../../../app/index';
import ShopRoute from '../../../app/shop';
import { at, clockAt, expectHeroMatchesLog, FRIDAY, newGame, TZ } from '../../../test/game';

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  shop: ShopRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function open(db: Db, url = '/shop') {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 12) });
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
  if (url === '/shop') {
    await screen.findByTestId('shop-screen');
  }
}

/** Coins and hit points changed like a game action does: state and event together. */
function adjustHero(db: Db, deltas: { coins?: number; hp?: number }): void {
  const change = changeHero(db, deltas, at(FRIDAY, 8));
  appendEvent(db, {
    type: 'day.closed',
    occurredAt: at(FRIDAY, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

function owned(db: Db, itemKey: string): number {
  return db.select().from(inventory).where(eq(inventory.itemKey, itemKey)).get()?.quantity ?? 0;
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

describe('Shop', () => {
  it('opens from the coins of the hero card and goes back', async () => {
    await open(newGame(['meditation']), '/today');
    await fireEvent.press(await screen.findByTestId('today-hero-coins'));
    expect(await screen.findByTestId('shop-screen')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('shop-header-back'));
    expect(await screen.findByTestId('today-screen')).toBeOnTheScreen();
  });

  it('shows the balance, the welcome and the helps with the names of the theme', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 245 });
    buyItem(db, 'potion', clockAt(FRIDAY, 9));
    await open(db);

    expect(screen.getByRole('header', { name: 'Negozio' })).toBeOnTheScreen();
    expect(text('shop-balance-coins')).toBe(195);
    expect(screen.getByLabelText('Saldo: 195 monete')).toBeOnTheScreen();
    expect(text('shop-welcome')).toBe('Ciao Claudio, cosa ti serve oggi?');
    expect(screen.getByRole('radio', { name: 'Negozio' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Inventario' })).toBeOnTheScreen();
    expect(screen.getByText('Aiuti')).toBeOnTheScreen();
    expect(screen.getByTestId('shop-item-potion')).toHaveAccessibleName(
      'Ricarica, Ridà 10 energia, 50 monete, Ne hai 1',
    );
    expect(screen.getByTestId('shop-item-shield')).toHaveAccessibleName(
      'Protezione serie, Protegge la serie per un giorno, 100 monete',
    );
    // Two cards side by side.
    expect(screen.getByTestId('shop-grid').children).toHaveLength(1);
  });

  it('takes the names of another theme', async () => {
    const db = newGame(['meditation']);
    setSetting(db, 'theme', 'fantasy', at(FRIDAY, 9));
    await open(db);

    expect(screen.getByRole('header', { name: 'Bottega' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Bisaccia' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Saldo: 0 oro')).toBeOnTheScreen();
    expect(text('shop-welcome')).toBe('Salve, Claudio! Cosa ti serve per la prossima impresa?');
    expect(screen.getByTestId('shop-item-shield')).toHaveAccessibleName(
      'Scudo, Protegge la fiamma sacra per un giorno, 100 oro, Ti mancano 100 oro',
    );
  });

  it('buys after the confirmation, with the balance after, and says the new balance', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 245 });
    await open(db);

    await fireEvent.press(screen.getByTestId('shop-item-potion'));
    expect(screen.getByRole('header', { name: 'Compra per 50' })).toBeOnTheScreen();
    expect(text('shop-buy-caption')).toBe('Ti restano 195 monete');
    expect(screen.getByTestId('shop-buy-use-now').props.value).toBe(false);
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));

    expect(await screen.findByText('Comprato: Ricarica. Ora hai 195 monete')).toBeOnTheScreen();
    expect(text('shop-balance-coins')).toBe(195);
    expect(owned(db, 'potion')).toBe(1);
    expect(screen.getByTestId('shop-item-potion-owned')).toHaveTextContent('Ne hai 1');
    // The hero card of Today reads the same store.
    expect(useHeroStore.getState().hero?.coins).toBe(195);

    // A second tap while the sheet slides away buys nothing more.
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));
    expect(owned(db, 'potion')).toBe(1);
  });

  it('updates the coins of the hero card in Today after a purchase', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 245 });
    await open(db, '/today');
    expect(await screen.findByTestId('today-hero-coins')).toHaveAccessibleName(
      '245 Monete. Apri il negozio',
    );

    await fireEvent.press(screen.getByTestId('today-hero-coins'));
    await fireEvent.press(await screen.findByTestId('shop-item-shield'));
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));
    await fireEvent.press(screen.getByTestId('shop-header-back'));

    expect(await screen.findByTestId('today-hero-coins')).toHaveAccessibleName(
      '145 Monete. Apri il negozio',
    );
  });

  it('buys and drinks a potion at once with «Usa subito»', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 60, hp: -20 });
    await open(db);

    await fireEvent.press(screen.getByTestId('shop-item-potion'));
    await fireEvent(screen.getByTestId('shop-buy-use-now'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));

    expect(
      await screen.findByText('Comprato e usato: Ricarica. Energia 40 su 50. Ora hai 10 monete'),
    ).toBeOnTheScreen();
    expect(db.select().from(hero).get()).toMatchObject({ hp: 40, coins: 10 });
    expect(owned(db, 'potion')).toBe(0);
  });

  it('turns «Usa subito» off at full hit points', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 60 });
    await open(db);

    await fireEvent.press(screen.getByTestId('shop-item-potion'));
    expect(screen.getByTestId('shop-buy-use-now').props.disabled).toBe(true);
    expect(text('shop-buy-hp-full')).toBe('Energia già al massimo');
  });

  it('opens the card short of coins but does not buy', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 80 });
    await open(db);

    expect(text('shop-item-shield-missing')).toBe('Ti mancano 20 monete');
    await fireEvent.press(screen.getByTestId('shop-item-shield'));
    expect(screen.getByRole('header', { name: 'Compra per 100' })).toBeOnTheScreen();
    expect(text('shop-buy-caption')).toBe('Hai 80 monete');
    expect(text('shop-buy-reason')).toBe('Ti mancano 20 monete');
    expect(screen.getByTestId('shop-buy-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));

    expect(owned(db, 'shield')).toBe(0);
    expect(db.select().from(hero).get()?.coins).toBe(80);
  });

  it('refuses a third shield', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 500 });
    buyItem(db, 'shield', clockAt(FRIDAY, 9));
    buyItem(db, 'shield', clockAt(FRIDAY, 9));
    await open(db);

    expect(text('shop-item-shield-owned')).toBe('Ne hai già 2, il massimo');
    await fireEvent.press(screen.getByTestId('shop-item-shield'));
    expect(screen.getByRole('header', { name: 'Protezione serie' })).toBeOnTheScreen();
    expect(text('shop-buy-caption')).toBe('Al massimo');
    expect(screen.getByTestId('shop-buy-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('shop-buy-confirm'));

    expect(owned(db, 'shield')).toBe(2);
    expect(db.select().from(hero).get()?.coins).toBe(300);
  });

  it('puts the cards in one column with very large text', async () => {
    await open(newGame(['meditation']));
    expect(screen.getByTestId('shop-grid').children).toHaveLength(1);

    await setFontScale(1.3);
    expect(await screen.findByTestId('shop-grid')).toBeOnTheScreen();
    expect(screen.getByTestId('shop-grid').children).toHaveLength(2);
  });
});

describe('Inventory', () => {
  it('shows the backpack when empty', async () => {
    await open(newGame(['meditation']));
    await fireEvent.press(screen.getByRole('radio', { name: 'Inventario' }));

    expect(screen.getByTestId('shop-inventory-empty')).toBeOnTheScreen();
    expect(screen.getByText('Niente qui: guarda nel Negozio.')).toBeOnTheScreen();
  });

  it('uses a potion, fills the hit points and says them', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 200, hp: -25 });
    buyItem(db, 'potion', clockAt(FRIDAY, 9));
    buyItem(db, 'potion', clockAt(FRIDAY, 9));
    buyItem(db, 'shield', clockAt(FRIDAY, 9));
    await open(db);
    await fireEvent.press(screen.getByRole('radio', { name: 'Inventario' }));

    expect(screen.getByText('×2')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ricarica, Ne hai 2, Ridà 10 energia')).toBeOnTheScreen();
    expect(text('shop-inventory-shield-detail')).toBe('Si usa da solo nel primo giorno mancato');
    expect(screen.getByTestId('shop-inventory-hp')).toHaveAccessibilityValue({
      min: 0,
      max: 50,
      now: 25,
    });
    await fireEvent.press(screen.getByTestId('shop-inventory-use-potion'));

    expect(await screen.findByText('Usato: Ricarica. Energia 35 su 50')).toBeOnTheScreen();
    expect(screen.getByTestId('shop-inventory-hp')).toHaveAccessibilityValue({
      min: 0,
      max: 50,
      now: 35,
    });
    expect(screen.getByLabelText('Ricarica, Ne hai 1, Ridà 10 energia')).toBeOnTheScreen();
    expect(useHeroStore.getState().hero?.hp).toBe(35);
    expect(db.select().from(events).where(eq(events.type, 'item.used')).all()).toHaveLength(1);
  });

  it('turns «Usa» off at full hit points', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 50 });
    buyItem(db, 'potion', clockAt(FRIDAY, 9));
    await open(db);
    await fireEvent.press(screen.getByRole('radio', { name: 'Inventario' }));

    expect(text('shop-inventory-potion-detail')).toBe('Energia già al massimo');
    expect(screen.getByTestId('shop-inventory-use-potion')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('shop-inventory-use-potion'));
    expect(owned(db, 'potion')).toBe(1);
  });
});

describe('Personal rewards', () => {
  const redemptions = (db: Db) =>
    db.select().from(events).where(eq(events.type, 'reward.redeemed')).all();

  async function afterMenu() {
    await act(async () => {
      jest.advanceTimersByTime(SHEET_DURATION_MS);
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows only «+ Nuova ricompensa» with the example after the helps, and creates a reward', async () => {
    const db = newGame(['meditation']);
    await open(db);

    expect(screen.getByTestId('shop-rewards-title')).toHaveTextContent('Le tue ricompense');
    expect(screen.getByTestId('shop-reward-example')).toHaveTextContent(
      'Es. Un episodio della tua serie',
    );
    await fireEvent.press(screen.getByTestId('shop-reward-new'));
    expect(await screen.findByRole('header', { name: 'Nuova ricompensa' })).toBeOnTheScreen();
    expect(screen.getByTestId('shop-reward-save')).toBeDisabled();
    expect(screen.getByTestId('shop-reward-size-small')).toHaveTextContent('Piccola · 100');
    expect(screen.getByTestId('shop-reward-size-epic')).toHaveAccessibleName('Epica, 1500 monete');
    await fireEvent.changeText(
      screen.getByTestId('shop-reward-name'),
      'Un episodio della tua serie',
    );
    await fireEvent.press(screen.getByTestId('shop-reward-size-medium'));
    await fireEvent.press(screen.getByTestId('shop-reward-save'));

    const [row] = db.select().from(rewards).all();
    expect(row).toMatchObject({ name: 'Un episodio della tua serie', size: 'medium' });
    expect(
      await screen.findByText('Ricompensa creata: Un episodio della tua serie'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(`shop-reward-${row.id}`)).toHaveAccessibleName(
      'Un episodio della tua serie, ricompensa media, 250 monete, Ti mancano 250 monete',
    );
    expect(text(`shop-reward-${row.id}-price`)).toBe(250);
    expect(screen.queryByTestId('shop-reward-example')).toBeNull();
    expect(screen.getByTestId('shop-reward-new')).toBeOnTheScreen();
  });

  it('redeems a reward: coins down, a short celebration, «Goditi» and the log', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 300 });
    const id = createReward(
      db,
      { name: 'Un episodio della tua serie', size: 'medium' },
      clockAt(FRIDAY, 9),
    );
    await open(db);

    await fireEvent.press(screen.getByTestId(`shop-reward-${id}`));
    expect(await screen.findByRole('header', { name: 'Riscatta per 250' })).toBeOnTheScreen();
    expect(screen.getByTestId('shop-redeem-caption')).toHaveTextContent('Ti restano 50 monete');
    await fireEvent.press(screen.getByTestId('shop-redeem-confirm'));

    expect(
      await screen.findByText('Goditi: Un episodio della tua serie. Ora hai 50 monete'),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('celebration-chip', { includeHiddenElements: true }),
    ).toHaveTextContent('Goditi!');
    expect(text('shop-balance-coins')).toBe(50);
    expect(redemptions(db)).toHaveLength(1);
    expect(redemptions(db)[0]).toMatchObject({
      dCoins: -250,
      payload: { name: 'Un episodio della tua serie', price: 250 },
    });
    // The reward stays for the next redemptions.
    expect(screen.getByTestId(`shop-reward-${id}`)).toBeOnTheScreen();
    expectHeroMatchesLog(db);
  });

  it('does not redeem without enough coins', async () => {
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 40 });
    const id = createReward(db, { name: 'Pizza', size: 'small' }, clockAt(FRIDAY, 9));
    await open(db);

    expect(screen.getByTestId(`shop-reward-${id}-missing`)).toHaveTextContent(
      'Ti mancano 60 monete',
    );
    await fireEvent.press(screen.getByTestId(`shop-reward-${id}`));
    expect(await screen.findByTestId('shop-redeem-reason')).toHaveTextContent(
      'Ti mancano 60 monete',
    );
    expect(screen.getByTestId('shop-redeem-confirm')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('shop-redeem-confirm'));
    expect(redemptions(db)).toEqual([]);
    expect(text('shop-balance-coins')).toBe(40);
  });

  it('changes name and size from the menu: the new price is shown', async () => {
    jest.useFakeTimers();
    const db = newGame(['meditation']);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, clockAt(FRIDAY, 9));
    await open(db);

    await fireEvent.press(screen.getByTestId(`shop-reward-${id}-menu`));
    await fireEvent.press(screen.getByTestId('shop-reward-actions-edit'));
    await afterMenu();
    expect(screen.getByTestId('shop-reward-name').props.value).toBe('Pizza');
    expect(screen.getByTestId('shop-reward-size-small')).toBeSelected();
    await fireEvent.changeText(screen.getByTestId('shop-reward-name'), 'Pizza fuori');
    await fireEvent.press(screen.getByTestId('shop-reward-size-large'));
    await fireEvent.press(screen.getByTestId('shop-reward-save'));

    expect(text(`shop-reward-${id}-price`)).toBe(600);
    expect(text(`shop-reward-${id}-name`)).toBe('Pizza fuori');
    expect(db.select().from(rewards).all()).toHaveLength(1);
  });

  it('deletes a reward with a long press and a dialog, keeping the past redemptions', async () => {
    jest.useFakeTimers();
    const db = newGame(['meditation']);
    adjustHero(db, { coins: 300 });
    const id = createReward(db, { name: 'Pizza', size: 'small' }, clockAt(FRIDAY, 9));
    await open(db);
    await fireEvent.press(screen.getByTestId(`shop-reward-${id}`));
    await fireEvent.press(screen.getByTestId('shop-redeem-confirm'));

    await fireEvent(screen.getByTestId(`shop-reward-${id}`), 'longPress');
    await fireEvent.press(screen.getByTestId('shop-reward-actions-delete'));
    await afterMenu();
    expect(screen.getByTestId('shop-reward-delete')).toHaveTextContent(/Eliminare «Pizza»\?/);
    await fireEvent.press(screen.getByTestId('shop-reward-delete-confirm'));

    expect(screen.queryByTestId(`shop-reward-${id}`)).toBeNull();
    expect(db.select().from(rewards).get()?.archivedAt).not.toBeNull();
    expect(redemptions(db)).toHaveLength(1);
    expect(text('shop-balance-coins')).toBe(200);
    expectHeroMatchesLog(db);
  });

  it('loads 50 rewards in a virtualized list while scrolling', async () => {
    const db = newGame(['meditation']);
    for (let index = 0; index < 50; index += 1) {
      createReward(db, { name: `Premio ${index}`, size: 'small' }, clockAt(FRIDAY, 9));
    }
    await open(db);

    const shown = () => screen.queryAllByTestId(/^shop-reward-[0-9a-f-]+-price$/).length;
    // The rows of the list: two cards each.
    const rows = () => (screen.getByTestId('shop-list').props.data as unknown[]).length;
    expect(rows()).toBe(10);
    // Virtualized: only the first cards are drawn.
    expect(shown()).toBeGreaterThan(0);
    expect(shown()).toBeLessThan(20);
    for (let page = 0; page < 3; page += 1) {
      await act(async () => {
        screen.getByTestId('shop-list').props.onEndReached({ distanceFromEnd: 0 });
      });
    }
    // 50 rewards and, after the last page, «+ Nuova ricompensa».
    expect(rows()).toBe(26);
    expect(shown()).toBeLessThan(50);
  });

  it('puts the rewards in one column with very large text', async () => {
    const db = newGame(['meditation']);
    createReward(db, { name: 'Pizza', size: 'small' }, clockAt(FRIDAY, 9));
    await setFontScale(1.3);
    await open(db);

    // The reward and «+ Nuova ricompensa» on two rows, then side by side.
    const rows = () => (screen.getByTestId('shop-list').props.data as unknown[]).length;
    expect(rows()).toBe(2);
    await setFontScale(1);
    expect(rows()).toBe(1);
  });

  it('hides the rewards in the Essential mode', async () => {
    const db = newGame(['meditation']);
    setSetting(db, 'game_mode', 'essential', at(FRIDAY, 9));
    createReward(db, { name: 'Pizza', size: 'small' }, clockAt(FRIDAY, 9));
    await open(db);

    expect(screen.queryByTestId('shop-rewards-title')).toBeNull();
    expect(screen.queryByTestId('shop-reward-new')).toBeNull();
  });
});
