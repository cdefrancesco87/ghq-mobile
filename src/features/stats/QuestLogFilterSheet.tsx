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
import { termInSentence } from '@/i18n/lexicon';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay } from './format';

/** The choices of «Filtra»: a mission and an interval of days, each optional. */
export interface QuestLogRange {
  readonly missionId: string | null;
  readonly from: GameDay | null;
  readonly to: GameDay | null;
}

export const NO_RANGE: QuestLogRange = { missionId: null, from: null, to: null };

export interface QuestLogFilterSheetProps {
  readonly visible: boolean;
  readonly value: QuestLogRange;
  readonly missions: readonly { readonly id: string; readonly name: string }[];
  readonly today: GameDay;
  readonly onApply: (value: QuestLogRange) => void;
  readonly onClose: () => void;
}

type Picking = 'from' | 'to' | null;

/**
 * «Filtra» of the Registro (design-sezioni.md 8.6): a mission, or every one, and the first and last
 * day, then «Applica»; «Azzera» takes every choice away.
 */
export function QuestLogFilterSheet({
  visible,
  value,
  missions,
  today,
  onApply,
  onClose,
}: QuestLogFilterSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const [draft, setDraft] = useState<QuestLogRange>(value);
  const [picking, setPicking] = useState<Picking>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setDraft(value);
    setPicking(null);
  }

  const term = termInSentence(t('lexicon.missions', { context: family }), i18n.language);
  const dayText = (day: GameDay | null) =>
    day === null
      ? t('questLog.anyDay')
      : formatDay(day, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });

  const onPick = (_event: unknown, date: Date) => {
    const day = dayOf(date);
    setDraft((current) => {
      if (picking === 'from') {
        return {
          ...current,
          from: day,
          to: current.to !== null && current.to < day ? day : current.to,
        };
      }
      return {
        ...current,
        to: day,
        from: current.from !== null && current.from > day ? day : current.from,
      };
    });
    if (Platform.OS === 'android') {
      setPicking(null);
    }
  };

  const options = [
    { id: null, testID: 'stats-log-mission-any', label: t('questLog.anyMission', { term }) },
    ...missions.map((mission) => ({
      id: mission.id,
      testID: `stats-log-mission-${mission.id}`,
      label: mission.name,
    })),
  ];

  const pickedDay = picking === 'from' ? draft.from : picking === 'to' ? draft.to : null;

  return (
    <Sheet
      testID="stats-log-filter"
      visible={visible}
      onClose={onClose}
      size="full"
      title={t('questLog.filterTitle')}
    >
      <View style={styles.content}>
        <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
          {t('questLog.dates')}
        </ThemedText>
        <Card style={styles.list}>
          {(['from', 'to'] as const).map((edge, index) => (
            <View key={edge}>
              {index === 0 ? null : (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
              <Pressable
                testID={`stats-log-${edge}`}
                onPress={() => setPicking(picking === edge ? null : edge)}
                accessibilityRole="button"
                accessibilityLabel={`${t(`questLog.${edge}`)}: ${dayText(draft[edge])}`}
                style={styles.option}
              >
                <ThemedText style={styles.flex}>{t(`questLog.${edge}`)}</ThemedText>
                <ThemedText testID={`stats-log-${edge}-value`} color={colors.textMuted}>
                  {dayText(draft[edge])}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </Card>
        {picking === null ? null : (
          <View style={styles.picker}>
            <DateTimePicker
              testID="stats-log-picker"
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              value={dateOf(pickedDay ?? today)}
              maximumDate={dateOf(today)}
              onValueChange={onPick}
              onDismiss={() => setPicking(null)}
            />
          </View>
        )}
        <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
          {t('lexicon.missions', { context: family })}
        </ThemedText>
        <Card style={styles.list}>
          {options.map((item, index) => {
            const checked = draft.missionId === item.id;
            return (
              <View key={item.testID}>
                {index === 0 ? null : (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                )}
                <Pressable
                  testID={item.testID}
                  onPress={() => setDraft((current) => ({ ...current, missionId: item.id }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  style={styles.option}
                >
                  <ThemedText style={styles.flex}>{item.label}</ThemedText>
                  {checked ? <Icon name="completa" size={20} color={colors.primary} /> : null}
                </Pressable>
              </View>
            );
          })}
        </Card>
        <Button
          testID="stats-log-apply"
          label={t('questLog.apply')}
          onPress={() => onApply(draft)}
        />
        <Button
          testID="stats-log-reset"
          variant="text"
          label={t('questLog.reset')}
          onPress={() => onApply(NO_RANGE)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  option: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  picker: { alignItems: 'center' },
});
