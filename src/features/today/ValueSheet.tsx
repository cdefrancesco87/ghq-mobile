import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import type { TodayMission } from '@/db/repositories/todayView';
import { formatAmount, formatNumber, unitName } from '@/features/shared/amount';
import { Button } from '@/features/shared/Button';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { parseAmount } from '@/rules/measurable';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';

export interface ValueSheetProps {
  /** The measurable mission; null keeps the sheet closed. */
  readonly item: TodayMission | null;
  readonly onClose: () => void;
  readonly onAdd: (item: TodayMission, amount: number) => void;
}

/**
 * «Inserisci valore» (design-sezioni.md 2.5; US-OGGI-03): the amount typed is added to the value
 * of the day, as many taps would do. PROVISIONAL (dev run, T60): it adds, it does not replace.
 */
export function ValueSheet({ item, onClose, onAdd }: ValueSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const [text, setText] = useState('');
  // The last mission shown, so the sheet keeps its texts while it slides away.
  const [shown, setShown] = useState(item);
  // Every opening starts empty, even for the mission shown last time.
  const [wasOpen, setWasOpen] = useState(false);
  // Set by «Aggiungi»: a second tap while the sheet slides away must not add the amount again.
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const open = item !== null;
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText('');
      setSubmitted(false);
    }
  }
  if (item !== null && item !== shown) {
    setShown(item);
  }
  useEffect(() => {
    if (open) {
      submittedRef.current = false;
    }
  }, [open]);
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const amount = parseAmount(text);
  const mission = shown?.mission;
  const unit = mission?.goalUnit ?? '';

  return (
    <Sheet
      testID="today-value-sheet"
      visible={item !== null}
      onClose={onClose}
      title={mission === undefined ? undefined : t('today.value.title')}
    >
      <View style={styles.content}>
        {mission === undefined || mission.goalTarget === null ? null : (
          <ThemedText testID="today-value-today" variant="caption" color={colors.textMuted}>
            {t('today.value.today', {
              value: formatNumber(shown?.value ?? 0, i18n.language),
              target: formatAmount(mission.goalTarget, unit, i18n.language),
            })}
          </ThemedText>
        )}
        <TextInput
          testID="today-value-input"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          autoFocus
          accessibilityLabel={t('today.value.amount', { unit: unitName(unit, i18n.language) })}
          placeholder={t('today.value.amount', { unit: unitName(unit, i18n.language) })}
          placeholderTextColor={colors.textMuted}
          style={[
            textStyleOf(typography.body),
            styles.input,
            { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
          ]}
        />
        <Button
          testID="today-value-add"
          label={t('today.value.add')}
          disabled={amount === null || submitted}
          disabledReason={submitted ? undefined : t('today.value.invalid')}
          onPress={() => {
            if (shown === null || amount === null || submittedRef.current) {
              return;
            }
            submittedRef.current = true;
            setSubmitted(true);
            onAdd(shown, amount);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
});
