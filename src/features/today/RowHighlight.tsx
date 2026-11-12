import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { useHighlightStore } from '@/stores/highlight';
import { useTheme } from '@/theme/ThemeProvider';

/** How long the row of a mission just created stays highlighted (design-sezioni.md 4.12). */
export const HIGHLIGHT_MS = 1500;
const HIGHLIGHT_OPACITY = 0.16;

export interface RowHighlightProps {
  readonly missionId: string;
  readonly testID: string;
  readonly children: ReactNode;
}

/** The brief highlight of the row of the mission the editor has just saved. */
export function RowHighlight({ missionId, testID, children }: RowHighlightProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const active = useHighlightStore((state) => state.missionId === missionId);
  const clear = useHighlightStore((state) => state.clear);
  const opacity = useSharedValue(HIGHLIGHT_OPACITY);
  const fading = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    opacity.set(HIGHLIGHT_OPACITY);
    // Without movement the highlight stays still and then goes away at once.
    if (!reduceMotion) {
      opacity.set(withTiming(0, { duration: HIGHLIGHT_MS }));
    }
    const timer = setTimeout(clear, HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [active, reduceMotion, opacity, clear]);

  return (
    <View>
      {active ? (
        <Animated.View
          testID={testID}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }, fading]}
        />
      ) : null}
      {children}
    </View>
  );
}
