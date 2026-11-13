import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import type { BossProgress } from '@/db/repositories/boss';
import { Bar } from '@/features/shared/Bar';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { CompletionControl } from '@/features/shared/CompletionControl';
import { Icon } from '@/features/shared/Icon';
import { ProgressRing, ringStroke } from '@/features/shared/ProgressRing';
import { ThemedText } from '@/features/shared/ThemedText';
import { useEssential } from '@/features/shared/useGameMode';
import { BOSS } from '@/rules/config';
import { diffDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';
import { useShake } from './useShake';

/** 16×16 at 3× in the compact card (design-sezioni.md 2.4), 32×32 at 3× in Obiettivi (5.1). */
const SPRITE_SIZE = { compact: 48, large: 96 } as const;

/** The last hit on the boss: `key` changes at every hit, so the same damage shakes again. */
export interface BossHit {
  readonly dealt: number;
  /** Hit points left right after the hit, for the sentence said aloud (5.11). */
  readonly hp: number;
  readonly key: number;
}

export interface BossCardProps {
  readonly item: BossProgress;
  /** Compact in Today (2.4), large in Obiettivi (5.1). */
  readonly variant?: 'compact' | 'large';
  readonly day: GameDay;
  readonly onCompleteStep: (event: GestureResponderEvent) => void;
  /** A touch on the card opens the card of the boss (design-sezioni.md 5.3). */
  readonly onOpen: () => void;
  readonly hit: BossHit | null;
  /** The general pause holds the deadline: «Scadenza ferma» instead of the days (design 2.8). */
  readonly held?: boolean;
  readonly testID: string;
}

/**
 * The card of a boss (design-sezioni.md 2.4, 5.1, 5.4; mockups B2, B3a): sprite, name, days to the
 * deadline, the bar with its number, the steps done and the next step with its control. A hit
 * shakes the sprite (not with «Riduci movimento») and shows the damage. The large card of
 * Obiettivi has the sprite at 96, in Minimal a large ring with the share of the hit points taken
 * (5.9), the steps in the words of the theme and one sentence for the screen reader (5.11). A
 * touch on the card, outside the control of the step, opens the card of the boss. In the Essential
 * mode it is a goal divided in steps (5.10): no sprite, health or damage, a bar of the steps done.
 */
export function BossCard({
  item,
  variant = 'compact',
  day,
  onCompleteStep,
  onOpen,
  hit,
  held = false,
  testID,
}: BossCardProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf, stepTitleOf } = useBossTexts();
  const { boss } = item;
  const name = nameOf(boss);
  const shaking = useShake(hit);
  const essential = useEssential();

  const daysLeft = boss.deadlineDay === null ? null : diffDays(day, boss.deadlineDay);
  const near = !held && daysLeft !== null && daysLeft <= BOSS.deadlineWarningDays;
  const deadline =
    daysLeft === null
      ? null
      : held
        ? t('bosses.card.held')
        : daysLeft < 0
          ? t('bosses.card.overdue')
          : daysLeft === 0
            ? t('bosses.card.dueToday')
            : // From 3 days before, «Mancano 3 giorni» in the colour of danger (5.6).
              t(near ? 'bosses.card.daysLeft' : 'bosses.card.days', { count: daysLeft });
  const large = variant === 'large';
  const size = SPRITE_SIZE[variant];
  const kind = boss.kind === 'starter' ? 'quest' : boss.difficulty;
  const taken = boss.hpMax === 0 ? 0 : 1 - boss.hp / boss.hpMax;
  const steps = t('bosses.card.steps', {
    done: item.stepsDone,
    total: item.stepsTotal,
    context: large && !essential ? family : undefined,
  });
  const summary = [
    name,
    boss.kind === 'starter' || essential
      ? null
      : t('bosses.card.difficulty', { difficulty: t(`shared.difficulty.${boss.difficulty}`) }),
    essential ? null : t('bosses.card.hpSummary', { hp: boss.hp, max: boss.hpMax }),
    t('bosses.card.stepsSummary', { done: item.stepsDone, total: item.stepsTotal }),
    deadline,
  ]
    .filter((part) => part !== null)
    .join(', ');

  return (
    <Card testID={testID}>
      <Pressable
        testID={`${testID}-open`}
        style={styles.top}
        onPress={onOpen}
        // The card is read in one sentence (5.11); the step keeps its own control.
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityHint={t('bosses.card.openHint')}
      >
        {essential ? null : (
          <Animated.View style={shaking}>
            {large && family === 'minimal' ? (
              <View testID={`${testID}-ring`} style={[styles.ring, { width: size, height: size }]}>
                <ProgressRing progress={taken} size={size} strokeWidth={ringStroke(family)} />
                <View style={styles.ringCenter}>
                  <Icon name="boss" size={24} color={colors.primary} />
                  <ThemedText variant="numbers">
                    {t('bosses.card.percent', { percent: Math.round(taken * 100) })}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <BossSprite kind={kind} size={size} testID={`${testID}-sprite`} />
            )}
          </Animated.View>
        )}
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
                  name={near ? 'avviso' : held ? 'pausa' : 'calendario'}
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
              {essential ? (
                <Bar
                  kind="xp"
                  label={t('essential.stepsLabel', { name })}
                  value={item.stepsDone}
                  max={item.stepsTotal}
                  showLabel={false}
                  testID={`${testID}-progress`}
                />
              ) : (
                <Bar
                  kind="boss"
                  label={t('bosses.card.hpLabel', { name })}
                  value={boss.hp}
                  max={boss.hpMax}
                  showLabel={false}
                  testID={`${testID}-hp`}
                />
              )}
            </View>
            {hit === null || essential ? null : (
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
          <ThemedText
            testID={`${testID}-steps`}
            variant={large ? 'label' : 'caption'}
            // Arcade shows the steps as the stages of the boss, in the main colour (mockup B3a).
            color={large && family === 'arcade' && !essential ? colors.primary : colors.textMuted}
          >
            {steps}
          </ThemedText>
        </View>
      </Pressable>
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
  ring: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
