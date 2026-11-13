import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { SKIP_REASONS, type SkipReason } from '@/db/repositories/completion';
import type { TodayMission } from '@/db/repositories/todayView';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { SKIPS } from '@/rules/config';
import { useTheme } from '@/theme/ThemeProvider';

const ROW_HEIGHT = 56;

export interface SkipSheetProps {
  /** The mission to skip; null keeps the sheet closed. */
  readonly item: TodayMission | null;
  readonly onClose: () => void;
  readonly onSkip: (item: TodayMission, reason: SkipReason) => void;
}

/**
 * «Salta oggi» (design-sezioni.md 2.5, mockup D11B; US-OGGI-06): the reasons and the skips left
 * this week. With none left the reasons stay but the button explains why it cannot skip.
 */
export function SkipSheet({ item, onClose, onSkip }: SkipSheetProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const [reason, setReason] = useState<SkipReason | null>(null);
  // The last mission shown, so the sheet keeps its texts while it slides away.
  const [shown, setShown] = useState(item);
  const [openFor, setOpenFor] = useState(item?.mission.id ?? null);
  if (item !== null && item !== shown) {
    setShown(item);
  }
  const current = item?.mission.id ?? null;
  if (current !== openFor) {
    // Every opening starts with no reason chosen.
    setOpenFor(current);
    setReason(null);
  }

  const left = shown?.skipsLeft ?? 0;
  const none = left === 0;
  const noneText = t('today.skip.none', { max: SKIPS.maxPerMissionPerWeek });

  return (
    <Sheet
      testID="today-skip-sheet"
      visible={item !== null}
      onClose={onClose}
      title={shown === null ? undefined : t('today.skip.title', { name: shown.mission.name })}
    >
      <View style={styles.content}>
        <ThemedText
          testID="today-skip-left"
          variant="caption"
          color={none ? colors.dangerText : colors.textMuted}
        >
          {none ? noneText : t('today.skip.left', { count: left })}
        </ThemedText>
        <Card style={styles.list}>
          <View accessibilityRole="radiogroup">
            {SKIP_REASONS.map((key, index) => {
              const checked = key === reason;
              return (
                <Fragment key={key}>
                  {index === 0 ? null : (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                  <Pressable
                    testID={`today-skip-reason-${key}`}
                    disabled={none}
                    onPress={() => setReason(key)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked, disabled: none }}
                    style={styles.row}
                  >
                    <ThemedText color={none ? colors.textMuted : colors.text} style={styles.flex}>
                      {t(`today.skip.reasons.${key}`)}
                    </ThemedText>
                    {checked ? <Icon name="completa" size={20} color={colors.primary} /> : null}
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        </Card>
        <Button
          testID="today-skip-confirm"
          label={t('lexicon.skipToday', { context: family })}
          disabled={none || reason === null}
          disabledReason={none ? noneText : t('today.skip.chooseFirst')}
          onPress={() => {
            if (shown !== null && reason !== null && !none) {
              onSkip(shown, reason);
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
  flex: { flex: 1 },
});
