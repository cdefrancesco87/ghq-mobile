import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Card } from './Card';
import { ThemedText } from './ThemedText';

export interface EmptyStateProps {
  /** The companion of the theme. */
  readonly companion?: ReactNode;
  /** A short title above the sentence (e.g. «Giorno di riposo», design-sezioni.md 2.8). */
  readonly title?: string;
  /** One sentence, in the lexicon of the theme. */
  readonly message: string;
  /** The action, when there is one: a rest day has none. */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly testID: string;
}

/** The empty state: the companion, a sentence and at most one action (design-sezioni.md A6). */
export function EmptyState({
  companion,
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <Card testID={testID}>
      <View style={styles.content}>
        {companion}
        {title === undefined ? null : (
          <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.centred}>
            {title}
          </ThemedText>
        )}
        <ThemedText
          color={title === undefined ? undefined : colors.textMuted}
          style={styles.centred}
        >
          {message}
        </ThemedText>
        {actionLabel === undefined || onAction === undefined ? null : (
          <Button label={actionLabel} onPress={onAction} testID={`${testID}-action`} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 16, paddingVertical: 16 },
  centred: { textAlign: 'center' },
});
