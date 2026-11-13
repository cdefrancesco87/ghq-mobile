import { useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createBoss, updateBoss } from '@/db/repositories/boss';
import {
  getBossEdit,
  listLinkableMissions,
  type BossEditView,
  type LinkableMission,
} from '@/db/repositories/goalsView';
import { gameDayOf, getSetting } from '@/db/repositories/settings';
import { ChoiceButton } from '@/features/editor/ChoiceButton';
import { DueDaySheet } from '@/features/editor/DueDaySheet';
import { OptionRow } from '@/features/editor/OptionRow';
import { BossSprite } from '@/features/shared/BossSprite';
import { useEssential } from '@/features/shared/useGameMode';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Icon } from '@/features/shared/Icon';
import { statIcon } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useLargeText } from '@/features/shared/useLargeText';
import { bossPreview, editedBossHp } from '@/rules/boss';
import { BOSS, BOSS_EDIT, STATS } from '@/rules/config';
import {
  DIFFICULTIES,
  STAT_KEYS,
  type Difficulty,
  type GameDay,
  type StatKey,
} from '@/rules/types';
import { runAction } from '@/stores/app';
import { getSession } from '@/stores/session';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';

const PREVIEW_SIZE = 64;
const FIELD_MIN_HEIGHT = 56;
const STAT_SIZE = 52;

interface Step {
  /** Stable while the steps move, for the keys of the rows. */
  readonly key: number;
  readonly title: string;
  /** The step of the boss being changed; none for a new step. */
  readonly id?: string;
  /** Its title when the change started: a done step left empty keeps it. */
  readonly original?: string;
  readonly done?: boolean;
}

export interface BossEditorProps {
  /** The active boss to change («Modifica», design-sezioni.md 5.3); a new boss when missing. */
  readonly bossId?: string;
}

function stepsOf(edit: BossEditView | null): Step[] {
  return (edit?.steps ?? []).map((step, index) => ({
    key: -(index + 1),
    title: step.title,
    id: step.id,
    original: step.title,
    done: step.done,
  }));
}

/**
 * The creation of a boss (design-sezioni.md 5.2, 5.9; mockup D21), in one screen at full height:
 * name, steps (Enter adds a step and keeps the field open; «Sposta su/giù» instead of the drag,
 * 5 di 20, at least 2), difficulty with its multiplier and the sprite in the preview, optional
 * deadline and stat, linked missions with their damage (moving one from another boss asks first),
 * then the bar with hit points and reward and the button in the lexicon of the theme.
 *
 * With `bossId` it is «Modifica» of an active boss (5.3; US-BOSS-01), in the same screen: name,
 * steps, deadline and linked missions. Provisional until CLAUDE.md choice 21 (BOSS_EDIT): the done
 * steps are renamed and moved but not taken away, a step to do must stay, and difficulty and stat
 * stay those of the creation, since they fix the reward and the points of a fight already started.
 */
