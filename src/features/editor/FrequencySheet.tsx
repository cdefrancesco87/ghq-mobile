import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import type { Frequency } from '@/rules/frequency';
import type { Weekday } from '@/rules/gameDay';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';

const DAY_SIZE = 40;
const ALL_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** The 7 days from the first day of the week of the settings (design-sezioni.md 4.6). */
export function weekFrom(weekStart: Weekday): Weekday[] {
  return ALL_DAYS.map((_, index) => (((weekStart - 1 + index) % 7) + 1) as Weekday);
}

export interface FrequencySheetProps {
  readonly visible: boolean;
  readonly value: Frequency;
  readonly onDone: (frequency: Frequency) => void;
  readonly onClose: () => void;
}

/**
 * «Frequenza» (design-sezioni.md 4.6, mockup D14): only «Ogni giorno» and «Giorni della
 * settimana» for now; the other forms come with their tasks (choice ★ 5). A mission that already
 * has another form keeps it as a third choice.
 */
export function FrequencySheet({ visible, value, onDone, onClose }: FrequencySheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const weekStart = useSettingsStore((state) => state.settings.week_start);
  const [draft, setDraft] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setDraft(value);
  }
  const days = draft.type === 'weekdays' ? draft.days : [];
  const other = value.type !== 'daily' && value.type !== 'weekdays' ? value : null;

  const option = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      testID={`editor-frequency-${key}`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={styles.option}
    >
      <ThemedText style={styles.flex}>{label}</ThemedText>
      {selected ? <Icon name="completa" size={20} color={colors.primary} /> : null}
    </Pressable>
  );

  const toggle = (day: Weekday) => {
    const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
    setDraft({ type: 'weekdays', days: [...next].sort((a, b) => a - b) });
  };

  return (
    <Sheet
      testID="editor-frequency"
      visible={visible}
      onClose={onClose}
      title={t('editor.frequency')}
    >
      <View style={styles.content}>
        <Card style={styles.list}>
          {option('daily', t('shared.frequency.daily'), draft.type === 'daily', () =>
            setDraft({ type: 'daily' }),
          )}
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          {option('weekdays', t('editor.weekdays'), draft.type === 'weekdays', () =>
            setDraft({ type: 'weekdays', days }),
          )}
          {draft.type === 'weekdays' ? (
            <View style={styles.days}>
              {weekFrom(weekStart).map((day) => {
                const on = days.includes(day);
                const name = t(`shared.frequency.weekdayShort.${day}`);
                return (
                  <Pressable
                    key={day}
                    testID={`editor-frequency-day-${day}`}
                    onPress={() => toggle(day)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={name}
                    accessibilityState={{ checked: on }}
                    hitSlop={4}
                    style={[
                      styles.day,
                      on
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { borderColor: colors.textMuted },
                    ]}
                  >
                    <ThemedText variant="label" color={on ? colors.onPrimary : colors.text}>
                      {name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {other === null ? null : (
            <>
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
              {option('current', describeFrequency(other, t), draft === other, () =>
                setDraft(other),
              )}
            </>
          )}
        </Card>
        <Button
          testID="editor-frequency-done"
          label={t('editor.done')}
          disabled={draft.type === 'weekdays' && days.length === 0}
          disabledReason={t('editor.chooseDay')}
          onPress={() => onDone(draft)}
        />
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
  days: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  day: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
