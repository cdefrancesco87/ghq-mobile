import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export type BarKind = 'hp' | 'xp' | 'boss' | 'stat';

/** How much of the bar is full, from 0 to 1. */
export function barRatio(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.min(Math.max(value / max, 0), 1);
}

/** Full segments: an empty or full bar looks so only when it really is. */
export function filledSegments(ratio: number, count: number): number {
  if (ratio <= 0) {
    return 0;
  }
  if (ratio >= 1) {
    return count;
  }
  return Math.min(Math.max(Math.round(ratio * count), 1), count - 1);
}

export interface BarProps {
  readonly kind: BarKind;
  /** The name of the value in the lexicon of the theme: read by the screen reader. */
  readonly label: string;
  readonly value: number;
  readonly max: number;
  /** Writes the name above the bar. */
  readonly showLabel?: boolean;
  readonly testID?: string;
}

/** Health, experience, boss or stat bar, always with the number beside it (design-sezioni.md A6). */
export function Bar({ kind, label, value, max, showLabel = true, testID }: BarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const fillColors: Record<BarKind, string> = {
    hp: colors.hp,
    xp: colors.xp,
    boss: colors.boss,
    stat: colors.primary,
  };
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('shared.barValue', { label, value, max })}
      accessibilityValue={{ min: 0, max, now: value }}
      style={styles.container}
    >
      {showLabel ? (
        <ThemedText variant="caption" color={colors.textMuted}>
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <Track color={fillColors[kind]} ratio={barRatio(value, max)} testID={testID} />
        <ThemedText variant="numbers" color={kind === 'hp' ? colors.hpText : colors.text}>
          {`${value}/${max}`}
        </ThemedText>
      </View>
    </View>
  );
}

function Track({
  color,
  ratio,
  testID,
}: {
  color: string;
  ratio: number;
  testID: string | undefined;
}) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  const { height, radius, outlineWidth, segments, glow } = shape.bar;
  const [width, setWidth] = useState(0);
  const trackID = testID === undefined ? undefined : `${testID}-track`;
  if (segments === null) {
    return (
      <View
        testID={trackID}
        style={[
          styles.track,
          {
            height,
            borderRadius: radius,
            borderWidth: outlineWidth,
            borderColor: colors.textMuted,
            backgroundColor: colors.track,
          },
        ]}
      >
        <View
          testID={testID === undefined ? undefined : `${testID}-fill`}
          style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: color }}
        />
      </View>
    );
  }
  const count =
    segments.kind === 'count'
      ? segments.count
      : Math.floor((width + segments.gap) / (segments.width + segments.gap));
  const filled = filledSegments(ratio, count);
  return (
    <View
      testID={trackID}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={[styles.track, styles.segments, { height, gap: segments.gap }]}
    >
      {Array.from({ length: count }, (_, index) => {
        const full = index < filled;
        return (
          <View
            key={index}
            testID={testID === undefined ? undefined : `${testID}-${full ? 'full' : 'empty'}`}
            style={[
              { height, backgroundColor: full ? color : colors.track },
              segments.kind === 'fixed' ? { width: segments.width } : styles.flexSegment,
              full && glow > 0 ? { boxShadow: `0 0 ${glow}px ${color}` } : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, overflow: 'hidden' },
  segments: { flexDirection: 'row', overflow: 'visible' },
  flexSegment: { flex: 1 },
});
