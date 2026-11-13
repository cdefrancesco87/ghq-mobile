import { useRouter } from 'expo-router';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { archiveBoss } from '@/db/repositories/boss';
import type { BossView } from '@/db/repositories/bossView';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { announceOnIos } from '@/features/shared/announce';
import { Bar } from '@/features/shared/Bar';
import { BossSprite } from '@/features/shared/BossSprite';
import { Card } from '@/features/shared/Card';
import { CHIP_HEIGHT } from '@/features/shared/Chip';
import { CompletionControl, DoneMark } from '@/features/shared/CompletionControl';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { Difficulty } from '@/features/shared/Difficulty';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { categoryIcon, type IconName } from '@/features/shared/icons';
import { ProgressRing, ringStroke } from '@/features/shared/ProgressRing';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useUndoToast } from '@/features/shared/UndoToast';
import { useMissionActions } from '@/features/today/useMissionActions';
import { BOSS } from '@/rules/config';
import { diffDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';
import { useBossStep } from './useBossStep';
import { useShake } from './useShake';

/** 32×32 at 4× in the arena (design-sezioni.md 5.3); the ring of Minimal is as wide. */
const ARENA_SPRITE_SIZE = 128;
const ARENA_RING_SIZE = 160;
const ARENA_HEIGHT = 200;

export interface BossScreenProps {
  readonly view: BossView;
}

function InfoChip({
  icon,
  label,
  children,
  testID,
}: {
  readonly icon?: IconName;
  readonly label: string;
  readonly children?: ReactNode;
  readonly testID: string;
}) {
  const { colors, family } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={label} style={styles.chip}>
      <Frame shape={SHAPES[family].chip} fill="transparent" stroke={colors.textMuted} />
      {icon === undefined ? null : <Icon name={icon} size={16} color={colors.text} />}
      {children ?? <ThemedText variant="label">{label}</ThemedText>}
    </View>
  );
}

/**
 * The card of a boss (design-sezioni.md 5.3, 5.4, 5.9, 5.11; mockup B3b): the arena with the
 * sprite at 128 (in Minimal the large ring), name, bar with the protected part striped and its
 * note, chips of steps, deadline and difficulty; the steps with the day they were done and the
 * next one in evidence, each completed with a touch, a notice and «Annulla» (not the step that
 * wins: choice 25); the linked missions with their damage and the damage they dealt. «Altro» has
 * Archivia; Modifica, Nuova scadenza and Elimina come with T49. A defeated or archived boss is
 * only read: it is also the trophy until the Hall of trophies (T65).
 */
