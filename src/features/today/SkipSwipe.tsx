import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';

const ACTION_WIDTH = 96;
/** How far the row must slide before letting go opens the sheet. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

export interface SkipSwipeProps {
  /** The swipe action is `testID-skip`. */
  readonly testID: string;
  /** Opens the sheet «Salta oggi». */
  readonly onSkip: () => void;
  readonly children: ReactNode;
}

/**
 * A row of Today that slides to the left to show «Salta oggi» (design-sezioni.md 2.5, choice ★
 * 2.12.4). Letting it go past the threshold, or touching the action, opens the sheet with the
 * reasons and puts the row back. The screen reader has the same action on the row.
 */
export function SkipSwipe({ testID, onSkip, children }: SkipSwipeProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const label = t('lexicon.skipToday', { context: family });

  const skip = () => {
    swipe.current?.close();
    onSkip();
  };

  return (
    <ReanimatedSwipeable
      ref={swipe}
      testID={testID}
      friction={2}
      rightThreshold={OPEN_THRESHOLD}
      overshootRight={false}
      onSwipeableOpen={skip}
      renderRightActions={() => (
        <Pressable
          testID={`${testID}-skip`}
          onPress={skip}
          // The row already offers it to the screen reader among its actions.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.action, { backgroundColor: colors.surfaceHigh }]}
        >
          <Icon name="salta" size={20} color={colors.skipped} />
          <ThemedText variant="caption" color={colors.text} numberOfLines={2} style={styles.label}>
            {label}
          </ThemedText>
        </Pressable>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  label: { textAlign: 'center' },
});
