import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GiftKey } from '@/content/shop';
import { giveGift, renameCompanion, type CompanionView } from '@/db/repositories/companion';
import type { ShopViewItem } from '@/db/repositories/shop';
import { announceOnIos } from '@/features/shared/announce';
import { Bar } from '@/features/shared/Bar';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { CompanionSprite, useCompanionDescription } from '@/features/shared/CompanionSprite';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useEssential } from '@/features/shared/useGameMode';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { ItemSprite } from '@/features/shop/ItemSprite';
import { useShopTexts } from '@/features/shop/shopTexts';
import { termInSentence } from '@/i18n/lexicon';
import { companionName } from '@/rules/companion';
import { COMPANION } from '@/rules/config';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { textStyleOf } from '@/theme/fonts';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { GIFT_CHEER, GiftCheer } from './GiftCheer';
import { HABITAT_RATIO, Habitat } from './Habitat';

/** 32×32 at 6× (design-sezioni.md 6.2). */
const SPRITE_SIZE = 192;
/** The habitat takes about half of the screen, never more than this share of its height. */
const HABITAT_MAX_SHARE = 0.55;
const JUMP = 16;
const JUMP_UP_MS = 140;
const JUMP_DOWN_MS = 180;
/** Phrases of each group in the language files (`companion.lines.<group>.1…3`), used in turn. */
const LINES_PER_GROUP = 3;
const FIELD_HEIGHT = 56;
const MOOD_SPRITE_SIZE = 48;
const GIFT_SPRITE_SIZE = 40;

export interface CompanionScreenProps {
  readonly view: CompanionView;
  /** The gifts of the shop with the number owned (US-COMP-04). */
  readonly gifts: readonly ShopViewItem[];
  /** A gift was just given from the inventory: the sheet opens with the cheer (design 7.5). */
  readonly cheerOnOpen?: boolean;
}

/**
 * The companion sheet (design-sezioni.md 6.1, 6.2, 6.4, 6.7, 6.9, 6.12; mockup B8, D26): the
 * habitat of the theme with the companion at 6×, which jumps and speaks in a bubble when touched
 * (draft phrases, never about missed missions); the name with a pencil that turns it into a field
 * (up to 20 characters, Invio confirms); the stage; the growth bar with the missions still missing;
 * the mood card with its word and why (6.3, mockup D26B): the share of the last 3 days, today's
 * completion, and when sad how to make it happy again. The egg has no mood yet, so no card.
 * «Fai un regalo» (6.8, Could) opens the gifts owned; giving one makes the companion cheer for
 * about 2 seconds with the effect of the theme, then the bubble reminds the missions. No gifts in
 * the Essential mode (6.11), where the shop is hidden, and none for the egg.
 */
