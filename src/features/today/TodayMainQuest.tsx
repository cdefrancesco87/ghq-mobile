import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { TodayView } from '@/db/repositories/todayView';
import { BossCard } from '@/features/bosses/BossCard';
import { useBossStep } from '@/features/bosses/useBossStep';
import { ThemedText } from '@/features/shared/ThemedText';
import { useEssential } from '@/features/shared/useGameMode';
import { isDeadlineHeld } from '@/rules/pause';
import type { MissionActions } from './useMissionActions';

export interface TodayMainQuestProps {
  readonly view: TodayView;
  readonly actions: MissionActions;
}

/**
 * The Main Quest at the top of Today, above the Plan of the day (design-sezioni.md 5.8; task T83):
 * the compact card of the boss with its crown and the control of its next step. It leaves the
 * other bosses of Today. In the Essential mode the bosses are not on Today (2.10), nor is it.
 */
export function TodayMainQuest({ view, actions }: TodayMainQuestProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const step = useBossStep(actions.completeStep, view);
  const essential = useEssential();
  const item = view.mainQuest;
  if (item === null || essential) {
    return null;
  }
  return (
    <View testID="today-main-quest" style={styles.section}>
      <ThemedText variant="sectionTitle" accessibilityRole="header">
        {t('bosses.main.title')}
      </ThemedText>
      <BossCard
        testID={`today-main-${item.boss.id}`}
        item={item}
        day={view.day}
        crowned
        hit={step.hitOf(item.boss.id)}
        onCompleteStep={() => step.completeStep(item)}
        onOpen={() => router.push({ pathname: '/boss/[id]', params: { id: item.boss.id } })}
        held={isDeadlineHeld(item.boss.deadlineDay, view.pause)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
});
