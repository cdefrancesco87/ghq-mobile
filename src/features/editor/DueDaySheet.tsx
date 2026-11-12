import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';

const pad = (value: number) => String(value).padStart(2, '0');

/** The day chosen in the picker, in the calendar of the phone. */
export function dayOf(date: Date): GameDay {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as GameDay;
}

function dateOf(day: GameDay): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export interface DueDaySheetProps {
  readonly visible: boolean;
  readonly value: GameDay | null;
  /** The game day of today: a due day is never in the past. */
  readonly today: GameDay;
  readonly onDone: (day: GameDay | null) => void;
  readonly onClose: () => void;
}

/**
 * «Scadenza» of a single task (design-sezioni.md 4.6): a day, or none. The time of the due day is
 * missing from the data model (modello-dati.md 3.3), so only the day is chosen.
 */
export function DueDaySheet({ visible, value, today, onDone, onClose }: DueDaySheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  const [picking, setPicking] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setDraft(value);
    setPicking(false);
  }

  const onPick = (_event: unknown, date: Date) => {
    setDraft(dayOf(date));
    if (Platform.OS === 'android') {
      setPicking(false);
    }
  };

  // iOS shows the calendar in the sheet; Android opens its dialog from the button.
  const showPicker = Platform.OS === 'ios' ? draft !== null : picking;

  return (
    <Sheet testID="editor-due" visible={visible} onClose={onClose} title={t('editor.dueDay')}>
      <View style={styles.content}>
        <Card style={styles.list}>
          <Pressable
            testID="editor-due-none"
            onPress={() => setDraft(null)}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft === null }}
            style={styles.option}
          >
            <ThemedText style={styles.flex}>{t('shared.frequency.noDueDay')}</ThemedText>
            {draft === null ? <Icon name="completa" size={20} color={colors.primary} /> : null}
          </Pressable>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <Pressable
            testID="editor-due-day"
            onPress={() => {
              setDraft((current) => current ?? today);
              setPicking(true);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft !== null }}
            style={styles.option}
          >
            <ThemedText style={styles.flex}>{t('editor.dueOnDay')}</ThemedText>
            {draft !== null ? <Icon name="completa" size={20} color={colors.primary} /> : null}
          </Pressable>
        </Card>
        {showPicker ? (
          <View style={styles.picker}>
            <DateTimePicker
              testID="editor-due-picker"
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              value={dateOf(draft ?? today)}
              minimumDate={dateOf(today)}
              onValueChange={onPick}
              onDismiss={() => setPicking(false)}
            />
          </View>
        ) : null}
        <Button testID="editor-due-done" label={t('editor.done')} onPress={() => onDone(draft)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  option: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  picker: { alignItems: 'center' },
});
