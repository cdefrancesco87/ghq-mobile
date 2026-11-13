import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { ProgressRing, ringStroke } from '@/features/shared/ProgressRing';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';

const RING_SIZE = 32;

export interface SummaryTileProps {
  readonly testID: string;
  readonly label: string;
  /** The large number, already written. */
  readonly value: string;
  /** The value for the screen reader when the written one is a sign, like «–». */
  readonly spokenValue?: string;
  /** Beside the number, like the flame of the streak. */
  readonly icon?: IconName;
  /** A small ring before the number, from 0 to 1. */
  readonly ring?: number;
  /** Under the number, muted: what it counts, like «giorni di fila». */
  readonly unit?: string;
  /** Under the number, in the colour of done things: a positive comparison. */
  readonly note?: string;
}

/** A tile of the summary of Statistics: the name, the large number and a line under it (8.2). */
export function SummaryTile({
  testID,
  label,
  value,
  spokenValue,
  icon,
  ring,
  unit,
  note,
}: SummaryTileProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const under = [unit, note].filter((line): line is string => line !== undefined);
  return (
    <Card testID={testID} style={styles.tile}>
      <View
        accessible
        accessibilityLabel={t('statsScreen.tileLabel', {
          label,
          value: spokenValue ?? value,
          detail: under.join('. '),
          context: under.length === 0 ? 'short' : undefined,
        })}
        style={styles.content}
      >
        <ThemedText variant="caption" color={colors.textMuted}>
          {label}
        </ThemedText>
        <View style={styles.value}>
          {ring === undefined ? null : (
            <ProgressRing progress={ring} size={RING_SIZE} strokeWidth={ringStroke(family)} />
          )}
          <ThemedText testID={`${testID}-value`} variant="display">
            {value}
          </ThemedText>
          {icon === undefined ? null : <Icon name={icon} size={20} color={colors.textMuted} />}
        </View>
        {unit === undefined ? null : (
          <ThemedText variant="caption" color={colors.textMuted}>
            {unit}
          </ThemedText>
        )}
        {note === undefined ? null : (
          <ThemedText testID={`${testID}-note`} variant="caption" color={colors.doneText}>
            {note}
          </ThemedText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  content: { gap: 4 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
