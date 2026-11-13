import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { GiftKey, ItemKey } from '@/content/shop';
import { giveGift } from '@/db/repositories/companion';
import {
  archiveReward,
  createReward,
  redeemReward,
  updateReward,
  type RewardInput,
  type RewardView,
} from '@/db/repositories/rewards';
// `usePotion` is an action of the repository, not a hook.
import { buyItem, usePotion as drinkPotion, type ShopView } from '@/db/repositories/shop';
import { announceOnIos } from '@/features/shared/announce';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { Card } from '@/features/shared/Card';
import { useCelebration } from '@/features/shared/Celebration';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { ThemedText } from '@/features/shared/ThemedText';
import { useEssential } from '@/features/shared/useGameMode';
import { useLargeText } from '@/features/shared/useLargeText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { HP } from '@/rules/config';
import { shopOffer } from '@/rules/shop';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useTheme } from '@/theme/ThemeProvider';
import { BuySheet } from './BuySheet';
import { InventoryList } from './InventoryList';
import { ItemCard } from './ItemCard';
import { ItemSprite } from './ItemSprite';
import { RedeemSheet } from './RedeemSheet';
import { NewRewardCard, RewardCard } from './RewardCard';
import { RewardSheet } from './RewardSheet';
import { useShopTexts } from './shopTexts';
import { useRewards } from './useShopView';

const COIN_SIZE = 48;

type Tab = 'shop' | 'inventory';

/** A card of the group «Le tue ricompense»: a reward or, last, «+ Nuova ricompensa». */
type RewardCell =
  { readonly kind: 'reward'; readonly reward: RewardView } | { readonly kind: 'new' };

/** A choice of the menu of a reward, done once the menu has slid away. */
interface Queued {
  readonly action: 'edit' | 'delete';
  readonly reward: RewardView;
}

export interface ShopScreenProps {
  readonly view: ShopView;
}

/**
 * Negozio e inventario (design-sezioni.md 7.1–7.6, mockup B6, D27, D28): the large balance with
 * the welcome of the theme, the two tabs with the names of the theme, the cards of the helps in 2
 * columns (1 with very large text), the personal rewards right after them (a virtualized list that
 * reads more while scrolling) and the objects owned. The balance is said after every purchase,
 * use or redemption (7.10). No rewards in the Essential mode (7.6), where the shop is hidden.
 */
