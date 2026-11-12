import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  notificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/features/notifications/system';
import { Button } from '@/features/shared/Button';
import { Chip } from '@/features/shared/Chip';
import { formatClock } from '@/features/shared/formatClock';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';

/** The time the picker starts from. */
const DEFAULT_HOUR = 8;

const pad = (value: number) => String(value).padStart(2, '0');

/** `HH:MM` of the time chosen in the picker, in the time of the phone. */
export function timeOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface RemindersSheetProps {
  readonly visible: boolean;
  readonly value: readonly string[];
  readonly onDone: (times: readonly string[]) => void;
  readonly onClose: () => void;
}

/**
 * «Promemoria» (design-sezioni.md 4.8, mockup D14): the times as chips that can be removed and
 * «+ Aggiungi orario» with the time picker of the system. A denied permission is said, with the
 * way to the Settings, without blocking the save; a permission never asked is asked here with the
 * words of the first launch.
 */
export function RemindersSheet({ visible, value, onDone, onClose }: RemindersSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [times, setTimes] = useState<readonly string[]>(value);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Date(2000, 0, 1, DEFAULT_HOUR, 0));
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setTimes(value);
    setPicking(false);
  }

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    let active = true;
    void notificationPermission()
      .then((state) => active && setPermission(state))
      .catch(() => active && setPermission(null));
    return () => {
      active = false;
    };
  }, [visible]);

  const add = (date: Date) => {
    const time = timeOf(date);
    setTimes((current) => (current.includes(time) ? current : [...current, time].sort()));
    setPicking(false);
  };

  const onPick = (_event: unknown, date: Date) => {
    setPicked(date);
    // Android shows a dialog that answers once; iOS shows a wheel and waits for «Aggiungi».
    if (Platform.OS === 'android') {
      add(date);
    }
  };

  const ask = async () => {
    const granted = await requestNotificationPermission().catch(() => false);
    setPermission(granted ? 'granted' : await notificationPermission().catch(() => null));
  };

  return (
    <Sheet
      testID="editor-reminders"
      visible={visible}
      onClose={onClose}
      title={t('editor.reminders')}
    >
      <View style={styles.content}>
        {permission === 'denied' ? (
          <View testID="editor-reminders-denied" style={styles.notice}>
            <View style={styles.noticeTitle}>
              <Icon name="notifiche-bloccate" size={20} color={colors.text} />
              <ThemedText variant="label">{t('editor.remindersDenied')}</ThemedText>
            </View>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('editor.remindersDeniedBody')}
            </ThemedText>
            <Button
              testID="editor-reminders-settings"
              variant="text"
              label={t('editor.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        ) : null}
        {permission === 'undetermined' ? (
          <View testID="editor-reminders-ask" style={styles.notice}>
            <ThemedText variant="label">{t('onboarding.notifications.title')}</ThemedText>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('onboarding.notifications.body')}
            </ThemedText>
            <Button
              testID="editor-reminders-enable"
              variant="secondary"
              label={t('onboarding.notifications.enable')}
              onPress={() => void ask()}
            />
          </View>
        ) : null}
        <ThemedText variant="label" color={colors.textMuted}>
          {t('editor.times')}
        </ThemedText>
        <View style={styles.chips}>
          {times.map((time) => {
            const label = formatClock(time, i18n.language);
            return (
              <Chip
                key={time}
                testID={`editor-reminder-${time}`}
                selected
                icon="chiudi"
                label={label}
                accessibilityLabel={t('editor.removeTime', { time: label })}
                onPress={() => setTimes((current) => current.filter((item) => item !== time))}
              />
            );
          })}
          <Chip
            testID="editor-reminders-add"
            icon="aggiungi"
            label={t('editor.addTime')}
            onPress={() => setPicking(true)}
          />
        </View>
        {picking ? (
          <View style={styles.picker}>
            <DateTimePicker
              testID="editor-reminders-picker"
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              value={picked}
              onValueChange={onPick}
              onDismiss={() => setPicking(false)}
            />
            {Platform.OS === 'ios' ? (
              <Pressable
                testID="editor-reminders-confirm"
                accessibilityRole="button"
                onPress={() => add(picked)}
                style={styles.confirm}
              >
                <ThemedText variant="label" color={colors.primary}>
                  {t('editor.addThisTime', { time: formatClock(timeOf(picked), i18n.language) })}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <Button
          testID="editor-reminders-done"
          label={t('editor.done')}
          onPress={() => onDone(times)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  notice: { gap: 4, alignItems: 'flex-start' },
  noticeTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  picker: { alignItems: 'center' },
  confirm: { minHeight: 44, justifyContent: 'center' },
});
