import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TITLE_KEYS } from '@/content/titles';
import type { TodayView } from '@/db/repositories/todayView';
import { Bar } from '@/features/shared/Bar';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { termInSentence } from '@/i18n/lexicon';
import { companionName as nameOf } from '@/rules/companion';
import { HP } from '@/rules/config';
import { titleIndex } from '@/rules/level';
import { useTheme } from '@/theme/ThemeProvider';

/** The link to Statistiche pulses once when it is the next step of the starter quest (1.8). */
const PULSE_SCALE = 1.15;
const PULSE_MS = 250;

/** The companion is smaller in Minimal, where the game stays in the background (design 2.2). */
const COMPANION_SIZE = 64;
const COMPANION_SIZE_MINIMAL = 40;

export interface HeroCardProps {
  readonly view: TodayView;
}

/**
 * The hero at the top of Today (design-sezioni.md 2.2): companion, level, health and experience
 * bars, streak and coins. The screen reader reads them in this order (2.11), so the streak chip
 * comes after the bars in the tree and is only drawn at the top right. With very large text the
 * card goes on more rows: bars one under the other, streak beside the coins (A11.1).
 */
export function HeroCard({ view }: HeroCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const largeText = useLargeText();
  const [streakWidth, setStreakWidth] = useState(0);
  const { hero, xpToNext, companion, notices, starterQuest } = view;
  const reduceMotion = useReduceMotion();
  // Only the last step of the quest is left: opening the statistics.
  const statsNext =
    starterQuest !== null &&
    starterQuest.steps.at(-1)?.done === false &&
    starterQuest.steps.slice(0, -1).every((step) => step.done);
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (statsNext && !reduceMotion) {
      pulse.set(
        withSequence(
          withTiming(PULSE_SCALE, { duration: PULSE_MS }),
          withTiming(1, { duration: PULSE_MS }),
        ),
      );
    }
  }, [pulse, reduceMotion, statsNext]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const xpTerm = t('lexicon.xp', { context: family });
  const streakTerm = t('lexicon.streak', { context: family });
  const coinsTerm = t('lexicon.coins_pl', { context: family });
  const companionName = nameOf(companion.name, t('lexicon.companion', { context: family }));

  // The streak opens Statistiche: the step «Apri le statistiche» of the starter quest (1.8).
  const streak = (
    <Animated.View testID={statsNext ? 'today-hero-stats-pulse' : undefined} style={pulseStyle}>
      <Chip
        testID="today-hero-streak"
        icon="serie"
        label={t('today.hero.streak', { count: hero.streak, term: streakTerm })}
        accessibilityLabel={t('today.hero.streakLabel', { count: hero.streak, term: streakTerm })}
        onPress={() => router.push('/stats')}
      />
    </Animated.View>
  );

  return (
    <Card testID="today-hero">
      <View>
        <View style={styles.top}>
          <Pressable
            testID="today-hero-companion"
            accessibilityRole="button"
            accessibilityLabel={t('today.hero.companionLabel', { name: companionName })}
            onPress={() => router.push('/companion')}
          >
            <CompanionSprite
              stage={companion.stage}
              mood={companion.mood}
              name={companionName}
              size={family === 'minimal' ? COMPANION_SIZE_MINIMAL : COMPANION_SIZE}
            />
          </Pressable>
          <View style={styles.identity}>
            {family === 'minimal' ? null : (
              <ThemedText variant="label" testID="today-hero-name">
                {hero.name}
              </ThemedText>
            )}
            {family === 'minimal' ? null : (
              <ThemedText variant="caption" color={colors.textMuted} testID="today-hero-title">
                {t(`titles.${family}.${TITLE_KEYS[family][titleIndex(hero.level)]}`)}
              </ThemedText>
            )}
            <ThemedText variant="label" testID="today-hero-level">
              {t('today.hero.level', {
                term: t('lexicon.level', { context: family }),
                level: hero.level,
              })}
            </ThemedText>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('today.hero.toNext', {
                xp: xpToNext - hero.xpInLevel,
                xpTerm: termInSentence(xpTerm, i18n.language),
              })}
            </ThemedText>
          </View>
          {/* Room for the streak chip, drawn here but read after the bars. */}
          {largeText ? null : <View style={{ width: streakWidth }} />}
        </View>
        <View style={[styles.bars, largeText ? styles.barsStacked : null]}>
          <View style={largeText ? null : styles.bar}>
            <Bar
              kind="hp"
              label={t('lexicon.hp', { context: family })}
              value={hero.hp}
              max={HP.max}
              testID="today-hero-hp"
            />
          </View>
          <View style={largeText ? null : styles.bar}>
            <Bar
              kind="xp"
              label={xpTerm}
              value={hero.xpInLevel}
              max={xpToNext}
              testID="today-hero-xp"
            />
          </View>
        </View>
        {largeText ? null : (
          <View
            testID="today-hero-streak-corner"
            style={styles.streakCorner}
            onLayout={({ nativeEvent }) => setStreakWidth(nativeEvent.layout.width)}
          >
            {streak}
          </View>
        )}
        <View style={styles.chips}>
          {largeText ? streak : null}
          <Chip
            testID="today-hero-coins"
            icon="moneta"
            label={t('today.hero.coins', { count: hero.coins, term: coinsTerm })}
            accessibilityLabel={t('today.hero.coinsLabel', { count: hero.coins, term: coinsTerm })}
            onPress={() => router.push('/shop')}
          />
        </View>
        {notices.exhausted ? (
          <View testID="today-hero-exhausted" accessible style={styles.exhausted}>
            <Icon name="esausto" size={16} color={colors.dangerText} />
            <ThemedText variant="caption" color={colors.dangerText} style={styles.flex}>
              {t('today.hero.exhausted', {
                term: t('lexicon.exhausted', { context: family }),
                xpTerm: termInSentence(t('lexicon.xp_pl', { context: family }), i18n.language),
              })}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  identity: { flex: 1, gap: 2 },
  bars: { flexDirection: 'row', gap: 16, marginTop: 16 },
  barsStacked: { flexDirection: 'column', gap: 12 },
  bar: { flex: 1 },
  streakCorner: { position: 'absolute', top: 0, right: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  exhausted: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  flex: { flex: 1 },
});
