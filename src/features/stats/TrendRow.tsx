import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MissionTrend } from '@/db/repositories/statsView';
import { Bar } from '@/features/shared/Bar';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { useTheme } from '@/theme/ThemeProvider';

const MIN_HEIGHT = 64;
const NAME_LINES = 2;
const LARGE_TEXT_NAME_LINES = 3;
/** The rate of a mission with nothing expected in the period. */
const NO_RATE = '–';

export interface TrendRowProps {
  readonly trend: MissionTrend;
  /** Opens the detail of the mission (8.4). */
  readonly onPress: () => void;
}

/** A mission in «Andamento delle missioni»: name, streak and the bar of the rate (8.4, B9). */
export function TrendRow({ trend, onPress }: TrendRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const large = useLargeText();
  const { mission, rate } = trend;
  const testID = `stats-trend-${mission.id}`;
  const weeks = mission.frequency?.type === 'times_per_week';
  const streak = t(
    `shared.missionRow.${weeks ? 'streakWeek' : 'streakDay'}${mission.streak === 1 ? '' : 's'}`,
    { streak: mission.streak },
  );
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        rate === null
          ? t('statsScreen.trendLabelNoRate', { name: mission.name, streak })
          : t('statsScreen.trendLabel', { name: mission.name, streak, rate })
      }
      style={styles.row}
    >
      <View style={styles.top}>
        <ThemedText numberOfLines={large ? LARGE_TEXT_NAME_LINES : NAME_LINES} style={styles.name}>
          {mission.name}
        </ThemedText>
        <View style={styles.streak}>
          <Icon name="serie" size={16} color={colors.textMuted} />
          <ThemedText testID={`${testID}-streak`} variant="numbers">
            {String(mission.streak)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.bottom}>
        {/* The row says the rate. */}
        <View
          style={styles.bar}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Bar
            kind="stat"
            label={mission.name}
            value={rate ?? 0}
            max={100}
            showLabel={false}
            showValue={false}
          />
        </View>
        <ThemedText testID={`${testID}-rate`} variant="numbers">
          {rate === null ? NO_RATE : t('statsScreen.percent', { rate })}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_HEIGHT, gap: 8, paddingVertical: 12 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { flex: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { flex: 1 },
});
