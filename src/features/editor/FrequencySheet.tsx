import DateTimePicker from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { FREQUENCY_EDITOR } from '@/rules/config';
import type { Frequency } from '@/rules/frequency';
import type { Weekday } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { Counter } from './Counter';
import { dateOf, dayOf } from './DueDaySheet';

const DAY_SIZE = 40;
const ALL_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** The 7 days from the first day of the week of the settings (design-sezioni.md 4.6). */
export function weekFrom(weekStart: Weekday): Weekday[] {
  return ALL_DAYS.map((_, index) => (((weekStart - 1 + index) % 7) + 1) as Weekday);
}

export interface FrequencySheetProps {
  readonly visible: boolean;
  readonly value: Frequency;
  /** The game day of today: the first day of «Ogni N giorni» when it is chosen. */
  readonly today: GameDay;
  readonly onDone: (frequency: Frequency) => void;
  readonly onClose: () => void;
}

/** The forms with their own control in the sheet. */
const EDITABLE: readonly Frequency['type'][] = [
  'daily',
  'weekdays',
  'times_per_week',
  'every_n_days',
];

/**
 * «Frequenza» (design-sezioni.md 4.6, mockups D14): «Ogni giorno», «Giorni della settimana»,
 * «N volte a settimana» (1–6) and «Ogni N giorni» (2–30, with the first day); monthly and yearly
 * come with their task (choice ★ 5). A mission that already has one of those keeps it as a choice.
 * Each form remembers its values while the sheet is open, so trying another one loses nothing.
 */
export function FrequencySheet({ visible, value, today, onDone, onClose }: FrequencySheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const weekStart = useSettingsStore((state) => state.settings.week_start);
  const [draft, setDraft] = useState(value);
  const [days, setDays] = useState<Weekday[]>(() => initialDays(value));
  const [times, setTimes] = useState(() => initialTimes(value));
  const [everyN, setEveryN] = useState(() => initialEveryN(value, today));
  const [picking, setPicking] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setDraft(value);
    setDays(initialDays(value));
    setTimes(initialTimes(value));
    setEveryN(initialEveryN(value, today));
    setPicking(false);
  }
  const other = EDITABLE.includes(value.type) ? null : value;

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
    const sorted = [...next].sort((a, b) => a - b);
    setDays(sorted);
    setDraft({ type: 'weekdays', days: sorted });
  };

  const chooseTimes = (count: number) => {
    setTimes(count);
    setDraft({ type: 'times_per_week', times: count });
  };

  const chooseEveryN = (changes: Partial<{ n: number; from: GameDay }>) => {
    const next = { ...everyN, ...changes };
    setEveryN(next);
    setDraft({ type: 'every_n_days', ...next });
  };

  const onPick = (_event: unknown, date: Date) => {
    chooseEveryN({ from: dayOf(date) });
    if (Platform.OS === 'android') {
      setPicking(false);
    }
  };

  const separator = <View style={[styles.separator, { backgroundColor: colors.border }]} />;
  const [, fromMonth, fromDay] = everyN.from.split('-').map(Number);
  const fromText = t('editor.startsOn', {
    day: fromDay,
    month: t(`shared.frequency.month.${fromMonth}`),
  });
  const control = (children: ReactNode) => <View style={styles.control}>{children}</View>;

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
          {separator}
          {option('times', t('editor.timesPerWeek'), draft.type === 'times_per_week', () =>
            chooseTimes(times),
          )}
          {draft.type === 'times_per_week'
            ? control(
                <Counter
                  testID="editor-frequency-times"
                  value={times}
                  min={FREQUENCY_EDITOR.timesPerWeek.min}
                  max={FREQUENCY_EDITOR.timesPerWeek.max}
                  onChange={chooseTimes}
                  accessibilityLabel={t('editor.timesPerWeek')}
                  unit={t('editor.timesPerWeekUnit', { count: times })}
                />,
              )
            : null}
          {separator}
          {option('every', t('editor.everyNDays'), draft.type === 'every_n_days', () =>
            chooseEveryN({}),
          )}
          {draft.type === 'every_n_days'
            ? control(
                <>
                  <Counter
                    testID="editor-frequency-every"
                    value={everyN.n}
                    min={FREQUENCY_EDITOR.everyNDays.min}
                    max={FREQUENCY_EDITOR.everyNDays.max}
                    onChange={(n) => chooseEveryN({ n })}
                    accessibilityLabel={t('editor.everyNDays')}
                    unit={t('editor.daysUnit', { count: everyN.n })}
                  />
                  <Pressable
                    testID="editor-frequency-from"
                    onPress={() => setPicking((open) => (Platform.OS === 'ios' ? !open : true))}
                    accessibilityRole="button"
                    accessibilityLabel={`${fromText}, ${t('editor.changeStart')}`}
                    style={styles.option}
                  >
                    <Icon name="calendario" size={20} color={colors.textMuted} />
                    <ThemedText style={styles.flex}>{fromText}</ThemedText>
                    <ThemedText variant="label" color={colors.primary}>
                      {t('editor.changeStart')}
                    </ThemedText>
                  </Pressable>
                  {picking ? (
                    <View style={styles.picker}>
                      <DateTimePicker
                        testID="editor-frequency-picker"
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        value={dateOf(everyN.from)}
                        locale={i18n.language}
                        onValueChange={onPick}
                        onDismiss={() => setPicking(false)}
                      />
                    </View>
                  ) : null}
                </>,
              )
            : null}
          {other === null ? null : (
            <>
              {separator}
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

function initialDays(value: Frequency): Weekday[] {
  return value.type === 'weekdays' ? [...value.days] : [];
}

function initialTimes(value: Frequency): number {
  return value.type === 'times_per_week' ? value.times : FREQUENCY_EDITOR.timesPerWeek.initial;
}

function initialEveryN(value: Frequency, today: GameDay): { n: number; from: GameDay } {
  return value.type === 'every_n_days'
    ? { n: value.n, from: value.from }
    : { n: FREQUENCY_EDITOR.everyNDays.initial, from: today };
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  option: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  control: { paddingBottom: 8 },
  picker: { alignItems: 'center' },
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
