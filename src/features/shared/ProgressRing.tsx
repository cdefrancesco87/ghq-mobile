import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeFamily } from '@/theme/themes';

/** The stroke of the ring around the control: 3 in Lovecraft, 4 elsewhere (misure-componenti.md). */
export function ringStroke(family: ThemeFamily): number {
  return family === 'lovecraft' ? 3 : 4;
}

/** The dash of the filled part of a stroke as long as `perimeter`. */
export function ringDash(progress: number, perimeter: number): readonly [number, number] {
  return [Math.min(Math.max(progress, 0), 1) * perimeter, perimeter];
}

export interface ProgressRingProps {
  /** From 0 to 1. */
  readonly progress: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly testID?: string;
}

/**
 * A ring that fills clockwise from the top, in the colour of the XP. In Arcade it is a pixel square
 * (correction 4 of misure-componenti.md). Decorative: the row reads the progress.
 */
export function ProgressRing({ progress, size, strokeWidth, testID }: ProgressRingProps) {
  const { colors, family } = useTheme();
  const center = size / 2;
  const square = family === 'arcade';
  const inner = size - strokeWidth;
  const radius = inner / 2;
  const stroke = { fill: 'none', strokeWidth };
  return (
    <View
      testID={testID === undefined ? undefined : `${testID}-${square ? 'square' : 'round'}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ring, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {square ? (
          <>
            <Path d={squarePath(size, strokeWidth)} stroke={colors.track} {...stroke} />
            <Path
              d={squarePath(size, strokeWidth)}
              stroke={colors.xp}
              strokeDasharray={[...ringDash(progress, inner * 4)]}
              {...stroke}
            />
          </>
        ) : (
          <>
            <Circle cx={center} cy={center} r={radius} stroke={colors.track} {...stroke} />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.xp}
              strokeDasharray={[...ringDash(progress, 2 * Math.PI * radius)]}
              rotation={-90}
              originX={center}
              originY={center}
              {...stroke}
            />
          </>
        )}
      </Svg>
    </View>
  );
}

/** The square from the middle of its top side, clockwise. */
function squarePath(size: number, strokeWidth: number): string {
  const start = strokeWidth / 2;
  const end = size - start;
  return `M${size / 2} ${start}H${end}V${end}H${start}V${start}Z`;
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
});
