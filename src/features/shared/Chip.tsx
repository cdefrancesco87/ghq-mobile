import { Pressable, StyleSheet } from 'react-native';

import { pressedColour } from '@/theme/contrast';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { hitSlopFor } from './touch';

export const CHIP_HEIGHT = 32;

export interface ChipProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly selected?: boolean;
}

/** A short choice, 32 high with the touch area of the platform (misure-componenti.md). */
export function Chip({ label, onPress, testID, selected = false }: ChipProps) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={hitSlopFor(CHIP_HEIGHT)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.chip}
    >
      {({ pressed }) => {
        const main = selected ? colors.primary : colors.textMuted;
        const stroke = pressed ? pressedColour(main) : main;
        return (
          <>
            <Frame
              shape={shape.chip}
              fill={selected ? stroke : 'transparent'}
              stroke={stroke}
              testID={`${testID}-frame`}
            />
            <ThemedText variant="label" color={selected ? colors.onPrimary : colors.text}>
              {label}
            </ThemedText>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
