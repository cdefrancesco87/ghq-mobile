import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TodayPause } from '@/db/repositories/todayView';
import { ResumePauseDialog } from '@/features/settings/ResumePauseDialog';
import { dayAndMonth } from '@/features/settings/format';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { hitSlopFor } from '@/features/shared/touch';
import { useEssential } from '@/features/shared/useGameMode';
import { useTheme } from '@/theme/ThemeProvider';

const ICON = 20;

export interface PauseBannerProps {
  readonly pause: TodayPause | null;
}

/**
 * The band of the general pause at the top of Today (design-sezioni.md 2.8): the pause icon,
 * «In pausa fino al 20 novembre · La vita è al sicuro» and «Riprendi», which does not close. On
 * the last paused day (after «Riprendi», or the last day chosen) it becomes «Si riparte domani»,
 * which closes until the day changes. The text is a live region, so the change is said aloud.
 */
export function PauseBanner({ pause }: PauseBannerProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const essential = useEssential();
  const [closed, setClosed] = useState(false);
  const [asking, setAsking] = useState(false);
  if (pause === null) {
    return null;
  }
  const context = essential ? 'essential' : undefined;

  if (pause.lastDay) {
    return closed ? null : (
      <Card testID="today-pause-last-day">
        <View style={styles.row}>
          <Icon name="play" size={ICON} color={colors.infoText} />
          <ThemedText accessibilityLiveRegion="polite" style={styles.flex}>
            {t('pause.banner.lastDay')}
          </ThemedText>
          <Pressable
            testID="today-pause-last-day-close"
            accessibilityRole="button"
            accessibilityLabel={t('shared.close')}
            onPress={() => setClosed(true)}
            hitSlop={hitSlopFor(ICON)}
          >
            <Icon name="chiudi" size={ICON} color={colors.textMuted} />
          </Pressable>
        </View>
      </Card>
    );
  }

  const text =
    pause.untilDay === null
      ? t('pause.banner.open', { context })
      : t('pause.banner.until', { context, date: dayAndMonth(pause.untilDay, i18n.language) });
  return (
    <Card testID="today-pause-banner">
      <View style={styles.row}>
        <Icon name="pausa" size={ICON} color={colors.infoText} />
        <ThemedText accessibilityLiveRegion="polite" style={styles.flex}>
          {text}
        </ThemedText>
        <Button
          testID="today-pause-resume"
          variant="text"
          label={t('pause.banner.resume')}
          accessibilityLabel={t('pause.banner.resumeLabel')}
          onPress={() => setAsking(true)}
        />
      </View>
      <ResumePauseDialog
        testID="today-pause-dialog"
        visible={asking}
        pause={pause}
        onClose={() => setAsking(false)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
