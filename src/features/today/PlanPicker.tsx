import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { doneGlyph, emptyGlyph, Glyph } from '@/features/shared/CompletionControl';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { DAY_PLAN } from '@/rules/config';
import { canAddToPlan } from '@/rules/day';
import { useTheme } from '@/theme/ThemeProvider';
import { useMissionTexts } from './missionText';

const ROW_HEIGHT = 60;

export interface PlanPickerProps {
  readonly view: TodayView;
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onChoose: (item: TodayMission) => void;
}

/**
 * «Scegli una priorità» (design-sezioni.md 2.3, mockup D12): the missions of today still to do
 * and outside the plan. With a full plan they are only shown, with the reason.
 */
export function PlanPicker({ view, visible, onClose, onChoose }: PlanPickerProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  // Minutes east of UTC only matter for the done time, which the picker never shows.
  const { detailOf } = useMissionTexts(view.day, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    // Every opening starts with nothing chosen.
    setWasVisible(visible);
    setSelected(null);
  }

  const full = !canAddToPlan(view.plan);
  const candidates = view.missions.filter(
    (item) => item.state === 'todo' && !view.plan.includes(item.mission.id),
  );
  const chosen = full ? undefined : candidates.find((item) => item.mission.id === selected);
  const term = t('lexicon.missions_pl', { context: family });

  return (
    <Sheet
      testID="today-plan-picker"
      visible={visible}
      onClose={onClose}
      title={t('today.plan.picker.title')}
    >
      <View style={styles.content}>
        {full ? null : (
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('today.plan.picker.subtitle', { term })}
          </ThemedText>
        )}
        {candidates.length === 0 ? (
          <ThemedText testID="today-plan-picker-none" color={colors.textMuted}>
            {t('today.plan.picker.none', { term })}
          </ThemedText>
        ) : (
          <Card style={styles.list}>
            <View accessibilityRole="radiogroup">
              {candidates.map((item, index) => {
                const checked = item.mission.id === selected;
                const detail = detailOf(item);
                return (
                  <Fragment key={item.mission.id}>
                    {index === 0 ? null : (
                      <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    )}
                    <Pressable
                      testID={`today-plan-picker-${item.mission.id}`}
                      disabled={full}
                      onPress={() => setSelected(item.mission.id)}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        detail === '' ? item.mission.name : `${item.mission.name}, ${detail}`
                      }
                      accessibilityState={{ checked, disabled: full }}
                      style={styles.row}
                    >
                      <View style={styles.texts}>
                        <ThemedText color={full ? colors.textMuted : colors.text}>
                          {item.mission.name}
                        </ThemedText>
                        {full || detail === '' ? null : (
                          <ThemedText variant="caption" color={colors.textMuted}>
                            {detail}
                          </ThemedText>
                        )}
                      </View>
                      <Glyph>
                        {checked ? doneGlyph(family, colors) : emptyGlyph(family, colors.textMuted)}
                      </Glyph>
                    </Pressable>
                  </Fragment>
                );
              })}
            </View>
          </Card>
        )}
        {full ? (
          <ThemedText testID="today-plan-picker-full">
            {t('today.plan.picker.full', { max: DAY_PLAN.maxPriorities })}
          </ThemedText>
        ) : null}
        <Button
          testID="today-plan-picker-confirm"
          label={t('today.missions.menu.addToPlan')}
          disabled={chosen === undefined}
          disabledReason={
            full
              ? t('today.plan.picker.full', { max: DAY_PLAN.maxPriorities })
              : t('today.plan.picker.chooseFirst')
          }
          onPress={() => {
            if (chosen !== undefined) {
              onChoose(chosen);
            }
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  separator: { height: StyleSheet.hairlineWidth },
  row: {
    minHeight: Math.max(ROW_HEIGHT, MIN_TOUCH),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  texts: { flex: 1, gap: 2 },
});
