import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Frame } from '@/features/shared/Frame';
import { MIN_TOUCH } from '@/features/shared/touch';
import { pressedColour } from '@/theme/contrast';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';

export interface ChoiceButtonProps {
  readonly testID: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** Name, value and position for the screen reader (design-sezioni.md 4.15). */
  readonly accessibilityLabel: string;
  /** The content, drawn in `onPrimary` when chosen: it receives the colour to use. */
  readonly children: (color: string) => ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}

/** One option of a group of the editor (difficulty, stat): outlined, filled when chosen. */
export function ChoiceButton({
  testID,
  selected,
  onPress,
  accessibilityLabel,
  children,
  style,
}: ChoiceButtonProps) {
  const { colors, family } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      style={[styles.button, style]}
    >
      {({ pressed }) => {
        const main = selected ? colors.primary : colors.textMuted;
        const stroke = pressed ? pressedColour(main) : main;
        return (
          <>
            <Frame
              shape={SHAPES[family].chip}
              fill={selected ? stroke : 'transparent'}
              stroke={stroke}
            />
            {children(selected ? colors.onPrimary : colors.text)}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
});
