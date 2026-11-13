import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { formatAmount, unitName } from '@/features/shared/amount';
import { Button } from '@/features/shared/Button';
import { Chip } from '@/features/shared/Chip';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MEASURABLE, TIMER } from '@/rules/config';
import { healthUnit } from '@/rules/health';
import { parseAmount, suggestIncrement } from '@/rules/measurable';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Counter } from './Counter';
import { goalOf, NO_GOAL, type GoalDraft } from './draft';
import { HealthLink } from './HealthLink';

const UNIT_KEYS: readonly string[] = MEASURABLE.units;
const WHOLE_UNITS: readonly string[] = MEASURABLE.wholeUnits;

/** The increment proposed for a target, as text; empty while the target is not a number. */
function proposed(target: string, unit: string): string {
  const value = parseAmount(target);
  const step = value === null ? null : suggestIncrement(value, WHOLE_UNITS.includes(unit));
  return step === null ? '' : String(step);
}

export interface GoalFieldProps {
  readonly value: GoalDraft;
  readonly onChange: (goal: GoalDraft) => void;
}

/** A duration goal of `minutes`: the increment is not shown, it follows the minutes (T79). */
function durationGoal(minutes: number): GoalDraft {
  return {
    ...NO_GOAL,
    type: 'duration',
    target: String(minutes),
    increment: String(suggestIncrement(minutes, true) ?? 1),
  };
}

/**
 * «Obiettivo misurabile» (design-sezioni.md 4.7, mockup D15): Sì/No, Quantità, with the value,
 * the unit from the chips or typed, and the increment of one tap, proposed from the target until
 * the user changes it, or Durata, with the minutes from the chips or the counter (T79).
 */
