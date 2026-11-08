import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Sheet } from './Sheet';
import { ThemedText } from './ThemedText';

/** Height of a menu item (misure-componenti.md). */
export const ACTION_ITEM_HEIGHT = 52;

export interface ActionSheetItem {
  /** Stable name of the action: the item is `<testID>-<key>`. */
  readonly key: string;
  readonly label: string;
  readonly onPress: () => void;
  /** An action that removes something: written in the danger colour. */
  readonly destructive?: boolean;
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
}

export interface ActionSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly items: readonly ActionSheetItem[];
  readonly title?: string;
  readonly testID?: string;
}

/** The long-press menu and the quick choices, in a sheet. Choosing an item closes it. */
export function ActionSheet({
  visible,
  onClose,
  items,
  title,
  testID = 'action-sheet',
}: ActionSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID={testID}>
      {items.map((item) => {
        const disabled = item.disabled ?? false;
        const color = disabled
          ? colors.textMuted
          : item.destructive
            ? colors.dangerText
            : colors.text;
        return (
          <Pressable
            key={item.key}
            testID={`${testID}-${item.key}`}
            disabled={disabled}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            accessibilityRole="menuitem"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled }}
            style={styles.item}
          >
            {item.icon}
            <ThemedText color={color} style={styles.label}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: ACTION_ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  label: { flex: 1 },
});
