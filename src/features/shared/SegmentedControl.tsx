import { Pressable, StyleSheet, View } from 'react-native';

import { SHAPES, type FrameShape } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip } from './Chip';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { hitSlopFor } from './touch';
import { useLargeText } from './useLargeText';

export const SEGMENT_HEIGHT = 40;

/** Distance of the segments from the edge of the control (mockup, componenti/lotto2-*). */
const SEGMENT_INSET = 4;
const THUMB_HEIGHT = SEGMENT_HEIGHT - 2 * SEGMENT_INSET;

/** The selected segment is a plain fill: only rounded controls give it round corners. */
export function segmentThumbRadius(control: FrameShape): number {
  return control.kind === 'rounded' ? Math.max(0, control.radius - SEGMENT_INSET) : 0;
}

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
            hitSlop={hitSlopFor(THUMB_HEIGHT)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            style={styles.segment}
          >
            {selected ? (
              <View
                testID={`${testID}-${option.value}-thumb`}
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: segmentThumbRadius(shape.control),
                  },
                ]}
              />
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
  row: { flexDirection: 'row', minHeight: SEGMENT_HEIGHT, padding: SEGMENT_INSET },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    flex: 1,
    minHeight: THUMB_HEIGHT,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
