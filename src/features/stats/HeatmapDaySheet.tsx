import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { HeatmapDay, HeatmapMark } from '@/db/repositories/heatmap';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { termInSentence } from '@/i18n/lexicon';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay } from './format';

const MARK_ICONS: Record<HeatmapMark, IconName> = {
  done: 'completa',
  missed: 'chiudi',
  skipped: 'salta',
  open: 'timer',
};

export interface HeatmapDaySheetProps {
  readonly visible: boolean;
  /** The day shown, kept while the sheet slides away. */
  readonly day: HeatmapDay | null;
  readonly onClose: () => void;
}

/** «Giovedì 5 novembre»: the long date of a day, with a capital letter. */
export function longDay(day: HeatmapDay['day'], language: string): string {
  const text = formatDay(day, language, { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

/**
 * The sheet of a day of the heatmap (design-sezioni.md 8.3, mockup D30): the date, the missions
 * done out of those expected with the percentage, and every mission of the day (done, missed,
 * skipped; today also those still to do). The forgotten completion arrives with T68.
 */
export function HeatmapDaySheet({ visible, day, onClose }: HeatmapDaySheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const term = (count: number) =>
    termInSentence(
      t(count === 1 ? 'lexicon.missions' : 'lexicon.missions_pl', { context: family }),
      i18n.language,
    );
  const markColor: Record<HeatmapMark, string> = {
    done: colors.doneText,
    missed: colors.dangerText,
    skipped: colors.textMuted,
    open: colors.textMuted,
  };

  return (
    <Sheet
      testID="stats-day-sheet"
      visible={visible}
      onClose={onClose}
      title={day === null ? undefined : longDay(day.day, i18n.language)}
    >
      {day === null ? null : (
        <View style={styles.content}>
          <ThemedText testID="stats-day-count" color={colors.textMuted}>
            {day.rate === null
              ? t('statsScreen.heatmapDayNothing')
              : t('statsScreen.heatmapDayCount', {
                  done: day.done,
                  scheduled: day.scheduled,
                  term: term(day.done),
                  rate: day.rate,
                })}
          </ThemedText>
          {day.missions.length === 0 ? null : (
            <Card testID="stats-day-missions">
              {day.missions.map(({ mission, mark }, index) => (
                <View key={mission.id}>
                  {index === 0 ? null : (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                  <View
                    testID={`stats-day-${mission.id}-${mark}`}
                    accessible
                    accessibilityLabel={t('missionDetail.columnValue', {
                      label: mission.name,
                      value: t(`missionDetail.marks.${mark}`),
                    })}
                    style={styles.row}
                  >
                    <ThemedText style={styles.name}>{mission.name}</ThemedText>
                    <ThemedText variant="caption" color={markColor[mark]}>
                      {t(`missionDetail.marks.${mark}`)}
                    </ThemedText>
                    <Icon name={MARK_ICONS[mark]} size={20} color={markColor[mark]} />
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  name: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
});