export function BossScreen({ view }: BossScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const actions = useMissionActions();
  const step = useBossStep(actions.completeStep, view);
  const { nameOf, stepTitleOf } = useBossTexts();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { boss } = view;
  const name = nameOf(boss);
  const active = boss.status === 'active';
  const hit = step.hitOf(boss.id);
  const shaking = useShake(hit);
  const hitLabel =
    hit === null
      ? null
      : t('bosses.sheet.hitLabel', { damage: hit.dealt, hp: hit.hp, max: boss.hpMax });

  // The hits are said aloud (5.11): on Android the live region of the number does it.
  useEffect(() => {
    if (hitLabel !== null) {
      announceOnIos(hitLabel);
    }
  }, [hitLabel]);

  const dayOf = (day: GameDay) => {
    const [, month, date] = day.split('-').map(Number);
    return { day: date, month: t(`shared.frequency.month.${month}`) };
  };
  const daysLeft = boss.deadlineDay === null ? null : diffDays(view.day, boss.deadlineDay);
  const near = daysLeft !== null && daysLeft <= BOSS.deadlineWarningDays;
  // A defeated or archived boss has no deadline any more.
  const deadline =
    daysLeft === null || !active
      ? null
      : daysLeft < 0
        ? t('bosses.card.overdue')
        : daysLeft === 0
          ? t('bosses.card.dueToday')
          : t('bosses.card.days', { count: daysLeft });
  const taken = boss.hpMax === 0 ? 0 : 1 - boss.hp / boss.hpMax;
  const status =
    view.defeatedDay !== null
      ? t('bosses.sheet.defeatedOn', dayOf(view.defeatedDay))
      : boss.status === 'archived'
        ? t('bosses.sheet.archived')
        : null;

  const archive = () => {
    setConfirm(false);
    try {
      runAction((db, clock) => archiveBoss(db, boss.id, clock));
    } catch {
      toast.show({ message: t('today.missions.errors.failed') });
      return;
    }
    toast.show({ message: t('bosses.sheet.archivedToast') });
    router.back();
  };

  return (
    <View testID="boss-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="boss-header"
        title={t('lexicon.boss', { context: family })}
        compact
        onBack={() => router.back()}
        actions={
          active ? (
            <Pressable
              testID="boss-more"
              accessibilityRole="button"
              accessibilityLabel={t('goals.more')}
              onPress={() => setMenu(true)}
              style={styles.more}
            >
              <Icon name="altro" color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView testID="boss-scroll" contentContainerStyle={styles.content}>
        <View
          testID="boss-arena"
          style={[styles.arena, { backgroundColor: colors.surfaceHigh }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={shaking}>
            {family === 'minimal' ? (
              <View testID="boss-ring" style={styles.ring}>
                <ProgressRing
                  progress={taken}
                  size={ARENA_RING_SIZE}
                  strokeWidth={ringStroke(family)}
                />
                <View style={styles.ringCenter}>
                  <Icon name="boss" size={24} color={colors.primary} />
                  <ThemedText variant="numbers">
                    {t('bosses.card.percent', { percent: Math.round(taken * 100) })}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <BossSprite
                kind={boss.kind === 'starter' ? 'quest' : boss.difficulty}
                size={ARENA_SPRITE_SIZE}
                testID="boss-sprite"
              />
            )}
          </Animated.View>
        </View>

        <View style={styles.block}>
          <ThemedText testID="boss-name" variant="screenTitle" accessibilityRole="header">
            {name}
          </ThemedText>
          {family === 'arcade' || family === 'cyberpunk' ? (
            // The steps as the stages of the boss, or its nodes (5.9; mockup B3b).
            <ThemedText variant="label" color={family === 'arcade' ? colors.primary : undefined}>
              {t('bosses.card.steps', {
                done: view.stepsDone,
                total: view.stepsTotal,
                context: family,
              })}
            </ThemedText>
          ) : null}
          {status === null ? null : (
            <ThemedText testID="boss-status" color={colors.textMuted}>
              {status}
            </ThemedText>
          )}
          <View style={styles.barRow}>
            <View style={styles.flex}>
              <Bar
                kind="boss"
                label={t('bosses.card.hpLabel', { name })}
                value={boss.hp}
                max={boss.hpMax}
                protectedValue={view.protectedHp}
                showLabel={false}
                testID="boss-hp"
              />
            </View>
            {hit === null ? null : (
              <ThemedText
                key={hit.key}
                testID="boss-damage"
                variant="numbers"
                color={colors.dangerText}
                accessibilityLabel={hitLabel ?? undefined}
                accessibilityLiveRegion="polite"
              >
                {t('bosses.card.damage', { damage: hit.dealt })}
              </ThemedText>
            )}
          </View>
          {view.protectedHp > 0 ? (
            // The striped part is also written, not only drawn (5.11).
            <ThemedText testID="boss-protected-note" variant="caption" color={colors.textMuted}>
              {t('bosses.sheet.protectedNote')}
            </ThemedText>
          ) : null}
          <View style={styles.chips}>
            <InfoChip
              testID="boss-chip-steps"
              icon="mappa"
              label={t('bosses.sheet.stepsChip', { done: view.stepsDone, total: view.stepsTotal })}
            />
            {deadline === null ? null : (
              <InfoChip
                testID="boss-chip-deadline"
                icon={near ? 'avviso' : 'calendario'}
                label={deadline}
              >
                <ThemedText variant="label" color={near ? colors.dangerText : colors.text}>
                  {deadline}
                </ThemedText>
              </InfoChip>
            )}
            {boss.kind === 'starter' ? null : (
              <InfoChip
                testID="boss-chip-difficulty"
                label={t('bosses.card.difficulty', {
                  difficulty: t(`shared.difficulty.${boss.difficulty}`),
                })}
              >
                <Difficulty difficulty={boss.difficulty} showWord={false} />
              </InfoChip>
            )}
          </View>
        </View>

        <View style={styles.sectionTitle}>
          <ThemedText variant="sectionTitle" accessibilityRole="header">
            {t('bosses.sheet.steps', { context: family })}
          </ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('bosses.sheet.stepsCount', { done: view.stepsDone, total: view.stepsTotal })}
          </ThemedText>
        </View>
        <Card testID="boss-steps" style={styles.inset}>
          {view.steps.map((item, index) => {
            const title = stepTitleOf(boss, item.title);
            const next = active && view.nextStep?.id === item.id;
            const id = `boss-step-${index}`;
            return (
              <Fragment key={item.id}>
                {index === 0 ? null : (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                )}
                <View
                  testID={id}
                  style={[styles.step, next ? { backgroundColor: colors.surfaceHigh } : null]}
                >
                  {item.doneDay !== null ? (
                    <DoneMark testID={`${id}-done`} />
                  ) : active ? (
                    <CompletionControl
                      testID={`${id}-control`}
                      accessibilityLabel={t('bosses.sheet.stepLabel', { step: title })}
                      onPress={() => step.completeStep(view, item.id)}
                    />
                  ) : (
                    <View style={styles.control} />
                  )}
                  <View
                    style={styles.flex}
                    accessible={item.doneDay !== null || !active}
                    accessibilityLabel={
                      item.doneDay === null
                        ? t('bosses.sheet.todoLabel', { step: title })
                        : t('bosses.sheet.doneLabel', { step: title, ...dayOf(item.doneDay) })
                    }
                  >
                    <ThemedText
                      variant={next ? 'label' : 'body'}
                      color={item.doneDay === null ? colors.text : colors.textMuted}
                      style={item.doneDay === null ? undefined : styles.struck}
                    >
                      {title}
                    </ThemedText>
                    {item.doneDay === null ? null : (
                      <ThemedText variant="caption" color={colors.textMuted}>
                        {t('bosses.sheet.doneOn', dayOf(item.doneDay))}
                      </ThemedText>
                    )}
                  </View>
                  {next ? (
                    <ThemedText testID={`${id}-next`} variant="label" color={colors.primary}>
                      {t('bosses.sheet.next')}
                    </ThemedText>
                  ) : null}
                </View>
              </Fragment>
            );
          })}
        </Card>

        {view.missions.length === 0 ? null : (
          <>
            <View style={styles.sectionTitle}>
              <ThemedText variant="sectionTitle" accessibilityRole="header">
                {t('goals.editor.missions')}
              </ThemedText>
            </View>
            <Card testID="boss-missions" style={styles.inset}>
              {view.missions.map((item, index) => {
                const damage = t('goals.editor.damage', { count: item.damage });
                const detail = t('bosses.sheet.missionDetail', { damage, dealt: item.dealt });
                return (
                  <Fragment key={item.mission.id}>
                    {index === 0 ? null : (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                    <Pressable
                      testID={`boss-mission-${item.mission.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('bosses.sheet.missionLabel', {
                        name: item.mission.name,
                        damage,
                        dealt: item.dealt,
                      })}
                      onPress={() =>
                        router.push({ pathname: '/stats', params: { missionId: item.mission.id } })
                      }
                      style={styles.mission}
                    >
                      <Icon
                        name={categoryIcon(item.mission.categoryKey)}
                        size={20}
                        color={colors.textMuted}
                      />
                      <View style={styles.flex}>
                        <ThemedText numberOfLines={2}>{item.mission.name}</ThemedText>
                        <ThemedText variant="caption" color={colors.textMuted}>
                          {detail}
                        </ThemedText>
                      </View>
                      <Icon name="avanti" size={20} color={colors.textMuted} />
                    </Pressable>
                  </Fragment>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
      <ActionSheet
        testID="boss-menu"
        visible={menu}
        onClose={() => setMenu(false)}
        items={[
          {
            key: 'archive',
            label: t('bosses.sheet.archive'),
            icon: <Icon name="archivio" size={20} color={colors.text} />,
            onPress: () => setConfirm(true),
          },
        ]}
      />
      <ConfirmDialog
        testID="boss-archive-dialog"
        visible={confirm}
        title={t('bosses.sheet.archiveTitle', { name })}
        message={t('bosses.sheet.archiveMessage')}
        confirmLabel={t('bosses.sheet.archive')}
        onConfirm={archive}
        onCancel={() => setConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingBottom: 48 },
  more: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  arena: { height: ARENA_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  block: { gap: 8, paddingHorizontal: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  step: { minHeight: MIN_TOUCH + 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  control: { width: MIN_TOUCH },
  struck: { textDecorationLine: 'line-through' },
  divider: { height: StyleSheet.hairlineWidth },
  inset: { marginHorizontal: 16 },
  mission: { minHeight: MIN_TOUCH + 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
