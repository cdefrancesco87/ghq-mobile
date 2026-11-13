import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { dateOf, dayOf } from '@/features/editor/DueDaySheet';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { MISSION_PAUSE } from '@/rules/config';
import type { PauseChoice } from '@/rules/pause';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';

type Option = number | 'date' | 'open';

export interface PauseSheetProps {
  readonly visible: boolean;
  /** The mission to pause, under the title (mockup D19A). */
  readonly name: string;
  /** The game day of today: the last paused day is never in the past. */
  readonly today: GameDay;
  readonly onPause: (choice: PauseChoice) => void;
  readonly onClose: () => void;
}

/**
 * «Fino a quando?» (design-sezioni.md 3.6, mockup D19A): 3 days, 1 week, 2 weeks, a date chosen in
 * the calendar (the last paused day) or no end, then «Metti in pausa».
 */
export function PauseSheet({ visible, name, today, onPause, onClose }: PauseSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [option, setOption] = useState<Option>(MISSION_PAUSE.defaultDays);
  const [lastDay, setLastDay] = useState<GameDay>(today);
  const [picking, setPicking] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setOption(MISSION_PAUSE.defaultDays);
    setLastDay(today);
    setPicking(false);
  }

  const monthDay = (day: GameDay) => {
    const [, month, dayOfMonth] = day.split('-').map(Number);
    return { day: dayOfMonth, month: t(`shared.frequency.month.${month}`) };
  };

  const onPick = (_event: unknown, date: Date) => {
    setLastDay(dayOf(date));
    if (Platform.OS === 'android') {
      setPicking(false);
    }
  };

  const confirm = () =>
    onPause(
      option === 'open' ? { open: true } : option === 'date' ? { lastDay } : { days: option },
    );

  const options: { key: Option; testID: string; label: string }[] = [
    ...MISSION_PAUSE.presetDays.map((days) => ({
      key: days,
      testID: `habits-pause-${days}`,
      label: t(`habits.pause.preset_${days}`),
    })),
    {
      key: 'date',
      testID: 'habits-pause-date',
      label:
        option === 'date'
          ? t('habits.pause.dateChosen', monthDay(lastDay))
          : t('habits.pause.date'),
    },
    { key: 'open', testID: 'habits-pause-open', label: t('habits.pause.open') },
  ];

  // iOS shows the calendar in the sheet; Android opens its dialog from the option.
  const showPicker = Platform.OS === 'ios' ? option === 'date' : picking;

  return (
    <Sheet
      testID="habits-pause"
      visible={visible}
      onClose={onClose}
      title={t('habits.pause.title')}
    >
      <View style={styles.content}>
        <ThemedText variant="caption" color={colors.textMuted}>
          {name}
        </ThemedText>
        <Card style={styles.list}>
          {options.map((item, index) => (
            <View key={item.testID}>
              {index === 0 ? null : (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
              <Pressable
                testID={item.testID}
                onPress={() => {
                  setOption(item.key);
                  if (item.key === 'date') {
                    setPicking(true);
                  }
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: option === item.key }}
                style={styles.option}
              >
                <ThemedText style={styles.flex}>{item.label}</ThemedText>
                {option === item.key ? (
                  <Icon name="completa" size={20} color={colors.primary} />
                ) : null}
              </Pressable>
            </View>
          ))}
        </Card>
        {showPicker ? (
          <View style={styles.picker}>
            <DateTimePicker
              testID="habits-pause-picker"
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              value={dateOf(lastDay)}
              minimumDate={dateOf(today)}
              onValueChange={onPick}
              onDismiss={() => setPicking(false)}
            />
          </View>
        ) : null}
        <Button testID="habits-pause-confirm" label={t('habits.pause.confirm')} onPress={confirm} />
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