export function ShopScreen({ view }: ShopScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const largeText = useLargeText();
  const toast = useUndoToast();
  const texts = useShopTexts();
  const heroName = useHeroStore((state) => state.hero?.name ?? '');
  const [tab, setTab] = useState<Tab>('shop');
  const [selected, setSelected] = useState<ItemKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const essential = useEssential();
  const { width, height } = useWindowDimensions();
  const { celebrate } = useCelebration();
  const rewardsPage = useRewards();
  const [redeeming, setRedeeming] = useState<RewardView | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [editing, setEditing] = useState<RewardView | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<RewardView | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [queued, setQueued] = useState<Queued | null>(null);
  const [deleting, setDeleting] = useState<RewardView | null>(null);

  // The editor or the dialog opens once the menu has slid away: two modals at once do not open
  // on iOS (as in the Registro).
  useEffect(() => {
    if (queued === null || menuOpen) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setQueued(null);
      if (queued.action === 'edit') {
        setEditing(queued.reward);
        setEditorOpen(true);
      } else {
        setDeleting(queued.reward);
      }
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [queued, menuOpen]);

  const offerOf = (key: ItemKey) => {
    const item = [...view.items, ...view.gifts].find((candidate) => candidate.key === key);
    return item === undefined ? null : { item, offer: shopOffer(item, view.coins, item.owned) };
  };
  const chosen = selected === null ? null : offerOf(selected);

  const tell = (message: string) => {
    toast.show({ message });
    announceOnIos(message);
  };
  const hpValues = (hp: number) => ({ hp: texts.hpTerm, value: hp, max: HP.max });

  const buy = (useNow: boolean) => {
    // A second tap while the sheet slides away buys nothing more.
    if (chosen === null || !sheetOpen) {
      return;
    }
    const { item, offer } = chosen;
    const name = texts.name(item.key);
    const result = runAction((db, clock) => buyItem(db, item.key, clock, { useNow }));
    setSheetOpen(false);
    const balance = texts.withCoins(offer.balanceAfter ?? view.coins - item.price);
    tell(
      result === null
        ? t('shop.bought', { name, ...balance })
        : t('shop.boughtUsed', { name, ...balance, ...hpValues(result.hp) }),
    );
  };

  const rewardOffer = (reward: RewardView) =>
    shopOffer({ price: reward.price, maxOwned: null }, view.coins, 0);

  const redeem = () => {
    // A second tap while the sheet slides away redeems nothing more.
    if (redeeming === null || !redeemOpen) {
      return;
    }
    const reward = redeeming;
    const { coins } = runAction((db, clock) => redeemReward(db, reward.id, clock));
    setRedeemOpen(false);
    // The short celebration of the theme (7.6); the toast says the reward and the balance.
    celebrate({
      xp: 0,
      coins: 0,
      origin: { x: width / 2, y: height / 2 },
      chipText: t('shop.rewards.chip'),
      silent: true,
    });
    tell(t('shop.rewards.enjoy', { name: reward.name, ...texts.withCoins(coins) }));
  };

  const saveReward = (input: RewardInput) => {
    if (!editorOpen) {
      return;
    }
    const reward = editing;
    runAction((db, clock) =>
      reward === null ? createReward(db, input, clock) : updateReward(db, reward.id, input),
    );
    setEditorOpen(false);
    const name = input.name.trim();
    tell(t(reward === null ? 'shop.rewards.created' : 'shop.rewards.saved', { name }));
  };

  const deleteReward = () => {
    const reward = deleting;
    setDeleting(null);
    if (reward === null) {
      return;
    }
    runAction((db, clock) => archiveReward(db, reward.id, clock));
    tell(t('shop.rewards.deleted', { name: reward.name }));
  };

  const openMenu = (reward: RewardView) => {
    setMenuFor(reward);
    setMenuOpen(true);
  };

  // The gift is given here; the companion sheet opens with the cheer (design 7.5, 6.8).
  const give = (key: GiftKey) => {
    runAction((db, clock) => giveGift(db, key, clock));
    router.push('/companion?cheer=1');
  };

  const drink = () => {
    const { hp } = runAction((db, clock) => drinkPotion(db, clock));
    tell(t('shop.used', { name: texts.name('potion'), ...hpValues(hp) }));
  };

  const balanceLabel = t('shop.balanceLabel', texts.withCoins(view.coins));
  const tabs = [
    { value: 'shop' as const, label: t('shop.title', { context: family }) },
    { value: 'inventory' as const, label: t('shop.inventory', { context: family }) },
  ];

  const columns = largeText ? 1 : 2;
  const top = (
    <>
      <Card testID="shop-balance">
        <View style={[styles.balance, largeText ? styles.balanceColumn : null]}>
          <View
            accessible
            accessibilityLabel={balanceLabel}
            accessibilityLiveRegion="polite"
            style={styles.coins}
          >
            <ItemSprite object="coin" size={COIN_SIZE} />
            <View>
              <ThemedText testID="shop-balance-coins" variant="display">
                {view.coins}
              </ThemedText>
              <ThemedText variant="caption" color={colors.textMuted}>
                {t('lexicon.coins_pl', { context: family })}
              </ThemedText>
            </View>
          </View>
          <ThemedText
            testID="shop-welcome"
            color={colors.textMuted}
            style={largeText ? null : styles.welcome}
          >
            {t('shop.welcome', { context: family, hero: heroName })}
          </ThemedText>
        </View>
      </Card>
      <SegmentedControl
        testID="shop-tabs"
        accessibilityLabel={t('shop.tabs')}
        options={tabs}
        value={tab}
        onChange={setTab}
      />
    </>
  );

  const group = (title: string, items: ShopView['items'], testID: string) => (
    <View style={styles.group}>
      <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
        {title}
      </ThemedText>
      <View testID={testID} style={styles.column}>
        {rowsOf(items, columns).map((row) => (
          <GridRow key={row.map((item) => item.key).join()} columns={columns} count={row.length}>
            {row.map((item) => (
              <ItemCard
                key={item.key}
                item={item}
                offer={shopOffer(item, view.coins, item.owned)}
                onPress={() => {
                  setSelected(item.key);
                  setSheetOpen(true);
                }}
              />
            ))}
          </GridRow>
        ))}
      </View>
    </View>
  );
  const helps = group(t('shop.helps'), view.items, 'shop-grid');
  // Gifts for the companion (Could), after the rewards (design 7.1); hidden with the shop in the
  // Essential mode.
  const giftsGroup = essential ? undefined : (
    <View style={styles.footer}>{group(t('shop.gifts.title'), view.gifts, 'shop-gifts')}</View>
  );

  // The cards of the rewards; «+ Nuova ricompensa» comes last, once every reward is read.
  const cells: RewardCell[] = essential
    ? []
    : [
        ...rewardsPage.rewards.map((reward) => ({ kind: 'reward' as const, reward })),
        ...(rewardsPage.hasMore ? [] : [{ kind: 'new' as const }]),
      ];
  const rewardRows = rowsOf(cells, columns);
  const cellKey = (cell: RewardCell) => (cell.kind === 'new' ? 'new' : cell.reward.id);

  return (
    <View testID="shop-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="shop-header"
        title={t('shop.title', { context: family })}
        compact
        onBack={() => router.back()}
      />
      {tab === 'shop' ? (
        <FlatList
          testID="shop-list"
          data={rewardRows}
          keyExtractor={(row) => row.map(cellKey).join()}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              {top}
              {helps}
              {essential ? null : (
                <ThemedText
                  testID="shop-rewards-title"
                  variant="label"
                  accessibilityRole="header"
                  color={colors.textMuted}
                >
                  {t('shop.rewards.title')}
                </ThemedText>
              )}
            </View>
          }
          ListFooterComponent={giftsGroup}
          ItemSeparatorComponent={RowGap}
          renderItem={({ item: row }) => (
            <GridRow columns={columns} count={row.length}>
              {row.map((cell) =>
                cell.kind === 'new' ? (
                  <NewRewardCard
                    key="new"
                    showExample={rewardsPage.rewards.length === 0}
                    onPress={() => {
                      setEditing(null);
                      setEditorOpen(true);
                    }}
                  />
                ) : (
                  <RewardCard
                    key={cell.reward.id}
                    reward={cell.reward}
                    offer={rewardOffer(cell.reward)}
                    onPress={() => {
                      setRedeeming(cell.reward);
                      setRedeemOpen(true);
                    }}
                    onMenu={() => openMenu(cell.reward)}
                  />
                ),
              )}
            </GridRow>
          )}
          onEndReached={rewardsPage.loadMore}
          onEndReachedThreshold={0.5}
          initialNumToRender={6}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            {top}
            <InventoryList view={view} onUsePotion={drink} onGiveGift={give} />
          </View>
        </ScrollView>
      )}
      <BuySheet
        visible={sheetOpen}
        item={chosen?.item ?? null}
        offer={chosen?.offer ?? null}
        coins={view.coins}
        canUsePotion={view.canUsePotion}
        onBuy={buy}
        onClose={() => setSheetOpen(false)}
      />
      <RedeemSheet
        visible={redeemOpen}
        reward={redeeming}
        offer={redeeming === null ? null : rewardOffer(redeeming)}
        coins={view.coins}
        onRedeem={redeem}
        onClose={() => setRedeemOpen(false)}
      />
      <RewardSheet
        visible={editorOpen}
        reward={editing}
        onSave={saveReward}
        onClose={() => setEditorOpen(false)}
      />
      <ActionSheet
        testID="shop-reward-actions"
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={menuFor?.name}
        items={[
          {
            key: 'edit',
            label: t('shop.rewards.edit'),
            onPress: () => setQueued(menuFor === null ? null : { action: 'edit', reward: menuFor }),
          },
          {
            key: 'delete',
            label: t('shop.rewards.delete'),
            destructive: true,
            onPress: () =>
              setQueued(menuFor === null ? null : { action: 'delete', reward: menuFor }),
          },
        ]}
      />
      <ConfirmDialog
        testID="shop-reward-delete"
        visible={deleting !== null}
        title={t('shop.rewards.deleteTitle', { name: deleting?.name ?? '' })}
        message={t('shop.rewards.deleteMessage')}
        confirmLabel={t('shop.rewards.delete')}
        onConfirm={deleteReward}
        onCancel={() => setDeleting(null)}
      />
    </View>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

/** A row of the grid; the last card of an odd row keeps the width of a column. */
function GridRow({
  columns,
  count,
  children,
}: {
  readonly columns: number;
  readonly count: number;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      {children}
      {count < columns ? <View style={styles.spacer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16 },
  header: { gap: 16, paddingBottom: 8 },
  rowGap: { height: 12 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  balanceColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcome: { flex: 1, textAlign: 'right' },
  group: { gap: 8 },
  footer: { paddingTop: 24 },
  column: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  spacer: { flex: 1 },
});

/** The cards in rows of `columns`: 2, or 1 with very large text (7.10). */
function rowsOf<T>(items: readonly T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}