export function CompanionScreen({ view, gifts, cheerOnOpen = false }: CompanionScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const heroName = useHeroStore((state) => state.hero?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [taps, setTaps] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [cheering, setCheering] = useState(false);
  const essential = useEssential();
  const shopTexts = useShopTexts();
  const cheerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jump = useSharedValue(0);
  const jumping = useAnimatedStyle(() => ({ transform: [{ translateY: jump.get() }] }));

  const { stage, mood, growth, moodWindow, doneToday } = view;
  const themeDefault = t('lexicon.companion', { context: family });
  const name = companionName(view.name, themeDefault);
  const pose = cheering ? (reduceMotion ? 'happy' : 'cheering') : mood;
  const description = useCompanionDescription({ stage, mood: pose, name });
  const habitatWidth = Math.min(window.width, window.height * HABITAT_MAX_SHARE * HABITAT_RATIO);
  const term = (count: number) =>
    termInSentence(
      t(count === 1 ? 'lexicon.missions' : 'lexicon.missions_pl', { context: family }),
      i18n.language,
    );

  const cheer = () => {
    setLine(null);
    setCheering(true);
    if (!reduceMotion) {
      const hop = () => [
        withTiming(-GIFT_CHEER.hopHeight, { duration: GIFT_CHEER.hopUpMs }),
        withTiming(0, { duration: GIFT_CHEER.hopDownMs }),
      ];
      jump.set(withSequence(...hop(), ...hop()));
    }
    if (cheerTimer.current !== null) {
      clearTimeout(cheerTimer.current);
    }
    cheerTimer.current = setTimeout(() => {
      cheerTimer.current = null;
      setCheering(false);
      const text = t('companion.gift.thanks', { hero: heroName });
      setLine(text);
      announceOnIos(t('companion.says', { name, text }));
    }, GIFT_CHEER.durationMs);
  };
  useEffect(
    () => () => {
      if (cheerTimer.current !== null) {
        clearTimeout(cheerTimer.current);
      }
    },
    [],
  );
  // Opened right after «Dona» in the inventory: the cheer starts once.
  const cheered = useRef(false);
  useEffect(() => {
    if (cheerOnOpen && !cheered.current) {
      cheered.current = true;
      cheer();
    }
    // Only on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const give = (key: GiftKey) => {
    // A second tap while the sheet slides away gives nothing more.
    if (!giftsOpen) {
      return;
    }
    runAction((db, clock) => giveGift(db, key, clock));
    setGiftsOpen(false);
    announceOnIos(t('companion.gift.given', { name, gift: shopTexts.name(key) }));
    cheer();
  };

  const say = () => {
    const group = stage === 'egg' ? 'egg' : mood;
    const text = t(`companion.lines.${group}.${(taps % LINES_PER_GROUP) + 1}`, { hero: heroName });
    setTaps(taps + 1);
    setLine(text);
    announceOnIos(t('companion.says', { name, text }));
    if (!reduceMotion) {
      jump.set(
        withSequence(
          withTiming(-JUMP, { duration: JUMP_UP_MS }),
          withTiming(0, { duration: JUMP_DOWN_MS }),
        ),
      );
    }
  };

  const startEditing = () => {
    setDraft(name);
    setEditing(true);
  };
  const save = () => {
    if (!editing) {
      return;
    }
    setEditing(false);
    runAction((db, clock) => renameCompanion(db, draft, themeDefault, clock));
  };

  const count =
    growth.target === null
      ? t('companion.total', { done: growth.done, term: term(growth.done) })
      : t('companion.count', {
          done: growth.done,
          target: growth.target,
          term: term(growth.target),
        });
  const hint =
    stage === 'egg'
      ? t('companion.eggHint')
      : growth.target === null
        ? t('companion.adultHint', { name })
        : t('companion.left', { left: growth.left, term: term(growth.left) });
  const growthTitle = t(stage === 'egg' ? 'companion.hatch' : 'companion.growth');
  const barMax = growth.target ?? Math.max(growth.done, 1);
  const moodReasons = [
    doneToday > 0 ? t('companion.moodToday', { name }) : null,
    moodWindow.percent === null
      ? t('companion.moodNone', { days: moodWindow.days })
      : t('companion.moodShare', {
          days: moodWindow.days,
          done: moodWindow.done,
          scheduled: moodWindow.scheduled,
          percent: moodWindow.percent,
          termDone: term(moodWindow.done),
          termScheduled: term(moodWindow.scheduled),
        }),
    view.giftRaised ? t('companion.gift.giftedToday') : null,
    mood === 'sad' ? t('companion.moodSad') : null,
  ].filter((reason): reason is string => reason !== null);

  return (
    <View testID="companion-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="companion-scroll"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottom + 24 }}
      >
        <View style={styles.habitat}>
          <Habitat width={habitatWidth}>
            {cheering ? <GiftCheer width={habitatWidth} reduced={reduceMotion} /> : null}
            {line === null ? null : (
              <Pressable
                testID="companion-bubble"
                accessibilityLabel={t('companion.says', { name, text: line })}
                accessibilityHint={t('companion.closeBubble')}
                accessibilityLiveRegion="polite"
                onPress={() => setLine(null)}
                style={[styles.bubble, { backgroundColor: colors.surface }]}
              >
                <ThemedText variant="body">{line}</ThemedText>
              </Pressable>
            )}
            <Pressable
              testID="companion-pet"
              accessibilityRole="button"
              accessibilityLabel={description}
              accessibilityHint={t('companion.tapHint')}
              onPress={say}
            >
              {/* The button already says what the sprite shows. */}
              <Animated.View
                style={jumping}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <CompanionSprite
                  stage={stage}
                  mood={pose}
                  name={name}
                  size={SPRITE_SIZE}
                  testID="companion-sprite"
                />
              </Animated.View>
            </Pressable>
          </Habitat>
        </View>

        <View style={styles.identity}>
          {editing ? (
            <View style={styles.form}>
              <View style={styles.field}>
                <Frame
                  shape={SHAPES[family].control}
                  fill={colors.surface}
                  stroke={colors.textMuted}
                />
                <TextInput
                  testID="companion-name-input"
                  value={draft}
                  onChangeText={(text) => setDraft(text.slice(0, COMPANION.nameMaxLength))}
                  onSubmitEditing={save}
                  onBlur={save}
                  placeholder={themeDefault}
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.primary}
                  maxLength={COMPANION.nameMaxLength}
                  maxFontSizeMultiplier={MAX_TEXT_SCALE}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  accessibilityLabel={t('companion.nameLabel')}
                  style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
                />
              </View>
              <ThemedText variant="caption" color={colors.textMuted}>
                {t('companion.nameHint', { max: COMPANION.nameMaxLength })}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <ThemedText
                testID="companion-name"
                variant="screenTitle"
                accessibilityRole="header"
                numberOfLines={1}
                style={styles.name}
              >
                {name}
              </ThemedText>
              <Pressable
                testID="companion-rename"
                accessibilityRole="button"
                accessibilityLabel={t('companion.rename')}
                onPress={startEditing}
                style={styles.pencil}
              >
                <Icon name="modifica" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
          )}
          <ThemedText testID="companion-stage" variant="label" color={colors.textMuted}>
            {t('companion.stageLine', {
              stage: t(`companion.stage.${stage}`),
              number: growth.stageNumber,
              count: growth.stageCount,
            })}
          </ThemedText>
        </View>

        <Card testID="companion-growth" style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.growthHead}>
              <ThemedText variant="caption" color={colors.textMuted}>
                {growthTitle}
              </ThemedText>
              <ThemedText testID="companion-growth-count" variant="label">
                {count}
              </ThemedText>
            </View>
            <Bar
              kind="stat"
              label={growthTitle}
              value={growth.target === null ? barMax : growth.done}
              max={barMax}
              showLabel={false}
              showValue={false}
              testID="companion-growth-bar"
            />
            <ThemedText testID="companion-growth-hint" variant="body">
              {hint}
            </ThemedText>
          </View>
        </Card>
        {stage === 'egg' ? null : (
          <Card testID="companion-mood" style={styles.card}>
            <View style={styles.moodRow}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <CompanionSprite stage={stage} mood={mood} name={name} size={MOOD_SPRITE_SIZE} />
              </View>
              <View style={styles.moodTexts}>
                <ThemedText variant="caption" color={colors.textMuted}>
                  {t('companion.moodTitle')}
                </ThemedText>
                <ThemedText testID="companion-mood-word" variant="label">
                  {t(`companion.mood.${mood}`)}
                </ThemedText>
                <ThemedText testID="companion-mood-reason" variant="body">
                  {moodReasons.join(' ')}
                </ThemedText>
              </View>
            </View>
          </Card>
        )}
        {stage === 'egg' || essential ? null : (
          <Card testID="companion-gift" style={styles.card}>
            <Pressable
              testID="companion-gift-open"
              accessibilityRole="button"
              accessibilityLabel={t('companion.gift.row')}
              accessibilityHint={t('companion.gift.rowHint')}
              onPress={() => setGiftsOpen(true)}
              style={styles.giftRow}
            >
              <Icon name="regalo" color={colors.text} />
              <ThemedText variant="label" style={styles.flex}>
                {t('companion.gift.row')}
              </ThemedText>
              <Icon name="avanti" size={20} color={colors.textMuted} />
            </Pressable>
          </Card>
        )}
      </ScrollView>
      <GiftSheet
        visible={giftsOpen}
        gifts={gifts}
        alreadyHappy={mood === 'happy'}
        onGive={give}
        onShop={() => {
          setGiftsOpen(false);
          router.push('/shop');
        }}
        onClose={() => setGiftsOpen(false)}
      />

      <Pressable
        testID="companion-back"
        accessibilityRole="button"
        accessibilityLabel={t('shared.back')}
        onPress={() => router.back()}
        style={[styles.back, { top: top + 8, backgroundColor: colors.surface }]}
      >
        <Icon name="indietro" color={colors.text} />
      </Pressable>
    </View>
  );
}

