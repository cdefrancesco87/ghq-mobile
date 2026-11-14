import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { backfillCompletion, type BackfillDay } from '@/db/repositories/backfill';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { useMomentQueue } from '@/features/shared/MomentQueue';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useEssential } from '@/features/shared/useGameMode';
import { useUndoToast } from '@/features/shared/UndoToast';
import { termInSentence } from '@/i18n/lexicon';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';
import { longDay } from './HeatmapDaySheet';

export interface BackfillPickerProps {
  /** The days with the missions that can be completed afterwards, the latest first. */
  readonly days: readonly BackfillDay[];
  readonly today: GameDay;
  /** A header above each day: off in the sheet of a single day. */
  readonly withDays?: boolean;
  /** Closes the sheet: after the completion the moments and the toast follow it. */
  readonly onDone: () => void;
}

interface Choice {
  readonly day: GameDay;
  readonly missionId: string;
}

/**
 * The forgotten completion (design-sezioni.md 8.3 and 8.6, US-STAT-03): the missions expected in
 * the last 7 days and not done, one to choose, and the line that says what it does not give back
 * above the confirmation.
 */
export function BackfillPicker({ days, today, withDays = true, onDone }: BackfillPickerProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const toast = useUndoToast();
  const { enqueue } = useMomentQueue();
  const [choice, setChoice] = useState<Choice | null>(null);
  // A second tap on «Aggiungi» while the sheet slides away adds nothing (and shows no error).
  const added = useRef(false);
  // Essential (8.11): no coins and no health in the texts.
  const essential = useEssential();
  const lexicon = (key: string) => t(`lexicon.${key}`, { context: family });

  const dayTitle = (day: GameDay) =>
    day === addDays(today, -1) ? t('questLog.yesterday') : longDay(day, i18n.language);

  const confirm = () => {
    if (choice === null || added.current) {
      return;
    }
    try {
      const result = runAction((db, clock) =>
        backfillCompletion(db, { ...choice, now: clock.now, tzOffset: clock.tzOffset }),
      );
      added.current = true;
      setChoice(null);
      onDone();
      // The moments and the toast come once the sheet has slid away: two modals at once do not
      // open on iOS.
      setTimeout(() => {
        toast.show({
          message: essential
            ? t('backfill.doneEssential', { xp: result.xp, xpTerm: lexicon('xp_pl') })
            : t('backfill.done', {
                xp: result.xp,
                xpTerm: lexicon('xp_pl'),
                coins: result.coins,
                coinsTerm: termInSentence(lexicon('coins_pl'), i18n.language),
              }),
        });
        enqueue(result.moments);
      }, SHEET_DURATION_MS);
    } catch {
      setChoice(null);
      toast.show({ message: t('today.missions.errors.failed') });
    }
  };

  return (
    <View testID="backfill-picker" style={styles.content}>
      {days.length === 0 ? (
        <ThemedText testID="backfill-empty" color={colors.textMuted}>
          {t('backfill.empty')}
        </ThemedText>
      ) : (
        days.map(({ day, missions }) => (
          <View key={day} style={styles.group}>
            {withDays ? (
              <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
                {dayTitle(day)}
              </ThemedText>
            ) : null}
            <Card style={styles.list}>
              {missions.map((mission, index) => {
                const checked = choice?.day === day && choice.missionId === mission.id;
                return (
                  <View key={mission.id}>
                    {index === 0 ? null : (
                      <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    )}
                    <Pressable
                      testID={`backfill-option-${day}-${mission.id}`}
                      onPress={() => {
                        added.current = false;
                        setChoice({ day, missionId: mission.id });
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked }}
                      accessibilityLabel={
                        withDays ? `${mission.name}, ${dayTitle(day)}` : mission.name
                      }
                      style={styles.option}
                    >
                      <ThemedText style={styles.flex}>{mission.name}</ThemedText>
                      {checked ? <Icon name="completa" size={20} color={colors.primary} /> : null}
                    </Pressable>
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}
      <ThemedText testID="backfill-note" variant="caption" color={colors.textMuted}>
        {essential
          ? t('backfill.noteEssential', {
              xp: lexicon('xp_pl'),
              streak: termInSentence(lexicon('streak'), i18n.language),
            })
          : t('backfill.note', {
              xp: lexicon('xp_pl'),
              hp: termInSentence(lexicon('hp'), i18n.language),
              streak: termInSentence(lexicon('streak'), i18n.language),
            })}
      </ThemedText>
      <Button
        testID="backfill-confirm"
        label={t('backfill.confirm')}
        disabled={choice === null}
        disabledReason={t('backfill.choose')}
        onPress={confirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  group: { gap: 8 },
  list: { paddingVertical: 0 },
  option: { minHeight: MIN_TOUCH + 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
});
