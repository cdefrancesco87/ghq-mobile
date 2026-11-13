import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { setSetting } from '@/db/repositories/settings';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { SETTINGS_SCREEN } from '@/rules/config';
import { runAction } from '@/stores/app';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { quietTimes, type QuietInterval } from './format';
import { SettingsRow } from './SettingsRow';
import { TimeSheet } from './TimeSheet';

type Editing = { readonly index: number; readonly edge: 'start' | 'end' } | null;

/**
 * «Non disturbare» (design-sezioni.md 10.6, mockup D36B): the intervals, each with its start and
 * end from the time picker of the system and a button to remove it, «+ Aggiungi intervallo» and
 * what happens to the reminders inside. Every change schedules the reminders again (`runAction`).
 */
export function QuietHoursScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const intervals = useSettingsStore((state) => state.settings.quiet_hours);
  const [editing, setEditing] = useState<Editing>(null);
  // Kept while the picker closes, so its title and time do not jump.
  const [lastEditing, setLastEditing] = useState<NonNullable<Editing>>({ index: 0, edge: 'start' });

  const save = (next: readonly QuietInterval[]) =>
    runAction((db, clock) => setSetting(db, 'quiet_hours', [...next], clock.now));
  const edit = (index: number, edge: 'start' | 'end') => {
    setLastEditing({ index, edge });
    setEditing({ index, edge });
  };
  const editedTime = intervals[lastEditing.index]?.[lastEditing.edge] ?? '00:00';

  return (
    <View
      testID="settings-quiet-screen"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        testID="settings-quiet-header"
        title={t('settings.quietHours')}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {intervals.length === 0 ? (
          <ThemedText testID="settings-quiet-empty" color={colors.textMuted}>
            {t('settings.quietEmpty')}
          </ThemedText>
        ) : null}
        {intervals.map((interval, index) => {
          const times = quietTimes(interval, i18n.language);
          return (
            <Card
              // The intervals have no id: the position is their name («Intervallo 2»).
              key={index}
              testID={`settings-quiet-${index}`}
              style={styles.card}
            >
              <View style={styles.cardTitle}>
                <ThemedText
                  variant="label"
                  color={colors.textMuted}
                  accessibilityRole="header"
                  accessibilityLabel={`${t('settings.quietInterval', { n: index + 1 })}, ${t('settings.quietRangeLabel', times)}`}
                  style={styles.flex}
                >
                  {t('settings.quietInterval', { n: index + 1 })}
                </ThemedText>
                <Pressable
                  testID={`settings-quiet-${index}-remove`}
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.quietRemove', {
                    range: t('settings.quietRangeLabel', times),
                  })}
                  onPress={() => save(intervals.filter((_, item) => item !== index))}
                  style={styles.remove}
                >
                  <Icon name="elimina" size={20} color={colors.dangerText} />
                </Pressable>
              </View>
              <SettingsRow
                testID={`settings-quiet-${index}-start`}
                icon="non-disturbare"
                label={t('settings.quietStart')}
                value={times.start}
                onPress={() => edit(index, 'start')}
              />
              <SettingsRow
                testID={`settings-quiet-${index}-end`}
                icon="sole"
                label={t('settings.quietEnd')}
                value={times.end}
                onPress={() => edit(index, 'end')}
                last
              />
            </Card>
          );
        })}
        <Button
          testID="settings-quiet-add"
          variant="secondary"
          label={`+ ${t('settings.quietAdd')}`}
          accessibilityLabel={t('settings.quietAdd')}
          onPress={() => save([...intervals, { ...SETTINGS_SCREEN.newQuietInterval }])}
        />
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('settings.quietHint')}
        </ThemedText>
      </ScrollView>
      <TimeSheet
        testID="settings-quiet-time"
        visible={editing !== null}
        title={t(lastEditing.edge === 'start' ? 'settings.quietStart' : 'settings.quietEnd')}
        value={editedTime}
        onDone={(time) => {
          if (editing !== null) {
            save(
              intervals.map((interval, index) =>
                index === editing.index ? { ...interval, [editing.edge]: time } : interval,
              ),
            );
          }
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 },
  card: { paddingVertical: 0 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', paddingTop: 4 },
  flex: { flex: 1 },
  remove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
