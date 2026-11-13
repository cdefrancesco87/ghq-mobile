import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { HealthPermission } from '@/features/health/source';
import { healthSource } from '@/features/health/system';
import { Chip } from '@/features/shared/Chip';
import { ThemedText } from '@/features/shared/ThemedText';
import { HEALTH_METRICS, type HealthMetric } from '@/rules/health';
import { useTheme } from '@/theme/ThemeProvider';

type Status = HealthPermission | 'asking';

export interface HealthLinkProps {
  readonly metric: HealthMetric | null;
  /** A metric whose permission was granted, or null to unlink. */
  readonly onChange: (metric: HealthMetric | null) => void;
}

/**
 * «Collega a Salute» in the quantity goal (design-sezioni.md 12.7): steps, minutes of activity or
 * hours of sleep. The system permission is asked only here, when a metric is chosen; a refused
 * permission or a phone without health data is said in the row, and the mission stays manual.
 */
export function HealthLink({ metric, onChange }: HealthLinkProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const source = healthSource();
  const context = source.platform ?? undefined;
  const app = t('editor.goal.health.app', { context });
  const [status, setStatus] = useState<Status>('granted');
  const alive = useRef(true);

  // A linked mission whose permission went away (or was never given on this phone) says so.
  const [checked] = useState(metric);
  useEffect(() => {
    alive.current = true;
    if (checked !== null) {
      void source.permission(checked).then((permission) => {
        if (alive.current) {
          setStatus(permission);
        }
      });
    }
    return () => {
      alive.current = false;
    };
  }, [checked, source]);

  const choose = async (chosen: HealthMetric | null) => {
    if (chosen === null) {
      setStatus('granted');
      onChange(null);
      return;
    }
    setStatus('asking');
    const permission = await source.requestPermission(chosen);
    if (!alive.current) {
      return;
    }
    setStatus(permission);
    if (permission === 'granted') {
      onChange(chosen);
    }
  };

  const problem = status !== 'granted' && status !== 'asking';
  const caption =
    status === 'asking'
      ? t('editor.goal.health.asking', { app })
      : problem
        ? t(`editor.goal.health.${status}`, { app })
        : metric === null
          ? t('editor.goal.health.explain', { app })
          : t(`editor.goal.health.linked_${metric}`, { app });

  return (
    <View testID="editor-goal-health" style={styles.field}>
      <ThemedText variant="label" color={colors.textMuted}>
        {t('editor.goal.health.title', { context })}
      </ThemedText>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {[null, ...HEALTH_METRICS].map((key) => (
          <Chip
            key={key ?? 'none'}
            testID={`editor-goal-health-${key ?? 'none'}`}
            label={t(`editor.goal.health.metrics.${key ?? 'none'}`)}
            selected={metric === key}
            onPress={() => void choose(key)}
          />
        ))}
      </View>
      <ThemedText
        testID="editor-goal-health-status"
        variant="caption"
        color={problem ? colors.dangerText : colors.textMuted}
        accessibilityLiveRegion="polite"
      >
        {caption}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
