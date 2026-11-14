import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { DayColumn } from '@/db/repositories/missionDetail';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import type { DayMark } from '@/rules/missionDetail';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay } from './format';
import { ValueList } from './ValueList';

const CELL = 32;

export interface DayMarksProps {
  readonly testID: string;
  readonly title: string;
  readonly columns: readonly DayColumn[];
}

/**
 * Period Settimana of the detail of a mission (gap L15, provisional): a cell per day, done,
 * missed, skipped, to do today or not expected, each read with its day. With very large text the
 * cells become a list (8.12, A11.1).
 */
export function DayMarks({ testID, title, columns }: DayMarksProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const largeText = useLargeText();
  const spoken = (day: DayColumn['day']) =>
    formatDay(day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });

  const heading = (
    <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
      {title}
    </ThemedText>
  );
  if (largeText) {
    return (
      <View testID={testID} style={styles.block}>
        {heading}
        <ValueList
          testID={`${testID}-list`}
          rows={columns.map((column) => ({
            key: column.day,
            spoken: spoken(column.day),
            text: t(`missionDetail.marks.${column.mark}`),
          }))}
        />
      </View>
    );
  }

  const look: Record<DayMark, { fill: string; border: string }> = {
    done: { fill: colors.done, border: colors.done },
    missed: { fill: 'transparent', border: colors.missed },
    skipped: { fill: colors.track, border: colors.track },
    open: { fill: 'transparent', border: colors.primary },
    off: { fill: 'transparent', border: colors.border },
  };
  const radius = Math.min(SHAPES[family].bar.radius, CELL / 2);

  return (
    <View testID={testID} style={styles.block}>
      {heading}
      <View style={styles.row}>
        {columns.map((column) => (
          <View
            key={column.day}
            testID={`${testID}-${column.day}`}
            accessible
            accessibilityLabel={t('missionDetail.columnValue', {
              label: spoken(column.day),
              value: t(`missionDetail.marks.${column.mark}`),
            })}
            style={styles.day}
          >
            <View
              testID={`${testID}-${column.day}-${column.mark}`}
              style={[
                styles.cell,
                {
                  backgroundColor: look[column.mark].fill,
                  borderColor: look[column.mark].border,
                  borderRadius: radius,
                  borderStyle: column.mark === 'open' ? 'dashed' : 'solid',
                },
              ]}
            />
            <ThemedText variant="caption" color={colors.textMuted}>
              {formatDay(column.day, i18n.language, { weekday: 'narrow' })}
            </ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no">
        {(['done', 'missed', 'skipped'] as const).map((mark) => (
          <View key={mark} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                {
                  backgroundColor: look[mark].fill,
                  borderColor: look[mark].border,
                  borderRadius: radius / 2,
                },
              ]}
            />
            <ThemedText variant="caption" color={colors.textMuted}>
              {t(`missionDetail.marks.${mark}`)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  cell: { width: CELL, height: CELL, borderWidth: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 12, height: 12, borderWidth: 2 },
});
