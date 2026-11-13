import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MISSION_FIELDS } from '@/rules/config';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';

const NOTES_MIN_HEIGHT = 120;
/** The counter appears when this share of the limit is used. */
const COUNTER_FROM = 0.8;

export interface NotesSheetProps {
  readonly visible: boolean;
  readonly value: string;
  readonly onDone: (notes: string) => void;
  readonly onClose: () => void;
}

/** «Note» (design-sezioni.md 4.9): a free field on several lines, shown then in the detail. */
export function NotesSheet({ visible, value, onDone, onClose }: NotesSheetProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const [notes, setNotes] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setNotes(value);
  }
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const max = MISSION_FIELDS.notesMax;

  return (
    <Sheet testID="editor-notes" visible={visible} onClose={onClose} title={t('editor.notes')}>
      <View style={styles.content}>
        <TextInput
          testID="editor-notes-text"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={max}
          textAlignVertical="top"
          placeholder={t('editor.notesPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('editor.notes')}
          style={[
            textStyleOf(typography.body),
            styles.input,
            { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
          ]}
        />
        {notes.length >= max * COUNTER_FROM ? (
          <ThemedText testID="editor-notes-count" variant="caption" color={colors.textMuted}>
            {t('editor.notesCount', { count: notes.length, max })}
          </ThemedText>
        ) : null}
        <Button testID="editor-notes-done" label={t('editor.done')} onPress={() => onDone(notes)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  input: {
    minHeight: NOTES_MIN_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