/** The gifts owned with their number and «Dona»; none: «Compra nel Negozio» (design 6.8). */
function GiftSheet({
  visible,
  gifts,
  alreadyHappy,
  onGive,
  onShop,
  onClose,
}: {
  readonly visible: boolean;
  readonly gifts: readonly ShopViewItem[];
  readonly alreadyHappy: boolean;
  readonly onGive: (key: GiftKey) => void;
  readonly onShop: () => void;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const texts = useShopTexts();
  const owned = gifts.filter((gift) => gift.owned > 0);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('companion.gift.title')}
      testID="companion-gift-sheet"
    >
      {owned.length === 0 ? (
        <View style={styles.giftList}>
          <ThemedText testID="companion-gift-none" color={colors.textMuted}>
            {t('companion.gift.none')}
          </ThemedText>
          <Button testID="companion-gift-shop" label={t('companion.gift.buy')} onPress={onShop} />
        </View>
      ) : (
        <View style={styles.giftList}>
          {alreadyHappy ? (
            <ThemedText testID="companion-gift-happy" variant="caption" color={colors.textMuted}>
              {t('companion.gift.alreadyHappy')}
            </ThemedText>
          ) : null}
          {owned.map((gift) => {
            const giftName = texts.name(gift.key);
            const quantity = t('shop.quantity', { count: gift.owned });
            return (
              <View key={gift.key} testID={`companion-gift-${gift.key}`} style={styles.giftItem}>
                <View
                  accessible
                  accessibilityLabel={`${giftName}, ${t('shop.owned', { count: gift.owned })}`}
                  style={styles.giftName}
                >
                  <ItemSprite object={gift.key as GiftKey} size={GIFT_SPRITE_SIZE} />
                  <ThemedText style={styles.flex}>
                    {giftName} <ThemedText color={colors.textMuted}>{quantity}</ThemedText>
                  </ThemedText>
                </View>
                <Button
                  testID={`companion-gift-give-${gift.key}`}
                  label={t('companion.gift.give')}
                  accessibilityLabel={`${t('companion.gift.give')} ${giftName}`}
                  onPress={() => onGive(gift.key as GiftKey)}
                />
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  giftRow: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12 },
  giftList: { gap: 12, paddingVertical: 8 },
  giftItem: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  giftName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitat: { alignItems: 'center' },
  bubble: {
    maxWidth: 260,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  identity: { alignItems: 'center', gap: 4, paddingHorizontal: 20, paddingTop: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1 },
  pencil: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { alignSelf: 'stretch', gap: 8, alignItems: 'center' },
  field: { alignSelf: 'stretch', minHeight: FIELD_HEIGHT, justifyContent: 'center' },
  input: { minHeight: FIELD_HEIGHT, paddingHorizontal: 16, textAlign: 'center' },
  card: { marginHorizontal: 16, marginTop: 16 },
  cardContent: { gap: 12 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  moodTexts: { flex: 1, gap: 4 },
  growthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  back: {
    position: 'absolute',
    left: 12,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
