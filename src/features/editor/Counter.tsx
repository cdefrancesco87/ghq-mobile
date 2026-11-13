import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';

export interface CounterProps {
  /** `<testID>-less`, `<testID>-more` and `<testID>-value`. */
  readonly testID: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  /** What is counted, for the screen reader: «Volte a settimana». */
  readonly accessibilityLabel: string;
  /** The value in words, shown beside the number: «volte a settimana». */
  readonly unit: string;
}

/**
 * A number from `min` to `max` with [−] and [+] (design-sezioni.md 4.6): the screen reader reads
 * it as one adjustable element and changes it by swiping up or down.
 */
export function Counter({
  testID,
  value,
  min,
  max,
  onChange,
  accessibilityLabel,
  unit,
}: CounterProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  const button = (key: 'less' | 'more', glyph: string, disabled: boolean, next: number) => (
    <Pressable
      testID={`${testID}-${key}`}
      onPress={() => set(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t(`editor.counter.${key}`)}
      accessibilityState={{ disabled }}
      style={[styles.button, { borderColor: disabled ? colors.border : colors.textMuted }]}
    >
      <ThemedText variant="sectionTitle" color={disabled ? colors.textMuted : colors.text}>
        {glyph}
      </ThemedText>
    </Pressable>
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: `${value} ${unit}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) =>
        set(nativeEvent.actionName === 'increment' ? value + 1 : value - 1)
      }
      style={styles.row}
    >
      {button('less', '−', value <= min, value - 1)}
      <View style={styles.value}>
        <ThemedText testID={`${testID}-value`} variant="numbers">
          {value}
        </ThemedText>
        <ThemedText variant="caption" color={colors.textMuted}>
          {unit}
        </ThemedText>
      </View>
      {button('more', '+', value >= max, value + 1)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { flex: 1, alignItems: 'center' },
});
