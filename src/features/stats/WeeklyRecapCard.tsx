import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { WeeklyRecapView } from '@/db/repositories/weeklyRecap';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { termInSentence } from '@/i18n/lexicon';
import { companionName } from '@/rules/companion';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay } from './format';

export interface WeeklyRecapCardProps {
  readonly view: WeeklyRecapView;
  readonly testID: string;
}

interface Line {
  readonly key: string;
  readonly icon: IconName;
  readonly text: string;
}

/**
 * The weekly recap (design-sezioni.md 8.7, 8.11; backlog T81): the title in the tone of the theme
 * (gap L30), the days of the week and at most four lines, only the successes: the most constant
 * mission, the damage to the bosses, the levels and stat points gained, the records beaten. A bad
 * week closes with a line of encouragement signed by the companion. The screen reader reads the
 * card as one text.
 */
export function WeeklyRecapCard({ view, testID }: WeeklyRecapCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const { recap } = view;
  const language = i18n.language;
  const lexicon = (key: string) => t(`lexicon.${key}`, { context: family });
  const inSentence = (key: string) => termInSentence(lexicon(key), language);
  const short = (day: WeeklyRecapView['firstDay']) =>
    formatDay(day, language, { day: 'numeric', month: 'short' });

  const lines: Line[] = [];
  if (recap.mostConsistent !== null) {
    lines.push({
      key: 'mostConsistent',
      icon: 'serie',
      text: t('statsScreen.recap.mostConsistent', { ...recap.mostConsistent }),
    });
  }
  if (recap.bossDamage !== null) {
    lines.push({
      key: 'bossDamage',
      icon: 'spada',
      text: t('statsScreen.recap.bossDamage', {
        term: lexicon('boss_pl'),
        damage: recap.bossDamage,
      }),
    });
  }
  if (recap.progress !== null) {
    const { levels, statPoints } = recap.progress;
    const parts = [
      levels > 0
        ? t('statsScreen.recap.levels', {
            count: levels,
            term: inSentence(levels === 1 ? 'level' : 'level_pl'),
          })
        : null,
      statPoints > 0 ? t('statsScreen.recap.points', { count: statPoints }) : null,
    ].filter((part): part is string => part !== null);
    lines.push({ key: 'progress', icon: 'livello', text: parts.join(' · ') });
  }
  if (recap.records.length > 0) {
    const list = recap.records
      .map((record) =>
        t('statsScreen.recap.recordItem', {
          name: record.name ?? lexicon('streak'),
          count: record.streak,
        }),
      )
      .join('; ');
    lines.push({ key: 'records', icon: 'trofeo', text: t('statsScreen.recap.records', { list }) });
  }

  const title = t('statsScreen.recap.title', { context: family });
  const range = t('statsScreen.recap.range', {
    from: short(view.firstDay),
    to: short(view.lastDay),
  });
  const encouragement = recap.encouragement
    ? `${t('statsScreen.recap.encouragement')} ${t('statsScreen.recap.signature', {
        name: companionName(view.companionName, lexicon('companion')),
      })}`
    : null;

  return (
    <Card testID={testID}>
      <View
        accessible
        accessibilityLabel={[title, range, ...lines.map((line) => line.text), encouragement]
          .filter((part) => part !== null)
          .join('. ')}
        style={styles.content}
      >
        <View style={styles.heading}>
          <ThemedText variant="sectionTitle" style={styles.grow}>
            {title}
          </ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {range}
          </ThemedText>
        </View>
        {lines.map((line) => (
          <View key={line.key} testID={`${testID}-${line.key}`} style={styles.line}>
            <Icon name={line.icon} size={20} color={colors.primary} />
            <ThemedText style={styles.grow}>{line.text}</ThemedText>
          </View>
        ))}
        {encouragement === null ? null : (
          <ThemedText testID={`${testID}-encouragement`} color={colors.textMuted}>
            {encouragement}
          </ThemedText>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  grow: { flexGrow: 1, flexShrink: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
