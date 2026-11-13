import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { cancelPause, changePauseEnd, startPause } from '@/db/repositories/pause';
import type { TodayPause } from '@/db/repositories/todayView';
import { dateOf, dayOf } from '@/features/editor/DueDaySheet';
import { announceOnIos } from '@/features/shared/announce';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import type { PauseInterval } from '@/rules/pause';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';
import { dayAndMonth } from './format';
import { ResumePauseDialog } from './ResumePauseDialog';
import { SettingsRow } from './SettingsRow';

type Field = 'from' | 'until';

export interface GeneralPauseSheetProps {
  readonly visible: boolean;
  /** The game day of today: a pause starts today or later. */
  readonly today: GameDay;
  /** The pause in progress or scheduled (one already over counts as none). */
  readonly pause: PauseInterval | null;
  /** The pause that holds today, for the dialog of «Riprendi». */
  readonly todayPause: TodayPause | null;
  readonly onClose: () => void;
}

const later = (a: GameDay, b: GameDay) => (a > b ? a : b);

/**
 * «Pausa generale» (design-sezioni.md 10.5): what happens during the pause, a calendar with the
 * first day and the last day (optional, included) and «Inizia la pausa». A scheduled pause shows
 * its days with «Cambia» for the end and «Annulla la pausa»; a pause in progress the end with
 * «Cambia» and «Riprendi» (the dialog of Today, 2.8). The calendar is in the sheet on the iPhone,
 * a dialog of the system on Android.
 */
export function GeneralPauseSheet({
  visible,
  today,
  pause,
  todayPause,
  onClose,
}: GeneralPauseSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const language = i18n.language;
  const [fromDay, setFromDay] = useState<GameDay>(today);
  const [untilDay, setUntilDay] = useState<GameDay | null>(null);
  const [editing, setEditing] = useState<Field | null>(null);
  const [changing, setChanging] = useState(false);
  const [asking, setAsking] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setFromDay(pause?.fromDay ?? today);
    setUntilDay(pause?.untilDay ?? null);
    setEditing(null);
    setChanging(false);
  }

  const dateText = (day: GameDay) => dayAndMonth(day, language);
  const started = pause !== null && pause.fromDay <= today;
  const firstEnd = pause === null ? fromDay : later(pause.fromDay, today);

  const choose = (field: Field) => {
    if (field === 'until' && untilDay === null) {
      setUntilDay(firstEnd);
    }
    setEditing(field);
  };
  const onPick = (_event: unknown, date: Date) => {
    const day = dayOf(date);
    if (editing === 'from') {
      setFromDay(day);
      if (untilDay !== null && untilDay < day) {
        setUntilDay(day);
      }
    } else {
      setUntilDay(day);
    }
    if (Platform.OS === 'android') {
      setEditing(null);
    }
  };

  const start = () => {
    runAction((db, clock) => startPause(db, { fromDay, untilDay }, clock));
    announceOnIos(
      fromDay === today
        ? t('pause.sheet.started')
        : t('pause.sheet.scheduledDone', { date: dateText(fromDay) }),
    );
    onClose();
  };
  const saveEnd = () => {
    runAction((db, clock) => changePauseEnd(db, untilDay, clock));
    announceOnIos(t('pause.sheet.changed'));
    setChanging(false);
    setEditing(null);
  };
  const cancel = () => {
    runAction((db, clock) => cancelPause(db, clock));
    announceOnIos(t('pause.sheet.cancelled'));
    onClose();
  };

  const untilValue = untilDay === null ? t('pause.value.open') : dateText(untilDay);
  const endEditor = (
    <>
      <Card style={styles.list}>
        {pause === null ? (
          <SettingsRow
            testID="settings-pause-start"
            icon="calendario"
            label={t('pause.sheet.start')}
            value={dateText(fromDay)}
            onPress={() => choose('from')}
          />
        ) : null}
        <SettingsRow
          testID="settings-pause-end"
          icon="calendario"
          label={t('pause.sheet.end')}
          value={untilValue}
          onPress={() => choose('until')}
        />
        <Pressable
          testID="settings-pause-no-end"
          onPress={() => {
            setUntilDay(null);
            setEditing(null);
          }}
          accessibilityRole="radio"
          accessibilityState={{ checked: untilDay === null }}
          style={styles.option}
        >
          <ThemedText style={styles.flex}>{t('pause.sheet.noEnd')}</ThemedText>
          {untilDay === null ? <Icon name="completa" size={20} color={colors.primary} /> : null}
        </Pressable>
      </Card>
      <ThemedText variant="caption" color={colors.textMuted}>
        {t('pause.sheet.endHint')}
      </ThemedText>
      {editing === null ? null : (
        <View style={styles.picker}>
          <DateTimePicker
            testID="settings-pause-picker"
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            value={dateOf(editing === 'from' ? fromDay : (untilDay ?? firstEnd))}
            minimumDate={dateOf(editing === 'from' ? today : firstEnd)}
            onValueChange={onPick}
            onDismiss={() => setEditing(null)}
          />
        </View>
      )}
    </>
  );

  return (
    <Sheet
      testID="settings-pause-sheet"
      visible={visible}
      onClose={onClose}
      title={t('settings.generalPause')}
    >
      <View style={styles.content}>
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('pause.sheet.explain')}
        </ThemedText>
        {pause === null ? (
          <>
            {endEditor}
            <Button
              testID="settings-pause-confirm"
              label={t('pause.sheet.confirm')}
              onPress={start}
            />
          </>
        ) : (
          <>
            <ThemedText testID="settings-pause-state">
              {todayPause?.lastDay === true
                ? t('pause.sheet.lastDay')
                : started
                  ? t('pause.sheet.inProgress', { date: dateText(pause.fromDay) })
                  : t('pause.sheet.scheduled', { date: dateText(pause.fromDay) })}
            </ThemedText>
            {changing ? (
              <>
                {endEditor}
                <Button
                  testID="settings-pause-save"
                  label={t('pause.sheet.save')}
                  onPress={saveEnd}
                />
              </>
            ) : (
              <Card style={styles.list}>
                <View style={styles.option}>
                  <ThemedText style={styles.flex}>
                    {`${t('pause.sheet.end')}: ${
                      pause.untilDay === null ? t('pause.value.open') : dateText(pause.untilDay)
                    }`}
                  </ThemedText>
                  <Button
                    testID="settings-pause-change"
                    variant="text"
                    label={t('pause.sheet.change')}
                    onPress={() => setChanging(true)}
                  />
                </View>
              </Card>
            )}
            {started ? (
              todayPause === null || todayPause.lastDay ? null : (
                <Button
                  testID="settings-pause-resume"
                  variant="secondary"
                  label={t('pause.sheet.resume')}
                  onPress={() => setAsking(true)}
                />
              )
            ) : (
              <Button
                testID="settings-pause-cancel"
                variant="destructive"
                label={t('pause.sheet.cancel')}
                onPress={cancel}
              />
            )}
          </>
        )}
      </View>
      <ResumePauseDialog
        testID="settings-pause-dialog"
        visible={asking}
        pause={todayPause}
        onClose={() => setAsking(false)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  option: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  picker: { alignItems: 'center' },
});
