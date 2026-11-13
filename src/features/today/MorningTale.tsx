import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { STARTER_QUEST } from '@/db/repositories/onboarding';
import { openTale, type TaleBubble } from '@/db/repositories/tale';
import type { TodayView } from '@/db/repositories/todayView';
import { plainTale, taleSegments, taleVariants } from '@/features/companion/taleTexts';
import { Card } from '@/features/shared/Card';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { hitSlopFor } from '@/features/shared/touch';
import { REDUCED_FADE_MS, useReduceMotion } from '@/features/shared/useReduceMotion';
import { RESOURCES, type Language } from '@/i18n';
import { companionName } from '@/rules/companion';
import { getSession } from '@/stores/session';
import { textStyleOf } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const SPRITE_SIZE = 40;
const CLOSE_ICON = 20;
/** The entry of the bubble, the same jump as a touch on the companion (design 6.4). */
const JUMP = 8;
const JUMP_UP_MS = 140;
const JUMP_DOWN_MS = 180;

function languageOf(language: string): Language {
  return language in RESOURCES ? (language as Language) : 'en';
}

/**
 * The morning bubble of today: asked once per game day while Today is open (the first opening of
 * the day records it, so it does not come back until tomorrow), kept until it is closed.
 */
export function useMorningTale(view: TodayView): {
  readonly bubble: TaleBubble | null;
  readonly close: () => void;
} {
  const { i18n } = useTranslation();
  const [bubble, setBubble] = useState<TaleBubble | null>(null);
  // Asked once per day, also when React runs the effect twice.
  const askedDay = useRef<string | null>(null);
  const mood = view.companion.mood;
  const language = languageOf(i18n.language);

  useEffect(() => {
    if (askedDay.current === view.day) {
      return;
    }
    askedDay.current = view.day;
    const { db, clock } = getSession();
    setBubble(openTale(db, clock(), { mood, variants: taleVariants(language) }));
  }, [view.day, mood, language]);

  return {
    bubble: bubble?.day === view.day ? bubble : null,
    close: () => setBubble(null),
  };
}

export interface MorningTaleProps {
  readonly view: TodayView;
  readonly bubble: TaleBubble;
  readonly onClose: () => void;
}

/**
 * The morning bubble of the companion under the hero card (design-sezioni.md 2.2, 6.14): the
 * companion in the pose of its mood and at most two sentences, about yesterday and for today,
 * the numbers in bold. A touch anywhere on it or the X closes it. The screen reader reads it as
 * «Cloudy dice: …» after the hero card, without taking the focus; with «Riduci movimento» it only
 * fades in.
 */
export function MorningTale({ view, bubble, onClose }: MorningTaleProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  // The bold of the numbers: the face of the labels at the size of the text around it.
  const bold = { fontFamily: textStyleOf(typography.label).fontFamily };
  const reduceMotion = useReduceMotion();
  const name = companionName(view.companion.name, t('lexicon.companion', { context: family }));
  const { boss } = bubble.params;
  const params = {
    ...bubble.params,
    hero: view.hero.name,
    companion: name,
    boss:
      boss === null ? '' : boss.starter ? t(STARTER_QUEST.name, { context: family }) : boss.name,
  };
  const text = bubble.keys.map((key) => t(key, params)).join(' ');

  const opacity = useSharedValue(0);
  const offset = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      opacity.set(withTiming(1, { duration: REDUCED_FADE_MS }));
      return;
    }
    opacity.set(withTiming(1, { duration: JUMP_UP_MS }));
    offset.set(
      withSequence(
        withTiming(-JUMP, { duration: JUMP_UP_MS }),
        withTiming(0, { duration: JUMP_DOWN_MS }),
      ),
    );
  }, [offset, opacity, reduceMotion]);
  const entry = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <Animated.View style={entry}>
      <Pressable
        testID="today-tale"
        accessibilityLabel={t('companion.says', { name, text: plainTale(text) })}
        accessibilityHint={t('companion.closeBubble')}
        onPress={onClose}
      >
        <Card>
          <View style={styles.row}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <CompanionSprite stage={view.companion.stage} mood={bubble.mood} size={SPRITE_SIZE} />
            </View>
            <ThemedText testID="today-tale-text" style={styles.text}>
              {taleSegments(text).map((segment, index) =>
                segment.bold ? (
                  <Text key={index} style={bold}>
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                ),
              )}
            </ThemedText>
            <Pressable
              testID="today-tale-close"
              accessibilityRole="button"
              accessibilityLabel={t('companion.closeBubble')}
              onPress={onClose}
              hitSlop={hitSlopFor(CLOSE_ICON)}
            >
              <Icon name="chiudi" size={CLOSE_ICON} color={colors.textMuted} />
            </Pressable>
          </View>
        </Card>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  text: { flex: 1 },
});