export function GoalField({ value, onChange }: GoalFieldProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  // A saved increment is the user's: it is not proposed again when the target changes.
  const [incrementTouched, setIncrementTouched] = useState(value.increment !== '');
  const [custom, setCustom] = useState(value.type !== 'none' && !UNIT_KEYS.includes(value.unit));
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const input = [
    textStyleOf(typography.body),
    styles.input,
    { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
  ];

  const change = (changes: Partial<GoalDraft>) => {
    const next = { ...value, ...changes };
    onChange(incrementTouched ? next : { ...next, increment: proposed(next.target, next.unit) });
  };

  const target = parseAmount(value.target);
  const increment = parseAmount(value.increment);
  const quantity = value.type === 'quantity';
  const unitMissing = quantity && value.unit.trim() === '';
  // A linked mission counts in the unit of its metric (design 12.7).
  const linked = value.healthMetric !== null;

  return (
    <View testID="editor-goal" style={styles.field}>
      <SegmentedControl
        testID="editor-goal-type"
        accessibilityLabel={t('editor.goal.title')}
        value={value.type}
        onChange={(type) => {
          if (type === value.type) {
            return;
          }
          if (type === 'none' || type === 'duration' || value.type === 'duration') {
            // A new kind of goal starts from its own proposals.
            setIncrementTouched(false);
            setCustom(false);
          }
          if (type === 'none') {
            onChange(NO_GOAL);
          } else if (type === 'duration') {
            onChange(durationGoal(TIMER.initialMinutes));
          } else if (value.type === 'duration') {
            onChange({ ...NO_GOAL, type });
          } else {
            change({ type });
          }
        }}
        options={[
          { value: 'none', label: t('editor.goal.yesNo') },
          { value: 'quantity', label: t('editor.goal.quantity') },
          { value: 'duration', label: t('editor.goal.duration') },
        ]}
      />
      {value.type === 'duration' ? <DurationField value={value} onChange={onChange} /> : null}
      {quantity ? (
        <>
          <ThemedText variant="label" color={colors.textMuted}>
            {t('editor.goal.target')}
          </ThemedText>
          <TextInput
            testID="editor-goal-target"
            value={value.target}
            onChangeText={(text) => change({ target: text })}
            keyboardType="decimal-pad"
            placeholder={t('editor.goal.targetPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('editor.goal.target')}
            style={input}
          />
          <ThemedText variant="label" color={colors.textMuted}>
            {t('editor.goal.unit')}
          </ThemedText>
          {linked ? (
            <ThemedText testID="editor-goal-unit-linked" color={colors.text}>
              {unitName(value.unit, i18n.language)}
            </ThemedText>
          ) : (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {UNIT_KEYS.map((key) => (
                <Chip
                  key={key}
                  testID={`editor-goal-unit-${key}`}
                  label={unitName(key, i18n.language)}
                  selected={!custom && value.unit === key}
                  onPress={() => {
                    setCustom(false);
                    change({ unit: key });
                  }}
                />
              ))}
              <Chip
                testID="editor-goal-unit-custom"
                label={t('editor.goal.customUnit')}
                selected={custom}
                onPress={() => {
                  setCustom(true);
                  change({ unit: '' });
                }}
              />
            </View>
          )}
          {custom && !linked ? (
            <TextInput
              testID="editor-goal-unit-text"
              value={value.unit}
              onChangeText={(text) => change({ unit: text })}
              placeholder={t('editor.goal.customUnitPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('editor.goal.customUnit')}
              maxLength={12}
              style={input}
            />
          ) : null}
          <ThemedText variant="label" color={colors.textMuted}>
            {t('editor.goal.increment')}
          </ThemedText>
          <TextInput
            testID="editor-goal-increment"
            value={value.increment}
            onChangeText={(text) => {
              setIncrementTouched(true);
              onChange({ ...value, increment: text });
            }}
            keyboardType="decimal-pad"
            accessibilityLabel={t('editor.goal.increment')}
            style={input}
          />
          {target !== null && increment !== null && !unitMissing ? (
            <ThemedText testID="editor-goal-summary" variant="caption" color={colors.textMuted}>
              {t('editor.goal.summary', {
                increment: formatAmount(increment, value.unit, i18n.language),
                target: formatAmount(target, value.unit, i18n.language),
              })}
            </ThemedText>
          ) : (
            <ThemedText testID="editor-goal-missing" variant="caption" color={colors.dangerText}>
              {t('editor.goal.missing')}
            </ThemedText>
          )}
          <HealthLink
            metric={value.healthMetric}
            onChange={(metric) => {
              if (metric !== null) {
                setCustom(false);
              }
              change(
                metric === null
                  ? { healthMetric: null }
                  : { healthMetric: metric, unit: healthUnit(metric) },
              );
            }}
          />
        </>
      ) : null}
    </View>
  );
}

/** «Durata» (design 4.7): minutes with the quick chips and a counter, and the note on the timer. */
function DurationField({ value, onChange }: GoalFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const minutes = parseAmount(value.target) ?? TIMER.initialMinutes;
  const chips: readonly number[] = TIMER.chips;
  return (
    <>
      <ThemedText variant="label" color={colors.textMuted}>
        {t('editor.goal.minutes')}
      </ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {chips.map((chip) => (
          <Chip
            key={chip}
            testID={`editor-goal-minutes-${chip}`}
            label={t('today.timer.ready', { minutes: chip })}
            selected={minutes === chip}
            onPress={() => onChange(durationGoal(chip))}
          />
        ))}
      </View>
      <Counter
        testID="editor-goal-minutes"
        value={Math.round(minutes)}
        min={1}
        max={TIMER.maxMinutes}
        onChange={(next) => onChange(durationGoal(next))}
        accessibilityLabel={t('editor.goal.minutes')}
        unit={t('editor.goal.minutesUnit')}
      />
      <ThemedText testID="editor-goal-timer-note" variant="caption" color={colors.textMuted}>
        {t('editor.goal.timerNote')}
      </ThemedText>
    </>
  );
}

export interface GoalSheetProps {
  readonly visible: boolean;
  readonly value: GoalDraft;
  readonly onDone: (goal: GoalDraft) => void;
  readonly onClose: () => void;
}

/** The sheet «Obiettivo misurabile» of the editor (mockup D15A), with «Fatto». */
export function GoalSheet({ visible, value, onDone, onClose }: GoalSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [opening, setOpening] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      // Every opening starts from the goal of the editor, with the proposals of a new field.
      setDraft(value);
      setOpening((count) => count + 1);
    }
  }
  const valid = goalOf(draft) !== null;
  return (
    <Sheet
      testID="editor-goal-sheet"
      visible={visible}
      onClose={onClose}
      title={t('editor.goal.title')}
    >
      <View style={styles.sheet}>
        <GoalField key={opening} value={draft} onChange={setDraft} />
        <Button
          testID="editor-goal-done"
          label={t('editor.goal.done')}
          disabled={!valid}
          disabledReason={t('editor.goal.missing')}
          onPress={() => onDone(draft)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: 16, paddingBottom: 16 },
  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
});
