import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';

const ROW_HEIGHT = 52;

export interface OptionRowProps {
  readonly testID: string;
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
  readonly onPress: () => void;
}

/** A row of «Altre opzioni»: icon, field, current value; it opens the small sheet of the field (4.5). */
export function OptionRow({ testID, icon, label, value, onPress }: OptionRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      style={styles.row}
    >
      <Icon name={icon} size={20} color={colors.textMuted} />
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.value}>
        <ThemedText
          testID={`${testID}-value`}
          variant="caption"
          color={colors.textMuted}
          numberOfLines={1}
        >
          {value}
        </ThemedText>
      </View>
      <Icon name="avanti" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: Math.max(ROW_HEIGHT, MIN_TOUCH),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, alignItems: 'flex-end' },
});
