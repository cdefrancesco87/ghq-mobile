import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { Frame } from './Frame';
import { Icon } from './Icon';
import { MIN_TOUCH } from './touch';

const FIELD_HEIGHT = 48;

export interface SearchFieldProps {
  /** The field is `testID`, its clear button `testID-clear`. */
  readonly testID: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  /** Placeholder and label of the screen reader. */
  readonly placeholder: string;
  /** Label of the button that clears the text. */
  readonly clearLabel: string;
  readonly autoFocus?: boolean;
}

/** A search field with the magnifier and a clear button (Usa un modello, Abitudini). */
export function SearchField({
  testID,
  value,
  onChangeText,
  placeholder,
  clearLabel,
  autoFocus = false,
}: SearchFieldProps) {
  const { colors, family, typography } = useTheme();
  return (
    <View style={styles.search}>
      <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="cerca" size={20} color={colors.textMuted} />
      </View>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        maxFontSizeMultiplier={MAX_TEXT_SCALE}
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
      />
      {value === '' ? null : (
        <Pressable
          testID={`${testID}-clear`}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          onPress={() => onChangeText('')}
          style={styles.clear}
        >
          <Icon name="chiudi" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    minHeight: FIELD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  input: { flex: 1, minHeight: FIELD_HEIGHT },
  clear: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
