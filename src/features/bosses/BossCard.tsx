import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { TodayBoss } from '@/db/repositories/todayView';
import { Bar } from '@/features/shared/Bar';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { CompletionControl } from '@/features/shared/CompletionControl';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { BOSS } from '@/rules/config';
import { diffDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';

/** 16×16 at 3× in the compact card (design-sezioni.md 2.4). */
const SPRITE_SIZE = 48;
const SHAKE = 4;
const SHAKE_STEP_MS = 50;

/** The last hit on the boss: `key` changes at every hit, so the same damage shakes again. */
export interface BossHit {
  readonly dealt: number;
  readonly key: number;
}

export interface BossCardProps {
  readonly item: TodayBoss;
  readonly day: GameDay;
  readonly onCompleteStep: (event: GestureResponderEvent) => void;
  readonly hit: BossHit | null;
  readonly testID: string;
}

/**
 * The compact card of a boss in Today (design-sezioni.md 2.4, 5.4; mockup B2): sprite, name,
 * days to the deadline, the bar with its number, the steps done and the next step with its
 * control. A hit shakes the sprite (not with «Riduci movimento») and shows the damage.
 */
export function BossCard({ item, day, onCompleteStep, hit, testID }: BossCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { nameOf, stepTitleOf } = useBossTexts();
  const { boss } = item;
  const name = nameOf(boss);
  const shake = useSharedValue(0);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  useEffect(() => {
    if (hit === null || reduceMotion) {
      return;
    }
    const step = { duration: SHAKE_STEP_MS };
    shake.set(
      withSequence(
        withTiming(SHAKE, step),
        withTiming(-SHAKE, step),
        withTiming(SHAKE, step),
        withTiming(0, step),
      ),
    );
  }, [hit, reduceMotion, shake]);

  const daysLeft = boss.deadlineDay === null ? null : diffDays(day, boss.deadlineDay);
  const near = daysLeft !== null && daysLeft <= BOSS.deadlineWarningDays;
  const deadline =
    daysLeft === null
      ? null
      : daysLeft < 0
        ? t('bosses.card.overdue')
        : daysLeft === 0
          ? t('bosses.card.dueToday')
          : t('bosses.card.days', { count: daysLeft });

  return (
    <Card testID={testID}>
      <View style={styles.top}>
        <Animated.View style={shaking}>
          <BossSprite
            kind={boss.kind === 'starter' ? 'quest' : boss.difficulty}
            size={SPRITE_SIZE}
            testID={`${testID}-sprite`}
          />
        </Animated.View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <ThemedText
              testID={`${testID}-name`}
              variant="label"
              numberOfLines={2}
              style={styles.flex}
            >
              {name}
            </ThemedText>
            {deadline === null ? null : (
              <View testID={`${testID}-deadline`} style={styles.deadline}>
                <Icon
                  name={near ? 'avviso' : 'calendario'}
                  size={16}
                  color={near ? colors.dangerText : colors.textMuted}
                />
                <ThemedText variant="caption" color={near ? colors.dangerText : colors.textMuted}>
                  {deadline}
                </ThemedText>
              </View>
            )}
          </View>
          <View style={styles.barRow}>
            <View style={styles.flex}>
              <Bar
                kind="boss"
                label={t('bosses.card.hpLabel', { name })}
                value={boss.hp}
                max={boss.hpMax}
                showLabel={false}
                testID={`${testID}-hp`}
              />
            </View>
            {hit === null ? null : (
              <ThemedText
                key={hit.key}
                testID={`${testID}-damage`}
                variant="numbers"
                color={colors.dangerText}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {t('bosses.card.damage', { damage: hit.dealt })}
              </ThemedText>
            )}
          </View>
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('bosses.card.steps', { done: item.stepsDone, total: item.stepsTotal })}
          </ThemedText>
        </View>
      </View>
      {item.nextStep === null ? null : (
        <>
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
          <View style={styles.next}>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('bosses.card.nextStep')}
            </ThemedText>
            <ThemedText testID={`${testID}-next`} style={styles.flex} numberOfLines={2}>
              {stepTitleOf(boss, item.nextStep.title)}
            </ThemedText>
            <CompletionControl
              testID={`${testID}-step`}
              accessibilityLabel={t('bosses.card.stepLabel', {
                step: stepTitleOf(boss, item.nextStep.title),
                name,
              })}
              onPress={onCompleteStep}
            />
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
