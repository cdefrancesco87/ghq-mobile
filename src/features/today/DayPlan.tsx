import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { MissionRow } from '@/features/shared/MissionRow';
import { Sprite } from '@/features/shared/Sprite';
import { sealSpriteKey } from '@/features/shared/sprites';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { DAY_PLAN } from '@/rules/config';
import { canAddToPlan, isPlanComplete } from '@/rules/day';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { missionIcon, originOf, useMissionTexts } from './missionText';
import { SkipSwipe } from './SkipSwipe';
import type { MissionActions } from './useMissionActions';
import type { MissionMenu } from './useMissionMenu';

const SLOT_HEIGHT = 56;
const SEAL_SIZE = 32;

export interface DayPlanProps {
  readonly view: TodayView;
  readonly tzOffset: number;
  readonly actions: MissionActions;
  readonly menu: MissionMenu;
}

/**
 * Piano del giorno (design-sezioni.md 2.3, mockup B2): the priorities numbered 1–3, the empty
 * place that opens «Scegli una priorità», the seal with the bonus once they are all done.
 */
export function DayPlan({ view, tzOffset, actions, menu }: DayPlanProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { detailOf, warningOf, doneTimeOf } = useMissionTexts(view.day, tzOffset);

  // «Salta oggi» takes a priority out of the plan (T59): the filter only guards older days.
  const priorities = view.plan
    .map((id) => view.missions.find((item) => item.mission.id === id))
    .filter((item): item is TodayMission => item !== undefined && item.state !== 'skipped');
  const complete =
    view.planBonus &&
    isPlanComplete(
      view.plan,
      view.missions.filter((item) => item.state === 'done').map((item) => item.mission.id),
    );
  const xpTerm = t('lexicon.xp_pl', { context: family });
  const shape = SHAPES[family].card;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const separator = <View style={[styles.separator, { backgroundColor: colors.border }]} />;

  return (
    <View testID="today-plan" style={styles.section}>
      <View style={styles.heading}>
        <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.flex}>
          {t('lexicon.dayPlan', { context: family })}
        </ThemedText>
        <ThemedText
          testID="today-plan-count"
          variant="caption"
          color={colors.textMuted}
          accessibilityLabel={t('today.plan.countLabel', {
            count: priorities.length,
            max: DAY_PLAN.maxPriorities,
          })}
        >
          {t('today.plan.count', { count: priorities.length, max: DAY_PLAN.maxPriorities })}
        </ThemedText>
      </View>
      {priorities.length === 0 ? (
        <ThemedText testID="today-plan-intro" color={colors.textMuted}>
          {t('today.plan.intro', { max: DAY_PLAN.maxPriorities, xp: DAY_PLAN.bonusXp, xpTerm })}
        </ThemedText>
      ) : (
        <Card>
          {priorities.map((item, index) => {
            const { mission } = item;
            const testID = `today-plan-${mission.id}`;
            const common = {
              testID,
              name: mission.name,
              difficulty: mission.difficulty,
              detail: detailOf(item),
              onPress: () => menu.openDetail(item),
              onLongPress: () => menu.open(item),
              actions: menu.rowActions(item),
            };
            const target = mission.goalTarget;
            const measurable = mission.goalType !== 'none' && target !== null && target > 0;
            return (
              <Fragment key={mission.id}>
                {index === 0 ? null : separator}
                {item.state === 'done' ? (
                  <MissionRow
                    {...common}
                    variant="done"
                    icon={missionIcon(mission)}
                    doneTime={doneTimeOf(item)}
                  />
                ) : (
                  <SkipSwipe testID={`${testID}-swipe`} onSkip={() => menu.openSkip(item)}>
                    <MissionRow
                      {...common}
                      variant="priority"
                      position={(index + 1) as 1 | 2 | 3}
                      warning={warningOf(item)}
                      xp={item.xp}
                      progress={measurable ? Math.min((item.value ?? 0) / target, 1) : undefined}
                      onComplete={(event) => actions.complete(item, originOf(event))}
                      onControlLongPress={
                        mission.goalType === 'quantity' ? () => menu.openValue(item) : undefined
                      }
                    />
                  </SkipSwipe>
                )}
              </Fragment>
            );
          })}
        </Card>
      )}
      {complete ? (
        <View
          testID="today-plan-seal"
          accessible
          accessibilityLabel={t('today.plan.sealLabel', { xp: DAY_PLAN.bonusXp, xpTerm })}
          style={styles.seal}
        >
          <Sprite spriteKey={sealSpriteKey(family)} size={SEAL_SIZE} label="" />
          <ThemedText variant="numbers" color={colors.text}>
            {`+${DAY_PLAN.bonusXp} ${xpTerm}`}
          </ThemedText>
        </View>
      ) : canAddToPlan(view.plan) ? (
        <Pressable
          testID="today-plan-add"
          accessibilityRole="button"
          accessibilityLabel={t('today.plan.add')}
          onPress={menu.openPicker}
          style={[styles.slot, { borderColor: colors.border, borderRadius: radius }]}
        >
          <Icon name="aggiungi" size={20} color={colors.textMuted} />
          <ThemedText color={colors.text}>{t('today.plan.add')}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  slot: {
    minHeight: Math.max(SLOT_HEIGHT, MIN_TOUCH),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  seal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
