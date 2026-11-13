import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { CompanionStage } from '@/rules/companion';
import { Card } from '@/features/shared/Card';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { ThemedText } from '@/features/shared/ThemedText';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { termInSentence } from '@/i18n/lexicon';
import { FULL_DAY, SKIP_TODAY } from '@/rules/config';
import { useTheme } from '@/theme/ThemeProvider';

const COMPANION_SIZE = 96;
/** With «Riduci movimento» only a fade (design-sezioni.md A7). */
const REDUCED_FADE_MS = 150;
const POP_SCALE = 1.08;

export interface FullDayCardProps {
  readonly companionStage: CompanionStage;
}

/**
 * «Giornata completa» (design-sezioni.md 2.7, mockup D10A): in place of the counter once every
 * mission of the day is done, with the happy companion, the name of the theme and the bonus. It
 * stays until the day change and goes if an undo opens the day again.
 */
export function FullDayCard({ companionStage }: FullDayCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const reduceMotion = useReduceMotion();
  const appear = useSharedValue(0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.9);

  useEffect(() => {
    if (reduceMotion) {
      scale.set(1);
      appear.set(withTiming(1, { duration: REDUCED_FADE_MS }));
      return;
    }
    // A short pop of the theme in 1.5 seconds: in, a little bigger, then still.
    const third = SKIP_TODAY.fullDayCardMs / 3;
    appear.set(withTiming(1, { duration: third }));
    scale.set(
      withSequence(
        withTiming(POP_SCALE, { duration: third }),
        withTiming(1, { duration: third }),
        withTiming(1, { duration: third }),
      ),
    );
  }, [appear, reduceMotion, scale]);

  const animated = useAnimatedStyle(() => ({
    opacity: appear.get(),
    transform: [{ scale: scale.get() }],
  }));

  const title = t('lexicon.fullDay', { context: family });
  const values = {
    coins: FULL_DAY.bonusCoins,
    coinsTerm: termInSentence(t('lexicon.coins_pl', { context: family }), i18n.language),
    hp: FULL_DAY.bonusHp,
    hpTerm: termInSentence(t('lexicon.hp', { context: family }), i18n.language),
  };

  return (
    <Animated.View style={animated}>
      <Card testID="today-full-day">
        <View
          accessible
          accessibilityLabel={t('today.fullDay.label', { title, ...values })}
          style={styles.content}
        >
          <CompanionSprite stage={companionStage} mood="happy" size={COMPANION_SIZE} />
          <ThemedText variant="screenTitle" style={styles.centred}>
            {title}
          </ThemedText>
          <ThemedText
            testID="today-full-day-rewards"
            variant="numbers"
            color={colors.textMuted}
            style={styles.centred}
          >
            {t('today.fullDay.rewards', values)}
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  centred: { textAlign: 'center' },
});
