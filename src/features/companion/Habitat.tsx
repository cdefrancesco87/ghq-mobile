import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { PIXEL_HABITATS } from '@/features/shared/generated/pixelSprites';
import { VECTOR_SVGS } from '@/features/shared/generated/svgData';
import { habitatKey } from '@/features/shared/sprites';
import type { ThemeFamily } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';

const PIXEL: Readonly<Record<string, (typeof PIXEL_HABITATS)[keyof typeof PIXEL_HABITATS]>> =
  PIXEL_HABITATS;
const VECTOR: Readonly<Record<string, string>> = VECTOR_SVGS;

/** Width ÷ height of every habitat drawing (130×140 pixels, 390×420 in Minimal). */
export const HABITAT_RATIO = 130 / 140;

/**
 * Where the companion stands in each habitat, as a share of its height from the top: the floor of
 * the drawing (mockup B8), so that it sits on the bricks, the rug, the tank, the desk or the cloud.
 */
const FLOOR: Readonly<Record<ThemeFamily, number>> = {
  arcade: 0.95,
  fantasy: 0.94,
  cyberpunk: 0.74,
  lovecraft: 0.65,
  minimal: 0.8,
};

export interface HabitatProps {
  readonly width: number;
  /** The companion, set on the floor of the drawing. */
  readonly children: ReactNode;
}

/**
 * The habitat of the theme at the top of the companion sheet (design-sezioni.md 6.2, 6.10): a
 * still drawing as wide as the screen, about half of its height. The drawing is decoration: only
 * the companion on it is read by the screen reader.
 */
export function Habitat({ width, children }: HabitatProps) {
  const { key, family } = useTheme();
  const name = habitatKey(key);
  const pixel = PIXEL[name];
  const height = Math.round(width / HABITAT_RATIO);
  return (
    <View testID="companion-habitat" style={{ width, height }}>
      <View
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {pixel === undefined ? (
          <SvgXml xml={VECTOR[name] ?? null} width={width} height={height} />
        ) : (
          <Image
            testID="companion-habitat-image"
            source={pixel.source}
            contentFit="fill"
            style={{ width, height }}
          />
        )}
      </View>
      <View style={[styles.stage, { height: height * FLOOR[family] }]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
