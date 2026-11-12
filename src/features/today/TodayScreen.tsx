import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TodayView } from '@/db/repositories/todayView';
import { Card } from '@/features/shared/Card';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { EmptyState } from '@/features/shared/EmptyState';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { hitSlopFor } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import { DayPlan } from './DayPlan';
import { HeroCard } from './HeroCard';
import { HeroStickyBar } from './HeroStickyBar';
import { TodayHeader } from './TodayHeader';
import { TodayMissions } from './TodayMissions';
import { useMissionActions } from './useMissionActions';
import { useMissionMenu } from './useMissionMenu';

const EMPTY_COMPANION_SIZE = 128;
const CLOSE_ICON = 20;

export interface TodayScreenProps {
  readonly view: TodayView;
  /** Minutes east of UTC of the phone, for the times of completion. */
  readonly tzOffset: number;
}

/**
 * Today (design-sezioni.md 2.1, 2.2, 2.3, 2.5, 2.8): date and greeting, the notice of the shield,
 * the hero card, the plan of the day and the missions of today, or the empty states. The boss
 * comes with the next task.
 */
export function TodayScreen({ view, tzOffset }: TodayScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  // Bottom edge of the hero card in the scroll: past it the thin bar takes its place.
  const [heroBottom, setHeroBottom] = useState<number | null>(null);
  const [sticky, setSticky] = useState(false);
  const [shieldClosed, setShieldClosed] = useState(false);
  const actions = useMissionActions();
  const menu = useMissionMenu(view, actions);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = heroBottom !== null && nativeEvent.contentOffset.y > heroBottom;
    if (past !== sticky) {
      setSticky(past);
    }
  };

  const emptyCompanion = (
    <CompanionSprite
      stage={view.companion.stage}
      mood={view.companion.mood}
      size={EMPTY_COMPANION_SIZE}
    />
  );

  return (
    <View testID="today-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        testID="today-scroll"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: top + 16 }]}
      >
        <TodayHeader
          day={view.day}
          heroName={view.hero.name}
          doneCount={view.doneCount}
          totalCount={view.totalCount}
        />
        {view.notices.shieldUsedYesterday && !shieldClosed ? (
          <Card testID="today-notice-shield">
            <View style={styles.notice}>
              <Icon name="scudo" size={20} color={colors.infoText} />
              <ThemedText style={styles.flex}>{t('today.notices.shieldUsed')}</ThemedText>
              <Pressable
                testID="today-notice-shield-close"
                accessibilityRole="button"
                accessibilityLabel={t('shared.close')}
                onPress={() => setShieldClosed(true)}
                hitSlop={hitSlopFor(CLOSE_ICON)}
              >
                <Icon name="chiudi" size={CLOSE_ICON} color={colors.textMuted} />
              </Pressable>
            </View>
          </Card>
        ) : null}
        <View
          testID="today-hero-slot"
          onLayout={({ nativeEvent }) =>
            setHeroBottom(nativeEvent.layout.y + nativeEvent.layout.height)
          }
        >
          <HeroCard view={view} />
        </View>
        {view.restDay ? (
          <EmptyState
            testID="today-rest"
            companion={emptyCompanion}
            title={t('today.rest.title')}
            message={t('today.rest.message')}
          />
        ) : view.totalCount === 0 ? (
          <EmptyState
            testID="today-empty"
            companion={emptyCompanion}
            title={t('today.empty.title')}
            message={t('today.empty.message')}
            actionLabel={t('today.empty.action')}
            onAction={() => router.push('/editor')}
          />
        ) : (
          <>
            <DayPlan view={view} tzOffset={tzOffset} actions={actions} menu={menu} />
            <TodayMissions view={view} tzOffset={tzOffset} actions={actions} menu={menu} />
          </>
        )}
      </ScrollView>
      {menu.sheets}
      {sticky ? <HeroStickyBar hero={view.hero} xpToNext={view.xpToNext} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 120 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
