import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/features/shared/Icon';
import type { ThemeColors, ThemeFamily } from '@/theme/themes';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The cheer of the companion for a gift (design-sezioni.md 6.8): about 2 seconds in all, two hops
 * of the sprite (`CompanionScreen`) and the effect of the theme around it. Animation, not a game
 * rule: the times live here, not in src/rules/config.ts.
 */
export const GIFT_CHEER = {
  durationMs: 2000,
  /** How high the companion hops, twice, in pixels. */
  hopHeight: 18,
  hopUpMs: 160,
  hopDownMs: 200,
  /** How far the particles rise, in pixels. */
  rise: 90,
} as const;

/** One particle of the effect: where it starts (share of the width) and when. */
interface Particle {
  readonly x: number;
  readonly delay: number;
  readonly size: number;
  readonly color: string;
  readonly shape: 'heart' | 'square' | 'dot';
}

const SPREAD = [0.2, 0.8, 0.35, 0.65, 0.5, 0.1, 0.9];

/**
 * The effect of each theme (6.8): pixel hearts rising (Arcade), golden sparks (Fantasy), neon cyan
 * and magenta confetti (Cyberpunk), bioluminescent fireflies (Lovecraft), a small heart and a few
 * confetti (Minimal). The colours are roles of the theme, never fixed pixels.
 */
function particlesOf(family: ThemeFamily, colors: ThemeColors): readonly Particle[] {
  const at = (index: number, rest: Omit<Particle, 'x' | 'delay'>): Particle => ({
    x: SPREAD[index % SPREAD.length] ?? 0.5,
    delay: index * 140,
    ...rest,
  });
  switch (family) {
    case 'arcade':
      return SPREAD.map((_, index) => at(index, { size: 16, color: colors.hp, shape: 'heart' }));
    case 'fantasy':
      return SPREAD.map((_, index) =>
        at(index, { size: index % 2 === 0 ? 6 : 4, color: colors.coins, shape: 'dot' }),
      );
    case 'cyberpunk':
      return SPREAD.map((_, index) =>
        at(index, {
          size: 6,
          color: index % 2 === 0 ? colors.info : colors.primary,
          shape: 'square',
        }),
      );
    case 'lovecraft':
      return SPREAD.slice(0, 5).map((_, index) =>
        at(index, { size: 6, color: colors.done, shape: 'dot' }),
      );
    case 'minimal':
      return [
        at(4, { size: 16, color: colors.hp, shape: 'heart' }),
        at(0, { size: 5, color: colors.primary, shape: 'square' }),
        at(1, { size: 5, color: colors.coins, shape: 'square' }),
        at(2, { size: 5, color: colors.info, shape: 'square' }),
      ];
  }
}

export interface GiftCheerProps {
  /** Width of the area of the companion. */
  readonly width: number;
  /** Riduci movimento: only one heart, still, and no hops. */
  readonly reduced: boolean;
}

/** The particles of the cheer, drawn over the companion; decoration only. */
export function GiftCheer({ width, reduced }: GiftCheerProps) {
  const { colors, family } = useTheme();
  const particles = reduced
    ? [{ x: 0.5, delay: 0, size: 16 as const, color: colors.hp, shape: 'heart' as const }]
    : particlesOf(family, colors);
  return (
    <View
      testID="companion-gift-cheer"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.area]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {particles.map((particle, index) => (
        <Rising key={index} particle={particle} width={width} still={reduced} />
      ))}
    </View>
  );
}

function Rising({
  particle,
  width,
  still,
}: {
  readonly particle: Particle;
  readonly width: number;
  readonly still: boolean;
}) {
  const progress = useSharedValue(still ? 0.5 : 0);
  useEffect(() => {
    if (!still) {
      progress.set(
        withDelay(
          particle.delay,
          withTiming(1, {
            duration: GIFT_CHEER.durationMs - particle.delay,
            easing: Easing.out(Easing.quad),
          }),
        ),
      );
    }
  }, [particle.delay, progress, still]);
  const style = useAnimatedStyle(() => ({
    opacity: still ? 1 : 1 - progress.get(),
    transform: [{ translateY: -GIFT_CHEER.rise * progress.get() }],
  }));
  const left = particle.x * width - particle.size / 2;
  return (
    <Animated.View style={[styles.particle, { left }, style]}>
      {particle.shape === 'heart' ? (
        <Icon name="cuore" size={16} color={particle.color} />
      ) : (
        <View
          style={{
            width: particle.size,
            height: particle.size,
            borderRadius: particle.shape === 'dot' ? particle.size / 2 : 0,
            backgroundColor: particle.color,
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  area: { overflow: 'visible' },
  particle: { position: 'absolute', bottom: '30%' },
});
