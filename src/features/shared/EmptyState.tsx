import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { ThemedText } from './ThemedText';

export interface EmptyStateProps {
  /** The companion of the theme. */
  readonly companion?: ReactNode;
  /** One sentence, in the lexicon of the theme. */
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly testID: string;
}

/** The empty state: the companion, a sentence and one action (design-sezioni.md A6). */
export function EmptyState({ companion, message, actionLabel, onAction, testID }: EmptyStateProps) {
  return (
    <Card testID={testID}>
      <View style={styles.content}>
        {companion}
        <ThemedText style={styles.message}>{message}</ThemedText>
        <Button label={actionLabel} onPress={onAction} testID={`${testID}-action`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 16, paddingVertical: 16 },
  message: { textAlign: 'center' },
});
