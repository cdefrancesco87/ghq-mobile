import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { GoalsView } from '@/db/repositories/goalsView';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';

const SPRITE_SIZE = 40;

export interface ArchivedGoalsScreenProps {
  readonly view: GoalsView;
}

/**
 * «Obiettivi archiviati» from the menu «Altro» of Obiettivi (design-sezioni.md 5.1, mockup D22):
 * a list to read, from the most recent, with the day of the archiving and the steps done. Taking
 * an archived goal back is not in the analysis (gap L16), so there is no «Ripristina».
 */
export function ArchivedGoalsScreen({ view }: ArchivedGoalsScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { nameOf } = useBossTexts();

  return (
    <View
      testID="goals-archived-screen"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        testID="goals-archived-header"
        title={t('goals.archivedTitle')}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {view.archived.length === 0 ? (
          <ThemedText testID="goals-archived-empty" color={colors.textMuted} style={styles.empty}>
            {t('goals.archivedEmpty')}
          </ThemedText>
        ) : (
          <Card>
            {view.archived.map((item, index) => {
              const [, month, day] = item.archivedDay.split('-').map(Number);
              const name = nameOf(item.boss);
              const detail = t('goals.archivedDetail', {
                day,
                month: t(`shared.frequency.month.${month}`),
                done: item.stepsDone,
                total: item.stepsTotal,
              });
              return (
                <Fragment key={item.boss.id}>
                  {index === 0 ? null : (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                  <View
                    testID={`goals-archived-${item.boss.id}`}
                    accessible
                    accessibilityLabel={`${name}, ${detail}`}
                    style={styles.row}
                  >
                    <BossSprite
                      kind={item.boss.kind === 'starter' ? 'quest' : item.boss.difficulty}
                      size={SPRITE_SIZE}
                    />
                    <View style={styles.flex}>
                      <ThemedText color={colors.textMuted}>{name}</ThemedText>
                      <ThemedText variant="caption" color={colors.textMuted}>
                        {detail}
                      </ThemedText>
                    </View>
                  </View>
                </Fragment>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 16 },
  row: { minHeight: MIN_TOUCH + 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', paddingVertical: 32 },
});
