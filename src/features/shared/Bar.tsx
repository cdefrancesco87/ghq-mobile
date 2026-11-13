import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { ThemedText } from './ThemedText';

export type BarKind = 'hp' | 'xp' | 'boss' | 'stat';

/** Width of a stripe and of the gap after it, along the bar. */
const STRIPE_PERIOD = 6;

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

/**
 * Striped segments at the end of the full ones: at least one when part of the value is protected,
 * never more than the full segments.
 */
export function protectedSegments(ratio: number, filled: number, count: number): number {
  if (ratio <= 0 || filled === 0) {
    return 0;
  }
  return Math.min(Math.max(Math.round(ratio * count), 1), filled);
}

export interface BarProps {
  readonly kind: BarKind;
  /** The name of the value in the lexicon of the theme: read by the screen reader. */
  readonly label: string;
  readonly value: number;
  readonly max: number;
  /** Writes the name above the bar. */
  readonly showLabel?: boolean;
  /**
   * The part of the value that cannot go down yet, drawn striped at the end of the fill: the hit
   * points of a boss that only the last step can take (design-sezioni.md 5.3).
   */
  readonly protectedValue?: number;
  /** Writes `value/max` beside the bar; off when the screen writes the numbers itself. */
  readonly showValue?: boolean;
  readonly testID?: string;
}

/** Health, experience, boss or stat bar, always with the number beside it (design-sezioni.md A6). */
export function Bar({
  kind,
  label,
  value,
  max,
  showLabel = true,
  protectedValue = 0,
  showValue = true,
  testID,
}: BarProps) {
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
        <Track
          color={fillColors[kind]}
          ratio={barRatio(value, max)}
          protectedRatio={barRatio(Math.min(protectedValue, value), max)}
          testID={testID}
        />
        {showValue ? (
          <ThemedText variant="numbers" color={kind === 'hp' ? colors.hpText : colors.text}>
            {`${value}/${max}`}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

/** Diagonal stripes in the colour of the bar, over the empty track. */
function Stripes({ color }: { color: string }) {
  // The id of a pattern is a name in the SVG: only letters and digits.
  const id = `stripes${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern
          id={id}
          width={STRIPE_PERIOD}
          height={STRIPE_PERIOD}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <Rect width={STRIPE_PERIOD / 2} height={STRIPE_PERIOD} fill={color} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function Track({
  color,
  ratio,
  protectedRatio,
  testID,
}: {
  color: string;
  ratio: number;
  protectedRatio: number;
  testID: string | undefined;
}) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  const { height, radius, outlineWidth, segments, glow } = shape.bar;
  const [width, setWidth] = useState(0);
  const trackID = testID === undefined ? undefined : `${testID}-track`;
  const protectedID = testID === undefined ? undefined : `${testID}-protected`;
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
          style={[
            styles.fill,
            { width: `${ratio * 100}%` },
            protectedRatio > 0 ? null : { backgroundColor: color },
          ]}
        >
          {protectedRatio > 0 ? (
            <>
              <View style={{ flex: ratio - protectedRatio, backgroundColor: color }} />
              <View testID={protectedID} style={[styles.striped, { flex: protectedRatio }]}>
                <Stripes color={color} />
              </View>
            </>
          ) : null}
        </View>
      </View>
    );
  }
  const count =
    segments.kind === 'count'
      ? segments.count
      : Math.floor((width + segments.gap) / (segments.width + segments.gap));
  const filled = filledSegments(ratio, count);
  const striped = protectedSegments(protectedRatio, filled, count);
  return (
    <View
      testID={trackID}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={[styles.track, styles.segments, { height, gap: segments.gap }]}
    >
      {Array.from({ length: count }, (_, index) => {
        const full = index < filled;
        const stripes = full && index >= filled - striped;
        const state = stripes ? 'protected' : full ? 'full' : 'empty';
        return (
          <View
            key={index}
            testID={testID === undefined ? undefined : `${testID}-${state}`}
            style={[
              {
                height,
                backgroundColor: full && !stripes ? color : colors.track,
                // Only the stripes are clipped: the glow of the full segments goes outside.
                overflow: stripes ? 'hidden' : 'visible',
              },
              segments.kind === 'fixed' ? { width: segments.width } : styles.flexSegment,
              full && !stripes && glow > 0 ? { boxShadow: `0 0 ${glow}px ${color}` } : null,
            ]}
          >
            {stripes ? <Stripes color={color} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  fill: { height: '100%', flexDirection: 'row' },
  striped: { height: '100%', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, overflow: 'hidden' },
  segments: { flexDirection: 'row', overflow: 'visible' },
  flexSegment: { flex: 1 },
});
