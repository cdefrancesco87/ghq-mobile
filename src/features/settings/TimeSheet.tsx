import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/features/shared/Button';
import { formatClock, timeOf } from '@/features/shared/formatClock';
import { Sheet } from '@/features/shared/Sheet';

/** A date of the picker at a `HH:MM` time, in the time of the phone. */
function dateAt(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes);
}

export interface TimeSheetProps {
  readonly testID: string;
  readonly visible: boolean;
  readonly title: string;
  /** The time the picker starts from, `HH:MM`. */
  readonly value: string;
  readonly onDone: (time: string) => void;
  readonly onClose: () => void;
}

/**
 * The time picker of the system (design-sezioni.md 10.12): on Android its dialog answers once; on
 * iOS a wheel in a sheet waits for «Usa le …».
 */
export function TimeSheet({ testID, visible, title, value, onDone, onClose }: TimeSheetProps) {
  const { t, i18n } = useTranslation();
  const [picked, setPicked] = useState(() => dateAt(value));
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    setPicked(dateAt(value));
  }

  if (Platform.OS === 'android') {
    return visible ? (
      <DateTimePicker
        testID={`${testID}-picker`}
        mode="time"
        value={picked}
        onValueChange={(_event, date) => onDone(timeOf(date))}
        onDismiss={onClose}
      />
    ) : null;
  }
  return (
    <Sheet testID={testID} visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
        <DateTimePicker
          testID={`${testID}-picker`}
          mode="time"
          display="spinner"
          value={picked}
          onValueChange={(_event, date) => setPicked(date)}
        />
        <Button
          testID={`${testID}-done`}
          label={t('settings.confirmTime', { time: formatClock(timeOf(picked), i18n.language) })}
          onPress={() => onDone(timeOf(picked))}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16, alignItems: 'stretch' },
});
