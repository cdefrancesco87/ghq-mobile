import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { StatDetail } from '@/db/repositories/profile';
import { Bar } from '@/features/shared/Bar';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { statIcon } from '@/features/shared/icons';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { formatDay } from '@/features/stats/format';
import { BadgeGrid } from './BadgesScreen';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';

export interface StatSheetProps {
  readonly visible: boolean;
  /** The stat last opened: it stays while the sheet slides away. */
  readonly detail: StatDetail | null;
  readonly onClose: () => void;
}

/**
 * The detail of a stat in a sheet (design-sezioni.md 9.5; mockup D33A): level, points towards the
 * next level and how many are missing, what makes it grow, the latest gains from the log
 * («+20 Corsa, ieri») and the missions that feed it; at the bottom its three badges, at levels 3,
 * 6 and 10 (backlog T84), shown without opening another sheet.
 */
export function StatSheet({ visible, detail, onClose }: StatSheetProps) {
  const largeText = useLargeText();
  return (
    <Sheet
      visible={visible && detail !== null}
      onClose={onClose}
      size={largeText ? 'full' : 'half'}
      testID="profile-stat-sheet"
    >
      {detail === null ? null : <Content detail={detail} />}
    </Sheet>
  );
}

function Content({ detail }: { readonly detail: StatDetail }) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const { stat, points, progress, gains, missions, today, badges } = detail;
  const name = t(`stats.${stat}`, { context: family });
  const next = progress.level + 1;
  const when = (day: GameDay) =>
    day === today
      ? t('profile.detail.today')
      : day === addDays(today, -1)
        ? t('profile.detail.yesterday')
        : formatDay(day, i18n.language, { day: 'numeric', month: 'long' });

  return (
    <View style={styles.content}>
      <View style={styles.head}>
        <Icon name={statIcon(stat)} color={colors.primary} />
        <View style={styles.flex}>
          <ThemedText
            testID="profile-stat-sheet-title"
            variant="sectionTitle"
            accessibilityRole="header"
          >
            {t('profile.detail.title', { name, level: progress.level })}
          </ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('profile.detail.subtitle')}
          </ThemedText>
        </View>
      </View>

      {progress.toNext === null ? (
        <View style={styles.block}>
          <ThemedText variant="label">{t('profile.maxLevel')}</ThemedText>
          <ThemedText testID="profile-stat-sheet-points" variant="caption" color={colors.textMuted}>
            {t('profile.detail.total', { count: points })}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.block}>
          <Bar
            kind="stat"
            label={t('profile.detail.towards', { level: next })}
            value={progress.inLevel}
            max={progress.toNext}
            testID="profile-stat-sheet-bar"
          />
          <ThemedText testID="profile-stat-sheet-left" variant="caption" color={colors.textMuted}>
            {t('profile.detail.left', { count: progress.toNext - progress.inLevel, level: next })}
          </ThemedText>
        </View>
      )}

      <ThemedText variant="body">{t(`profile.detail.grows.${stat}`)}</ThemedText>

      <View style={styles.block}>
        <ThemedText variant="caption" color={colors.textMuted} accessibilityRole="header">
          {t('profile.detail.gains')}
        </ThemedText>
        {gains.length === 0 ? (
          <ThemedText testID="profile-stat-sheet-no-gains" color={colors.textMuted}>
            {t('profile.detail.noGains')}
          </ThemedText>
        ) : (
          <Card>
            {gains.map((gain, index) => (
              <ThemedText
                key={gain.id}
                testID={`profile-stat-gain-${index}`}
                style={index > 0 ? styles.gap : null}
              >
                {t('profile.detail.gain', {
                  points: gain.points,
                  name: gain.name,
                  when: when(gain.gameDay),
                })}
              </ThemedText>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.block}>
        <ThemedText variant="caption" color={colors.textMuted} accessibilityRole="header">
          {t('profile.detail.missions', { term: t('lexicon.missions_pl', { context: family }) })}
        </ThemedText>
        {missions.length === 0 ? (
          <ThemedText testID="profile-stat-sheet-no-missions" color={colors.textMuted}>
            {t('profile.detail.noMissions')}
          </ThemedText>
        ) : (
          <Card>
            {missions.map((mission, index) => (
              <ThemedText
                key={mission.id}
                testID={`profile-stat-mission-${mission.id}`}
                style={index > 0 ? styles.gap : null}
              >
                {mission.name}
              </ThemedText>
            ))}
          </Card>
        )}
      </View>

      {badges.length === 0 ? null : (
        <View style={styles.block}>
          <ThemedText variant="caption" color={colors.textMuted} accessibilityRole="header">
            {t('badges.statSection', { stat: name })}
          </ThemedText>
          <BadgeGrid testID="profile-stat-badges" items={badges} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  block: { gap: 8 },
  gap: { marginTop: 12 },
});
