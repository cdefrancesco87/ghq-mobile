import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Icon } from '@/features/shared/Icon';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';

/** How many places a drag of `dy` points moves a row `rowHeight` high (design-sezioni.md 3.4). */
export function dragSteps(dy: number, rowHeight: number): number {
  return rowHeight <= 0 ? 0 : Math.round(dy / rowHeight);
}

export interface ReorderRowProps {
  /** The row is `testID`, its handle `testID-handle` (also the test id of its drag gesture). */
  readonly testID: string;
  /** Moves the row by that many places; called when the finger lets go. */
  readonly onDrop: (steps: number) => void;
  /** The scroll of the list stops while a row is dragged. */
  readonly onDragging: (dragging: boolean) => void;
  readonly children: ReactNode;
}

/**
 * A row in reorder mode (design-sezioni.md 3.4, choice ★): the handle on the right drags it, and
 * the row follows the finger; letting go moves it by the places crossed, also into another
 * category. The screen reader uses «Sposta su» and «Sposta giù» on the row instead (3.11).
 */
export function ReorderRow({ testID, onDrop, onDragging, children }: ReorderRowProps) {
  const { colors } = useTheme();
  const [dragging, setDragging] = useState(false);
  const height = useSharedValue(0);
  const translateY = useSharedValue(0);

  const setActive = (active: boolean) => {
    setDragging(active);
    onDragging(active);
  };

  // On the JavaScript thread: the drop calls an action, and a row follows one finger at a time.
  const drag = Gesture.Pan()
    .runOnJS(true)
    .withTestId(`${testID}-handle`)
    .onBegin(() => setActive(true))
    .onUpdate((event) => translateY.set(event.translationY))
    .onEnd((event) => onDrop(dragSteps(event.translationY, height.get())))
    .onFinalize(() => {
      translateY.set(0);
      setActive(false);
    });

  const followStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return (
    <Animated.View
      testID={testID}
      onLayout={(event: LayoutChangeEvent) => height.set(event.nativeEvent.layout.height)}
      style={[
        styles.row,
        followStyle,
        dragging ? [styles.lifted, { backgroundColor: colors.surfaceHigh }] : null,
      ]}
    >
      <View style={styles.flex}>{children}</View>
      <GestureDetector gesture={drag}>
        <View
          testID={`${testID}-handle`}
          // The row has «Sposta su» and «Sposta giù» for the screen reader.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.handle}
        >
          <Icon name="trascina" size={20} color={colors.textMuted} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  lifted: { zIndex: 1, elevation: 4 },
  flex: { flex: 1 },
  handle: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
