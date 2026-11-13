import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

export const HEADER_LARGE_HEIGHT = 96;
export const HEADER_COMPACT_HEIGHT = 56;

const COLLAPSE_DISTANCE = HEADER_LARGE_HEIGHT - HEADER_COMPACT_HEIGHT;

/** The scroll position for `ScreenHeader`, and the handler for an `Animated.ScrollView`. */
export function useHeaderScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  return { scrollY, onScroll };
}

export interface ScreenHeaderProps {
  readonly title: string;
  /** Above the large title, in the caption role: the date in Today. */
  readonly caption?: string;
  /** Shows the back button. */
  readonly onBack?: () => void;
  /** The scroll position that reduces the large title; without it the header stays as it is. */
  readonly scrollY?: SharedValue<number>;
  /** Always the compact bar, for the screens opened from another one. */
  readonly compact?: boolean;
  /**
   * Buttons beside the large title, like «Nuovo» and «Altro» in Obiettivi; at the right end of the
   * compact bar, like «Altro» on the card of a boss.
   */
  readonly actions?: ReactNode;
  readonly testID?: string;
}

/** Large title (96) that shrinks to a compact bar (56) while scrolling (misure-componenti.md). */
export function ScreenHeader({
  title,
  caption,
  onBack,
  scrollY,
  compact = false,
  actions,
  testID = 'screen-header',
}: ScreenHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const notScrolling = useSharedValue(0);
  const position = scrollY ?? notScrolling;

  const containerStyle = useAnimatedStyle(() => {
    const collapsed = compact
      ? 1
      : interpolate(position.get(), [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
    return { height: top + HEADER_LARGE_HEIGHT - COLLAPSE_DISTANCE * collapsed };
  });
  const largeStyle = useAnimatedStyle(() => ({
    opacity: compact
      ? 0
      : interpolate(position.get(), [0, COLLAPSE_DISTANCE / 2], [1, 0], Extrapolation.CLAMP),
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: compact
      ? 1
      : interpolate(
          position.get(),
          [COLLAPSE_DISTANCE / 2, COLLAPSE_DISTANCE],
          [0, 1],
          Extrapolation.CLAMP,
        ),
  }));

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.container,
        { paddingTop: top, backgroundColor: colors.background },
        containerStyle,
      ]}
    >
      {compact ? null : (
        <Animated.View style={[styles.large, largeStyle]}>
          <View style={styles.titles}>
            {caption === undefined ? null : (
              <ThemedText variant="caption" color={colors.textMuted}>
                {caption}
              </ThemedText>
            )}
            <ThemedText variant="screenTitle" accessibilityRole="header" numberOfLines={1}>
              {title}
            </ThemedText>
          </View>
          {actions === undefined ? null : <View style={styles.actions}>{actions}</View>}
        </Animated.View>
      )}
      {/* The bar lies over the large title: it lets the touches through to its buttons. */}
      <View style={styles.bar} pointerEvents="box-none">
        {onBack === undefined ? null : (
          <Pressable
            testID={`${testID}-back`}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('shared.back')}
            style={styles.back}
          >
            <Icon name="indietro" />
          </Pressable>
        )}
        <Animated.View
          style={[styles.compactTitle, compactStyle]}
          pointerEvents="none"
          // The large title is the one read by the screen reader, when there is one.
          accessibilityElementsHidden={!compact}
          importantForAccessibility={compact ? 'auto' : 'no-hide-descendants'}
        >
          <ThemedText
            variant="sectionTitle"
            accessibilityRole={compact ? 'header' : undefined}
            numberOfLines={1}
          >
            {title}
          </ThemedText>
        </Animated.View>
        {compact && actions !== undefined ? (
          <View style={[styles.actions, styles.trailing]}>{actions}</View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', justifyContent: 'flex-end' },
  large: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  titles: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HEADER_COMPACT_HEIGHT,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  trailing: { position: 'absolute', right: 4, top: 4, zIndex: 1 },
  compactTitle: { paddingHorizontal: 56, alignItems: 'center' },
});
