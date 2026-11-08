import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SCRIM } from '@/theme/shapes';
import { Button } from './Button';
import { Card } from './Card';
import { ThemedText } from './ThemedText';
import { useLargeText } from './useLargeText';

export interface ConfirmDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly cancelLabel?: string;
  readonly testID?: string;
}

/** Dialog only for the actions that cannot be undone (design-sezioni.md A6): elimina, cancella. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel,
  testID = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const largeText = useLargeText();
  const cancel = (
    <Button
      variant="text"
      label={cancelLabel ?? t('shared.cancel')}
      onPress={onCancel}
      testID={`${testID}-cancel`}
    />
  );
  const confirm = (
    <Button
      variant="destructive"
      label={confirmLabel}
      onPress={onConfirm}
      testID={`${testID}-confirm`}
    />
  );
  return (
    <Modal
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        {/* Only for the finger: the screen reader has the cancel button. */}
        <Pressable
          testID={`${testID}-backdrop`}
          onPress={onCancel}
          accessible={false}
          importantForAccessibility="no"
          style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          accessibilityRole="alert"
          onAccessibilityEscape={onCancel}
        >
          <Card surface="high" style={styles.card}>
            <ThemedText variant="sectionTitle" accessibilityRole="header">
              {title}
            </ThemedText>
            <ThemedText>{message}</ThemedText>
            {/* With very large text the buttons are stacked, the main action on top (A11.1). */}
            <View
              testID={`${testID}-actions`}
              style={largeText ? styles.actionsColumn : styles.actionsRow}
            >
              {largeText ? confirm : cancel}
              {largeText ? cancel : confirm}
            </View>
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { gap: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionsColumn: { gap: 8 },
});
