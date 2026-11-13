import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';

const ACTION_WIDTH = 80;
/** How far the row must slide before letting go keeps the actions open. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;
/**
 * A swipe to the left past this share of the row (and past the actions) archives at once
 * (design-sezioni.md 3.5). PROVISIONAL (T77): no value in the design.
 */
export const LONG_SWIPE_SHARE = 0.6;

/** Whether a swipe that reached `reach` (negative, to the left) is a long one. */
export function isLongSwipe(reach: number, rowWidth: number, actionsWidth: number): boolean {
  return -reach >= Math.max(rowWidth * LONG_SWIPE_SHARE, actionsWidth + ACTION_WIDTH);
}

export interface SwipeAction {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  /** Background of the action (lacune-design-schermate.md L27). */
  readonly color: string;
  readonly onPress: () => void;
}

export interface HabitSwipeProps {
  /** The swipeable is `testID`, its actions `testID-<key>`. */
  readonly testID: string;
  /** Shown by a swipe to the left: Pausa (or Riprendi) and Archivia. */
  readonly leftActions: readonly SwipeAction[];
  /** A long swipe to the left: archive at once. */
  readonly onLongSwipe?: () => void;
  /** A swipe to the right opens Modifica. */
  readonly onEdit: () => void;
  readonly children: ReactNode;
}

/** Keeps the farthest point of a swipe to the left, on the UI thread. */
function ReachTracker({
  translation,
  reach,
}: {
  readonly translation: SharedValue<number>;
  readonly reach: SharedValue<number>;
}) {
  useAnimatedReaction(
    () => translation.get(),
    (value) => {
      if (value < reach.get()) {
        reach.set(value);
      }
    },
  );
  return null;
}

/**
 * A row of Habits that slides (design-sezioni.md 3.5, choice ★): to the left it shows Pausa and
 * Archivia, and a long swipe archives at once (the screen shows «Archiviata · Annulla»); to the
 * right it opens Modifica. The screen reader has the same actions on the row.
 */
export function HabitSwipe({
  testID,
  leftActions,
  onLongSwipe,
  onEdit,
  children,
}: HabitSwipeProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const translationRef = useRef<SharedValue<number> | null>(null);
  const width = useRef(0);
  const reach = useSharedValue(0);
  const actionsWidth = leftActions.length * ACTION_WIDTH;

  const action = (
    key: string,
    label: string,
    icon: IconName,
    color: string,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      testID={`${testID}-${key}`}
      onPress={() => {
        swipe.current?.close();
        onPress();
      }}
      // The row already offers it to the screen reader among its actions.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.action, { backgroundColor: color }]}
    >
      <Icon name={icon} size={20} color={colors.onPrimary} />
      <ThemedText variant="caption" color={colors.onPrimary} numberOfLines={2} style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const willOpen = (direction: SwipeDirection) => {
    if (direction === SwipeDirection.RIGHT) {
      swipe.current?.close();
      onEdit();
      return;
    }
    const farthest = Math.min(reach.get(), translationRef.current?.get() ?? 0);
    if (onLongSwipe !== undefined && isLongSwipe(farthest, width.current, actionsWidth)) {
      swipe.current?.close();
      onLongSwipe();
    }
  };

  return (
    <View onLayout={(event: LayoutChangeEvent) => (width.current = event.nativeEvent.layout.width)}>
      <ReanimatedSwipeable
        ref={swipe}
        testID={testID}
        friction={1}
        leftThreshold={ACTION_WIDTH}
        rightThreshold={OPEN_THRESHOLD}
        overshootLeft={false}
        onSwipeableOpenStartDrag={() => reach.set(0)}
        onSwipeableWillOpen={willOpen}
        renderLeftActions={() =>
          action('edit', t('habits.swipe.edit'), 'modifica', colors.primary, onEdit)
        }
        renderRightActions={(_progress, translation) => {
          translationRef.current = translation;
          return (
            <View style={styles.actions}>
              <ReachTracker translation={translation} reach={reach} />
              {leftActions.map(({ key, label, icon, color, onPress }) =>
                action(key, label, icon, color, onPress),
              )}
            </View>
          );
        }}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  label: { textAlign: 'center' },
});
