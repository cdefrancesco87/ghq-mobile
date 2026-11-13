import { useFocusEffect, useRouter } from 'expo-router';
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
import { useMomentQueue } from '@/features/shared/MomentQueue';
import { ThemedText } from '@/features/shared/ThemedText';
import { useEssential } from '@/features/shared/useGameMode';
import { hitSlopFor } from '@/features/shared/touch';
import { companionName } from '@/rules/companion';
import { RecentNotificationsSheet } from '@/features/notifications/RecentNotificationsSheet';
import { useTheme } from '@/theme/ThemeProvider';
import { DayPlan } from './DayPlan';
import { HeroCard } from './HeroCard';
import { HeroStickyBar } from './HeroStickyBar';
import { MorningTale, useMorningTale } from './MorningTale';
import { PauseBanner } from './PauseBanner';
import { TodayHeader } from './TodayHeader';
import { TodayBosses } from './TodayBosses';
import { TodayMissions } from './TodayMissions';
import { useMissionActions } from './useMissionActions';
import { useMissionMenu } from './useMissionMenu';

const EMPTY_COMPANION_SIZE = 128;
const CLOSE_ICON = 20;
const NOTICE_COMPANION_SIZE = 32;

export interface TodayScreenProps {
  readonly view: TodayView;
  /** Minutes east of UTC of the phone, for the times of completion. */
  readonly tzOffset: number;
  /** Today opened to show the unseen notifications («Notifiche recenti», design 12.1). */
  readonly recentRequested?: boolean;
  /** Called once that request is handled. */
  readonly onRecentHandled?: () => void;
}

const NOTHING = () => undefined;

/**
 * Today (design-sezioni.md 2.1–2.5, 2.8): date and greeting, the band of the general pause, the
 * notices of the shield, of the
 * missions back from a pause (3.6) and of the companion grown up (6.6), the hero
 * card, the morning bubble of the companion (6.14), the plan of the day, the bosses and the missions of today, or the empty states.
 */
export function TodayScreen({
  view,
  tzOffset,
  recentRequested = false,
  onRecentHandled = NOTHING,
}: TodayScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  // Bottom edge of the hero card in the scroll: past it the thin bar takes its place.
  const [heroBottom, setHeroBottom] = useState<number | null>(null);
  const [sticky, setSticky] = useState(false);
  const [shieldClosed, setShieldClosed] = useState(false);
  const [resumedClosed, setResumedClosed] = useState(false);
  const [grownClosed, setGrownClosed] = useState(false);
  // The companion's tip goes away at the first completion or at a touch elsewhere (design 1.7).
  const [hintClosed, setHintClosed] = useState(false);
  const hint = view.companion.stage === 'egg' && !hintClosed;
  const resumed = view.notices.resumedMissions;
  const actions = useMissionActions();
  const essential = useEssential();
  // The victory of the quest of the first launch, won in Statistiche, shows back here (1.8).
  const { showWaiting } = useMomentQueue();
  useFocusEffect(showWaiting);
  const menu = useMissionMenu(view, actions);
  const tale = useMorningTale(view);
  // Skipped missions are out of the counters but still listed among the done ones.
  const working = !view.restDay && view.missions.length > 0;

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
    <View
      testID="today-screen"
      onTouchStart={hint ? () => setHintClosed(true) : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
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
        <PauseBanner pause={view.pause} />
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
        {resumed.length > 0 && !resumedClosed ? (
          <Card testID="today-notice-resumed">
            <View style={styles.notice}>
              <Icon name="play" size={20} color={colors.infoText} />
              <ThemedText style={styles.flex}>
                {t('today.notices.resumed', {
                  count: resumed.length,
                  names: resumed.map((mission) => mission.name).join(', '),
                })}
              </ThemedText>
              <Pressable
                testID="today-notice-resumed-close"
                accessibilityRole="button"
                accessibilityLabel={t('shared.close')}
                onPress={() => setResumedClosed(true)}
                hitSlop={hitSlopFor(CLOSE_ICON)}
              >
                <Icon name="chiudi" size={CLOSE_ICON} color={colors.textMuted} />
              </Pressable>
            </View>
          </Card>
        ) : null}
        {view.notices.companionGrewTo === 'adult' && !grownClosed ? (
          <Card testID="today-notice-grown">
            <View style={styles.notice}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <CompanionSprite stage="adult" mood="happy" size={NOTICE_COMPANION_SIZE} />
              </View>
              <ThemedText style={styles.flex}>
                {t('today.notices.grownUp', {
                  name: companionName(
                    view.companion.name,
                    t('lexicon.companion', { context: family }),
                  ),
                })}
              </ThemedText>
              <Pressable
                testID="today-notice-grown-close"
                accessibilityRole="button"
                accessibilityLabel={t('shared.close')}
                onPress={() => setGrownClosed(true)}
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
        {/* The morning bubble of the companion, under the hero and before the plan (6.14). */}
        {tale.bubble === null ? null : (
          <MorningTale view={view} bubble={tale.bubble} onClose={tale.close} />
        )}
        {/* The plan comes before the boss (2.1); the bosses stay also on a day without missions. */}
        {working ? <DayPlan view={view} tzOffset={tzOffset} actions={actions} menu={menu} /> : null}
        <TodayBosses view={view} actions={actions} />
        {view.restDay ? (
          <EmptyState
            testID="today-rest"
            companion={emptyCompanion}
            title={t('today.rest.title')}
            message={t('today.rest.message')}
          />
        ) : view.missions.length === 0 ? (
          <EmptyState
            testID="today-empty"
            companion={emptyCompanion}
            title={t('today.empty.title')}
            message={t('today.empty.message')}
            actionLabel={t('today.empty.action')}
            onAction={() => router.push('/editor')}
          />
        ) : (
          <TodayMissions
            view={view}
            tzOffset={tzOffset}
            actions={actions}
            menu={menu}
            hint={hint}
          />
        )}
      </ScrollView>
      {menu.sheets}
      <RecentNotificationsSheet
        view={view}
        actions={actions}
        requested={recentRequested}
        onHandled={onRecentHandled}
      />
      {/* The thin bar holds health and experience: none in the Essential mode (2.10). */}
      {sticky && !essential ? <HeroStickyBar hero={view.hero} xpToNext={view.xpToNext} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 120 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
