import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';
import { SETTINGS_ROW_HEIGHT } from './SettingsRow';

export interface Choice<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

export interface ChoiceSheetProps<T extends string | number> {
  readonly testID: string;
  readonly visible: boolean;
  readonly title: string;
  readonly choices: readonly Choice<T>[];
  readonly selected: T;
  /** Under the list: what the choice changes, or when it counts. */
  readonly notes?: readonly string[];
  readonly onChoose: (value: T) => void;
  readonly onClose: () => void;
}

/** A sheet with one choice among a few, marked with a tick; a tap chooses and closes. */
export function ChoiceSheet<T extends string | number>({
  testID,
  visible,
  title,
  choices,
  selected,
  notes = [],
  onChoose,
  onClose,
}: ChoiceSheetProps<T>) {
  const { colors } = useTheme();
  return (
    <Sheet testID={testID} visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
        <View accessibilityRole="radiogroup">
          {choices.map((choice, index) => (
            <Pressable
              key={choice.value}
              testID={`${testID}-${choice.value}`}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{ checked: choice.value === selected }}
              onPress={() => onChoose(choice.value)}
              style={[
                styles.row,
                index === 0 ? null : { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <ThemedText>{choice.label}</ThemedText>
              {choice.value === selected ? <Icon name="completa" color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
        {notes.map((note) => (
          <ThemedText key={note} variant="caption" color={colors.textMuted}>
            {note}
          </ThemedText>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  row: {
    minHeight: SETTINGS_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
