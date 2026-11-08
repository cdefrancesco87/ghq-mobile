import { Pressable, StyleSheet, View } from 'react-native';

import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip } from './Chip';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { hitSlopFor } from './touch';
import { useLargeText } from './useLargeText';

export const SEGMENT_HEIGHT = 40;

export interface SegmentedControlProps<Value extends string> {
  readonly options: readonly { readonly value: Value; readonly label: string }[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  /** Stable prefix: each option is `<testID>-<value>`. */
  readonly testID: string;
  /** The name of the choice for the screen reader. */
  readonly accessibilityLabel: string;
}

/** One choice among few options, 40 high; with very large text, a row of chips (A11.1). */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  testID,
  accessibilityLabel,
}: SegmentedControlProps<Value>) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  const largeText = useLargeText();
  if (largeText) {
    return (
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        style={styles.chips}
      >
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
            testID={`${testID}-${option.value}`}
          />
        ))}
      </View>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
    >
      <Frame shape={shape.control} fill="transparent" stroke={colors.textMuted} />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testID}-${option.value}`}
            onPress={() => onChange(option.value)}
            hitSlop={hitSlopFor(SEGMENT_HEIGHT)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            style={styles.segment}
          >
            {selected ? (
              <Frame shape={shape.control} fill={colors.primary} stroke={colors.primary} />
            ) : null}
            <ThemedText variant="label" color={selected ? colors.onPrimary : colors.text}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: SEGMENT_HEIGHT },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    flex: 1,
    minHeight: SEGMENT_HEIGHT,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
