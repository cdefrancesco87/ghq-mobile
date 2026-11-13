import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import type { Weekday } from '@/rules/gameDay';
import { useTheme } from '@/theme/ThemeProvider';
import { weekdayName, weekdaysFrom } from './format';

export interface RestDaysSheetProps {
  readonly visible: boolean;
  readonly weekStart: Weekday;
  readonly value: readonly Weekday[];
  readonly onDone: (days: readonly Weekday[]) => void;
  readonly onClose: () => void;
}

/**
 * «Giorni di riposo» (design-sezioni.md 10.5): 7 circles with the initial, none chosen by default,
 * and what a rest day means; «Fatto» saves.
 */
export function RestDaysSheet({ visible, weekStart, value, onDone, onClose }: RestDaysSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [days, setDays] = useState<readonly Weekday[]>(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setDays(value);
  }
  const toggle = (day: Weekday) =>
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );

  return (
    <Sheet
      testID="settings-rest-days-sheet"
      visible={visible}
      onClose={onClose}
      title={t('settings.restDays')}
    >
      <View style={styles.content}>
        <View style={styles.days}>
          {weekdaysFrom(weekStart).map((day) => {
            const chosen = days.includes(day);
            return (
              <Pressable
                key={day}
                testID={`settings-rest-day-${day}`}
                accessibilityRole="checkbox"
                accessibilityLabel={weekdayName(day, i18n.language)}
                accessibilityState={{ checked: chosen }}
                onPress={() => toggle(day)}
                style={[
                  styles.day,
                  {
                    borderColor: chosen ? colors.primary : colors.border,
                    backgroundColor: chosen ? colors.primary : colors.surface,
                  },
                ]}
              >
                <ThemedText variant="label" color={chosen ? colors.onPrimary : colors.text}>
                  {weekdayName(day, i18n.language, 'narrow')}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('settings.restDaysHint')}
        </ThemedText>
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('settings.fromTomorrow')}
        </ThemedText>
        <Button
          testID="settings-rest-days-done"
          label={t('settings.done')}
          onPress={() => onDone(days)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  days: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  day: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
