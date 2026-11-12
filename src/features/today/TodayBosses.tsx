import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { TodayView } from '@/db/repositories/todayView';
import { BossCard, type BossHit } from '@/features/bosses/BossCard';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import type { MissionActions } from './useMissionActions';

/** How long the number of the damage stays beside the bar (design-sezioni.md 5.4). */
export const DAMAGE_MS = 1500;
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
 * `getTodayView`). Without bosses, a row that leads to Obiettivi.
 */
export function TodayBosses({ view, actions }: TodayBossesProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const screenSize = useWindowDimensions();
  // Until the first layout the pages take the width of the screen less the margins of Today.
  const [width, setWidth] = useState(screenSize.width - 2 * SCREEN_MARGIN);
  const [page, setPage] = useState(0);
  const [hit, setHit] = useState<(BossHit & { readonly bossId: string }) | null>(null);
  // A second tap before Today is read again would send the same step twice.
  const lastTap = useRef<{ readonly view: TodayView; readonly stepId: string } | null>(null);
  const { bosses } = view;
  const current = Math.min(page, Math.max(bosses.length - 1, 0));

  useEffect(() => {
    if (hit === null) {
      return undefined;
    }
    const timer = setTimeout(() => setHit(null), DAMAGE_MS);
    return () => clearTimeout(timer);
  }, [hit]);

  if (bosses.length === 0) {
    return (
      <Pressable
        testID="today-bosses-empty"
        accessibilityRole="button"
        onPress={() => router.push('/goals')}
        style={styles.empty}
      >
        <Icon name="boss" size={20} color={colors.textMuted} />
        <ThemedText style={styles.flex}>{t('bosses.today.empty', { context: family })}</ThemedText>
        <Icon name="avanti" size={20} color={colors.textMuted} />
      </Pressable>
    );
  }

  const cards = bosses.map((item) => (
    <View key={item.boss.id} style={bosses.length > 1 ? { width } : undefined}>
      <BossCard
        testID={`today-boss-${item.boss.id}`}
        item={item}
        day={view.day}
        hit={hit?.bossId === item.boss.id ? hit : null}
        onCompleteStep={() => {
          const stepId = item.nextStep?.id;
          if (stepId === undefined) {
            return;
          }
          if (lastTap.current?.view === view && lastTap.current.stepId === stepId) {
            return;
          }
          lastTap.current = { view, stepId };
          const dealt = actions.completeStep(item);
          if (dealt !== null) {
            setHit((last) => ({ bossId: item.boss.id, dealt, key: (last?.key ?? 0) + 1 }));
          }
        }}
      />
    </View>
  ));

  return (
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