export function BossEditor({ bossId }: BossEditorProps = {}) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const large = useLargeText();
  const { nameOf } = useBossTexts();
  const { top, bottom } = useSafeAreaInsets();
  const { db, clock } = getSession();
  // Read once: the screen keeps its own copy while the user changes it.
  const [edit] = useState(() => (bossId === undefined ? null : getBossEdit(db, bossId)));
  const editing = edit !== null;
  const [name, setName] = useState(edit?.boss.name ?? '');
  const [steps, setSteps] = useState<readonly Step[]>(() => stepsOf(edit));
  const [newStep, setNewStep] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(edit?.boss.difficulty ?? 'medium');
  const [deadline, setDeadline] = useState<GameDay | null>(edit?.boss.deadlineDay ?? null);
  const [stat, setStat] = useState<StatKey | null>(edit?.boss.statKey ?? null);
  const [linked, setLinked] = useState<ReadonlySet<string>>(() => new Set(edit?.missionIds));
  const [moving, setMoving] = useState<LinkableMission | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const nextKey = useRef(0);
  const stepField = useRef<ComponentRef<typeof TextInput>>(null);
  // Enter and the button, or two quick taps, would otherwise create two bosses.
  const saving = useRef(false);
  const missions = useMemo(() => listLinkableMissions(db), [db]);
  const today = useMemo(() => {
    const { now, tzOffset } = clock();
    return gameDayOf(now, tzOffset, getSetting(db, 'day_change'));
  }, [db, clock]);

  // A new step left empty goes away; a done one keeps the title it had.
  const kept = steps
    .map((step) => ({
      ...step,
      title: step.title.trim() === '' && step.done === true ? (step.original ?? '') : step.title,
    }))
    .filter((step) => step.title.trim() !== '');
  const titles = kept.map((step) => step.title.trim());
  const stepsLeft = kept.filter((step) => step.done !== true).length;
  const trimmed = name.trim();
  const preview = bossPreview(titles.length, difficulty);
  // The hit points after the change (provisional rule, BOSS_EDIT).
  const editedHp =
    edit === null || preview === null
      ? null
      : editedBossHp(
          {
            hp: edit.boss.hp,
            stepsLeft: edit.steps.filter((step) => !step.done).length,
          },
          stepsLeft,
          preview.hp,
        );
  const full = titles.length >= BOSS.maxSteps;
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const fieldStyle = [
    textStyleOf(typography.body),
    styles.field,
    { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
  ];
  const xpTerm = t('lexicon.xp_pl', { context: family });
  const coinsTerm = t('lexicon.coins_pl', { context: family });
  // Essential (5.10): a goal without sprite, health and coins; the experience stays.
  const essential = useEssential();
  const statName = (key: StatKey) => t(`stats.${key}`, { context: family });
  const missing =
    trimmed === ''
      ? t('goals.editor.nameMissing')
      : preview === null
        ? t('goals.editor.stepsMissing', { count: BOSS.minSteps })
        : editing && stepsLeft < BOSS_EDIT.minStepsLeft
          ? t('goals.editor.stepLeftMissing')
          : null;

  const changed = () => setFailed(false);

  const addStep = () => {
    const title = newStep.trim();
    if (title === '' || full) {
      return;
    }
    nextKey.current += 1;
    setSteps((current) => [...current, { key: nextKey.current, title }]);
    setNewStep('');
    changed();
  };

  const editStep = (key: number, title: string) => {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, title } : step)));
    changed();
  };

  const removeStep = (key: number) => {
    setSteps((current) => current.filter((step) => step.key !== key));
    changed();
  };

  const moveStep = (index: number, by: -1 | 1) => {
    setSteps((current) => {
      const target = index + by;
      if (target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // The boss being changed is not «another» boss for its own missions.
  const otherBoss = (item: LinkableMission) =>
    item.boss === null || item.boss.id === edit?.boss.id ? null : item.boss;

  const toggleMission = (item: LinkableMission) => {
    const { id } = item.mission;
    if (linked.has(id)) {
      setLinked((current) => new Set([...current].filter((other) => other !== id)));
      return;
    }
    if (otherBoss(item) !== null) {
      // A mission hits one boss at a time: choosing it here takes it away from the other one.
      setMoving(item);
      return;
    }
    setLinked((current) => new Set([...current, id]));
  };

  const save = () => {
    if (missing !== null || saving.current) {
      return;
    }
    saving.current = true;
    const missionIds = missions
      .filter((item) => linked.has(item.mission.id))
      .map((item) => item.mission.id);
    try {
      if (edit !== null) {
        // The archived missions are not in the list: they keep hitting the boss.
        const hidden = edit.missionIds.filter(
          (id) => !missions.some((item) => item.mission.id === id),
        );
        runAction((tx, actionClock) =>
          updateBoss(
            tx,
            edit.boss.id,
            {
              name: trimmed,
              steps: kept.map((step) => ({ id: step.id, title: step.title })),
              missionIds: [...missionIds, ...hidden],
              deadlineDay: deadline,
            },
            actionClock,
          ),
        );
      } else {
        runAction((tx, actionClock) =>
          createBoss(
            tx,
            {
              name: trimmed,
              difficulty,
              statKey: stat,
              deadlineDay: deadline,
              steps: titles,
              missionIds,
            },
            actionClock,
          ),
        );
      }
    } catch {
      saving.current = false;
      setFailed(true);
      return;
    }
    router.back();
  };

  const reward =
    preview === null
      ? null
      : essential
        ? t('essential.goalPreview', { xp: preview.xp, xpTerm })
        : t(editedHp === null ? 'goals.editor.preview' : 'goals.editor.editPreview', {
            hp: editedHp ?? preview.hp,
            max: preview.hp,
            xp: preview.xp,
            xpTerm,
            coins: preview.coins,
            coinsTerm,
          });

  if (bossId !== undefined && edit === null) {
    // The boss is no longer active: there is nothing to change.
    return null;
  }

  return (
    <KeyboardAvoidingView
      testID="goal-editor"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {/* At full height the header stays below the status bar. */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: top }]}>
        <Pressable
          testID="goal-editor-close"
          accessibilityRole="button"
          accessibilityLabel={t('goals.editor.close')}
          onPress={() => router.back()}
          style={styles.close}
        >
          <Icon name="chiudi" color={colors.text} />
        </Pressable>
        <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.title}>
          {editing ? t('goals.editor.editTitle') : t('goals.editor.title')}
        </ThemedText>
        <View style={styles.close} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.nameRow}>
          {/* Every theme has a boss for each difficulty: the preview changes with it (5.2). */}
          {essential ? null : (
            <BossSprite kind={difficulty} size={PREVIEW_SIZE} testID="goal-editor-sprite" />
          )}
          <TextInput
            testID="goal-editor-name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              changed();
            }}
            autoFocus={!editing}
            submitBehavior="submit"
            returnKeyType="next"
            onSubmitEditing={() => stepField.current?.focus()}
            placeholder={t('goals.editor.namePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('goals.editor.name')}
            style={[...fieldStyle, styles.flex]}
          />
        </View>
        <View style={styles.block}>
          <ThemedText testID="goal-editor-steps-count" variant="label" color={colors.textMuted}>
            {t('goals.editor.steps', { count: titles.length, max: BOSS.maxSteps })}
          </ThemedText>
          <Card>
            {steps.map((step, index) => (
              <View key={step.key} testID={`goal-editor-step-${index}`} style={styles.stepRow}>
                {step.done === true ? (
                  <Icon name="completa" size={20} color={colors.primary} />
                ) : (
                  <Icon name="trascina" size={20} color={colors.textMuted} />
                )}
                <TextInput
                  testID={`goal-editor-step-${index}-title`}
                  value={step.title}
                  onChangeText={(title) => editStep(step.key, title)}
                  accessibilityLabel={t(
                    step.done === true ? 'goals.editor.stepDoneLabel' : 'goals.editor.stepLabel',
                    { position: index + 1, total: steps.length },
                  )}
                  style={[textStyleOf(typography.body), styles.flex, { color: colors.text }]}
                />
                <Pressable
                  testID={`goal-editor-step-${index}-up`}
                  accessibilityRole="button"
                  accessibilityLabel={t('goals.editor.moveUp', { step: step.title })}
                  accessibilityState={{ disabled: index === 0 }}
                  disabled={index === 0}
                  onPress={() => moveStep(index, -1)}
                  style={styles.icon}
                >
                  <Icon
                    name="freccia-su"
                    size={20}
                    color={index === 0 ? colors.track : colors.textMuted}
                  />
                </Pressable>
                <Pressable
                  testID={`goal-editor-step-${index}-down`}
                  accessibilityRole="button"
                  accessibilityLabel={t('goals.editor.moveDown', { step: step.title })}
                  accessibilityState={{ disabled: index === steps.length - 1 }}
                  disabled={index === steps.length - 1}
                  onPress={() => moveStep(index, 1)}
                  style={styles.icon}
                >
                  <Icon
                    name="freccia-giu"
                    size={20}
                    color={index === steps.length - 1 ? colors.track : colors.textMuted}
                  />
                </Pressable>
                {step.done === true && !BOSS_EDIT.canRemoveDoneSteps ? (
                  // A done step stays (provisional, BOSS_EDIT): the place keeps the rows aligned.
                  <View style={styles.icon} />
                ) : (
                  <Pressable
                    testID={`goal-editor-step-${index}-remove`}
                    accessibilityRole="button"
                    accessibilityLabel={t('goals.editor.removeStep', { step: step.title })}
                    onPress={() => removeStep(step.key)}
                    style={styles.icon}
                  >
                    <Icon name="chiudi" size={20} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
            {full ? (
              <ThemedText
                testID="goal-editor-steps-full"
                variant="caption"
                color={colors.textMuted}
              >
                {t('goals.editor.stepsFull', { max: BOSS.maxSteps })}
              </ThemedText>
            ) : (
              <TextInput
                ref={stepField}
                testID="goal-editor-new-step"
                value={newStep}
                onChangeText={setNewStep}
                // Enter adds the step and the field stays open for the next one (5.2).
                submitBehavior="submit"
                returnKeyType="next"
                onSubmitEditing={addStep}
                placeholder={t('goals.editor.addStep')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('goals.editor.addStep')}
                style={[textStyleOf(typography.body), styles.newStep, { color: colors.text }]}
              />
            )}
          </Card>
          {titles.length < BOSS.minSteps ? (
            <ThemedText testID="goal-editor-steps-min" variant="caption" color={colors.textMuted}>
              {t('goals.editor.stepsMissing', { count: BOSS.minSteps })}
            </ThemedText>
          ) : editing && stepsLeft < BOSS_EDIT.minStepsLeft ? (
            <ThemedText testID="goal-editor-steps-left" variant="caption" color={colors.textMuted}>
              {t('goals.editor.stepLeftMissing')}
            </ThemedText>
          ) : null}
        </View>
        {editing ? null : (
          <View style={styles.block}>
            <ThemedText variant="label" color={colors.textMuted}>
              {t('editor.difficulty')}
            </ThemedText>
            <View
              testID="goal-editor-difficulty"
              accessibilityRole="radiogroup"
              accessibilityLabel={t('editor.difficulty')}
              style={large ? styles.column : styles.row}
            >
              {DIFFICULTIES.map((level, index) => {
                const label = t(`shared.difficulty.${level}`);
                const multiplier = t('goals.editor.multiplier', {
                  value: BOSS.difficultyMultiplier[level],
                });
                return (
                  <ChoiceButton
                    key={level}
                    testID={`goal-editor-difficulty-${level}`}
                    selected={level === difficulty}
                    onPress={() => {
                      setDifficulty(level);
                      changed();
                    }}
                    accessibilityLabel={t('goals.editor.difficultyLabel', {
                      name: label,
                      multiplier,
                      position: index + 1,
                      total: DIFFICULTIES.length,
                    })}
                    style={[styles.difficulty, large ? undefined : styles.flex]}
                  >
                    {(color) => (
                      <View style={styles.choice}>
                        <ThemedText variant="label" color={color}>
                          {label}
                        </ThemedText>
                        <ThemedText variant="caption" color={color}>
                          {multiplier}
                        </ThemedText>
                      </View>
                    )}
                  </ChoiceButton>
                );
              })}
            </View>
          </View>
        )}
        <Card>
          <OptionRow
            testID="goal-editor-deadline"
            icon="calendario"
            label={t('goals.editor.deadline')}
            value={describeFrequency(null, t, deadline)}
            onPress={() => setDeadlineOpen(true)}
          />
        </Card>
        {editing ? null : (
          <View style={styles.block}>
            <ThemedText variant="label" color={colors.textMuted}>
              {stat === null
                ? t('goals.editor.stat')
                : t('goals.editor.statChosen', { stat: statName(stat) })}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t('goals.editor.stat')}
                style={styles.row}
              >
                {STAT_KEYS.map((key, index) => (
                  <ChoiceButton
                    key={key}
                    testID={`goal-editor-stat-${key}`}
                    selected={key === stat}
                    // The stat is optional: a second tap takes it away.
                    onPress={() => {
                      setStat((current) => (current === key ? null : key));
                      changed();
                    }}
                    accessibilityLabel={t('editor.statLabel', {
                      stat: statName(key),
                      position: index + 1,
                      total: STAT_KEYS.length,
                    })}
                    style={styles.stat}
                  >
                    {(color) => <Icon name={statIcon(key)} size={20} color={color} />}
                  </ChoiceButton>
                ))}
              </View>
            </ScrollView>
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('goals.editor.statNote', { points: STATS.bossStepPoints })}
            </ThemedText>
          </View>
        )}
        <View style={styles.block}>
          <ThemedText variant="label" color={colors.textMuted}>
            {t('goals.editor.missions')}
          </ThemedText>
          {missions.length === 0 ? (
            <ThemedText testID="goal-editor-missions-empty" color={colors.textMuted}>
              {t('goals.editor.noMissions')}
            </ThemedText>
          ) : (
            <Card>
              {missions.map((item) => {
                const checked = linked.has(item.mission.id);
                const damage = t('goals.editor.damage', { count: item.damage });
                const hit = otherBoss(item);
                const other = hit === null ? null : nameOf(hit);
                return (
                  <Pressable
                    key={item.mission.id}
                    testID={`goal-editor-mission-${item.mission.id}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={[
                      item.mission.name,
                      damage,
                      other === null ? null : t('goals.editor.linkedTo', { boss: other }),
                    ]
                      .filter((part) => part !== null)
                      .join(', ')}
                    onPress={() => toggleMission(item)}
                    style={styles.mission}
                  >
                    <Icon
                      name={checked ? 'completa' : 'aggiungi'}
                      size={20}
                      color={checked ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.flex}>
                      <ThemedText>{item.mission.name}</ThemedText>
                      {other === null || checked ? null : (
                        <ThemedText variant="caption" color={colors.textMuted}>
                          {t('goals.editor.linkedTo', { boss: other })}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText variant="caption" color={colors.textMuted}>
                      {damage}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </Card>
          )}
        </View>
        {failed ? (
          <ThemedText testID="goal-editor-error" color={colors.dangerText}>
            {t('today.missions.errors.failed')}
          </ThemedText>
        ) : null}
      </ScrollView>
      <View
        testID="goal-editor-bar"
        style={[styles.bar, { borderTopColor: colors.border, paddingBottom: Math.max(bottom, 16) }]}
      >
        <View style={styles.flex} accessible>
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('editor.reward')}
          </ThemedText>
          <ThemedText testID="goal-editor-preview" variant="numbers">
            {reward ?? t('goals.editor.stepsMissing', { count: BOSS.minSteps })}
          </ThemedText>
        </View>
        <Button
          testID="goal-editor-save"
          label={editing ? t('editor.save') : t('goals.editor.create', { context: family })}
          onPress={save}
          disabled={missing !== null}
          disabledReason={missing ?? undefined}
        />
      </View>
      <DueDaySheet
        visible={deadlineOpen}
        value={deadline}
        today={today}
        onClose={() => setDeadlineOpen(false)}
        onDone={(day) => {
          setDeadline(day);
          setDeadlineOpen(false);
          changed();
        }}
      />
      <ConfirmDialog
        testID="goal-editor-move"
        visible={moving !== null}
        title={t('goals.editor.moveTitle', { mission: moving?.mission.name ?? '' })}
        message={t('goals.editor.moveMessage', {
          boss: moving?.boss === null || moving === null ? '' : nameOf(moving.boss),
        })}
        confirmLabel={t('goals.editor.moveConfirm')}
        onCancel={() => setMoving(null)}
        onConfirm={() => {
          if (moving !== null) {
            const { id } = moving.mission;
            setLinked((current) => new Set([...current, id]));
          }
          setMoving(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center' },
  content: { gap: 16, padding: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { minHeight: FIELD_MIN_HEIGHT, borderWidth: 1, paddingHorizontal: 16 },
  block: { gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: MIN_TOUCH },
  icon: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  newStep: { minHeight: MIN_TOUCH },
  row: { flexDirection: 'row', gap: 8 },
  column: { gap: 8 },
  flex: { flex: 1 },
  difficulty: { paddingVertical: 8 },
  choice: { alignItems: 'center' },
  stat: { width: STAT_SIZE, paddingHorizontal: 0 },
  mission: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
