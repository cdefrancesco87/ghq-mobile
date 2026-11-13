import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ItemKey } from '@/content/shop';
// `usePotion` is an action of the repository, not a hook.
import { buyItem, usePotion as drinkPotion, type ShopView } from '@/db/repositories/shop';
import { announceOnIos } from '@/features/shared/announce';
import { Card } from '@/features/shared/Card';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { ThemedText } from '@/features/shared/ThemedText';
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
import { useShopTexts } from './shopTexts';

const COIN_SIZE = 48;

type Tab = 'shop' | 'inventory';

export interface ShopScreenProps {
  readonly view: ShopView;
}

/**
 * Negozio e inventario (design-sezioni.md 7.1–7.5, mockup B6, D27, D28): the large balance with
 * the welcome of the theme, the two tabs with the names of the theme, the cards of the helps in 2
 * columns (1 with very large text) and the objects owned. The balance is said after every purchase
 * or use (7.10).
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

  const offerOf = (key: ItemKey) => {
    const item = view.items.find((candidate) => candidate.key === key);
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

  const drink = () => {
    const { hp } = runAction((db, clock) => drinkPotion(db, clock));
    tell(t('shop.used', { name: texts.name('potion'), ...hpValues(hp) }));
  };

  const balanceLabel = t('shop.balanceLabel', texts.withCoins(view.coins));
  const tabs = [
    { value: 'shop' as const, label: t('shop.title', { context: family }) },
    { value: 'inventory' as const, label: t('shop.inventory', { context: family }) },
  ];

  return (
    <View testID="shop-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="shop-header"
        title={t('shop.title', { context: family })}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
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
        {tab === 'shop' ? (
          <View style={styles.group}>
            <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
              {t('shop.helps')}
            </ThemedText>
            <View testID="shop-grid" style={styles.column}>
              {rowsOf(view.items, largeText ? 1 : 2).map((row) => (
                <View key={row.map((item) => item.key).join()} style={styles.row}>
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
                  {/* The last card of an odd row keeps the width of a column. */}
                  {row.length < (largeText ? 1 : 2) ? <View style={styles.spacer} /> : null}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <InventoryList view={view} onUsePotion={drink} />
        )}
      </ScrollView>
      <BuySheet
        visible={sheetOpen}
        item={chosen?.item ?? null}
        offer={chosen?.offer ?? null}
        coins={view.coins}
        canUsePotion={view.canUsePotion}
        onBuy={buy}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 16 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  balanceColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcome: { flex: 1, textAlign: 'right' },
  group: { gap: 8 },
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
