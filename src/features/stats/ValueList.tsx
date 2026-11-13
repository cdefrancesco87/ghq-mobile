import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';

export interface ValueRow {
  readonly key: string;
  /** The row in words, e.g. «settimana del 9 novembre». */
  readonly spoken: string;
  /** The value already written. */
  readonly text: string;
}

export interface ValueListProps {
  readonly testID: string;
  readonly rows: readonly ValueRow[];
}

/** The table of the values of a chart: the chart itself with very large text (8.12, A11.1). */
export function ValueList({ testID, rows }: ValueListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.list}>
      {rows.map((row, index) => (
        <View
          key={row.key}
          testID={`${testID}-${index}`}
          accessible
          accessibilityLabel={t('missionDetail.columnValue', {
            label: row.spoken,
            value: row.text,
          })}
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <ThemedText style={styles.name}>{row.spoken}</ThemedText>
          <ThemedText variant="numbers">{row.text}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { flexShrink: 1 },
});
