import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { TodayView } from '@/db/repositories/todayView';
import { BossCard } from '@/features/bosses/BossCard';
import { useBossStep } from '@/features/bosses/useBossStep';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import { StarterQuestCard } from './StarterQuestCard';
import type { MissionActions } from './useMissionActions';

const DOT_SIZE = 6;
/** The side margin of the content of Today (TodayScreen). */
const SCREEN_MARGIN = 16;

export interface TodayBossesProps {
  readonly view: TodayView;
  readonly actions: MissionActions;
}

/**
 * Boss in corso (design-sezioni.md 2.4): the compact card of each active boss, in a horizontal
 * scroll with dots when there is more than one, from the nearest deadline (the order of
 * `getTodayView`). The quest of the first launch has its own card above them (design 1.7). Without
 * bosses, a row that leads to Obiettivi, which takes the place of the quest once it is won (1.8).
 */
export function TodayBosses({ view, actions }: TodayBossesProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const screenSize = useWindowDimensions();
  // Until the first layout the pages take the width of the screen less the margins of Today.
  const [width, setWidth] = useState(screenSize.width - 2 * SCREEN_MARGIN);
  const [page, setPage] = useState(0);
  const step = useBossStep(actions.completeStep, view);
  const bosses = view.bosses.filter((item) => item.boss.kind !== 'starter');
  const quest = view.starterQuest === null ? null : <StarterQuestCard quest={view.starterQuest} />;
  const current = Math.min(page, Math.max(bosses.length - 1, 0));

  if (bosses.length === 0) {
    return (
      quest ?? (
        <Pressable
          testID="today-bosses-empty"
          accessibilityRole="button"
          onPress={() => router.push('/goals')}
          style={styles.empty}
        >
          <Icon name="boss" size={20} color={colors.textMuted} />
          <ThemedText style={styles.flex}>
            {t('bosses.today.empty', { context: family })}
          </ThemedText>
          <Icon name="avanti" size={20} color={colors.textMuted} />
        </Pressable>
      )
    );
  }

  const cards = bosses.map((item) => (
    <View key={item.boss.id} style={bosses.length > 1 ? { width } : undefined}>
      <BossCard
        testID={`today-boss-${item.boss.id}`}
        item={item}
        day={view.day}
        hit={step.hitOf(item.boss.id)}
        onCompleteStep={() => step.completeStep(item)}
        onOpen={() => router.push({ pathname: '/boss/[id]', params: { id: item.boss.id } })}
      />
    </View>
  ));

  return (
    <>
      {quest}
      <View testID="today-bosses" style={styles.section}>
        <ThemedText variant="sectionTitle" accessibilityRole="header">
          {t(bosses.length > 1 ? 'lexicon.boss_pl' : 'lexicon.boss', { context: family })}
        </ThemedText>
        {bosses.length === 1 ? (
          cards
        ) : (
          <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
            <ScrollView
              testID="today-bosses-scroll"
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={({ nativeEvent }) =>
                setPage(width > 0 ? Math.round(nativeEvent.contentOffset.x / width) : 0)
              }
            >
              {cards}
            </ScrollView>
            {/* The screen reader goes through the cards one by one: the dots are only drawn. */}
            <View
              style={styles.dots}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {bosses.map((item, index) => (
                <View
                  key={item.boss.id}
                  testID={`today-bosses-dot-${index}`}
                  style={[
                    styles.dot,
                    { backgroundColor: index === current ? colors.primary : colors.border },
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  flex: { flex: 1 },
  empty: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 8 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
