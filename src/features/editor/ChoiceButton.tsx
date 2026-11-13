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
  /** Shown and read, but not chosen: the main stat in the row of the secondary one (4.4). */
  readonly disabled?: boolean;
}

/** One option of a group of the editor (difficulty, stat): outlined, filled when chosen. */
export function ChoiceButton({
  testID,
  selected,
  onPress,
  accessibilityLabel,
  children,
  style,
  disabled = false,
}: ChoiceButtonProps) {
  const { colors, family } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.button, style]}
    >
      {({ pressed }) => {
        // Disabled as the buttons: `track` with `textMuted` (Button.tsx).
        const main = selected ? colors.primary : disabled ? colors.track : colors.textMuted;
        const stroke = pressed ? pressedColour(main) : main;
        return (
          <>
            <Frame
              shape={SHAPES[family].chip}
              fill={selected || disabled ? stroke : 'transparent'}
              stroke={stroke}
            />
            {children(selected ? colors.onPrimary : disabled ? colors.textMuted : colors.text)}
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
