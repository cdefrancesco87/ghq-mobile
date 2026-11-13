import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { CompanionSprite } from './CompanionSprite';
import { hasSprite, Sprite } from './Sprite';
import { EVOLUTION_STEPS, evolutionSpriteKey } from './placeholders';

/**
 * The storyboard of the evolution (design-sezioni.md 6.6, A7), from the moment the sprite has
 * bounced in: a light grows behind the puppy, the shape changes, a flash, the adult greets.
 * Everything ends within the 2.5 seconds of a moment.
 */
export const EVOLUTION = {
  lightMs: 400,
  /** One frame of the change of shape. */
  frameMs: 80,
  flashMs: 250,
  greetMs: 400,
  /** How high the adult hops while it greets, in pixels. */
  hopHeight: 14,
  /** The size of the light against the sprite. */
  lightScale: 1.5,
} as const;

/** The flash of light when the shape settles: white in every theme. */
const FLASH_COLOR = '#ffffff';

/**
 * The order of the frames of the change of shape: 0 is the puppy, `middle + 1` the adult, in
 * between the intermediate sprites. Each one comes forward, steps back once, then settles; with no
 * intermediate sprite the puppy flickers into the adult.
 */
export function evolutionOrder(middle: number): readonly number[] {
  if (middle === 0) {
    return [1, 0, 1, 0, 1];
  }
  const order: number[] = [];
  for (let step = 1; step <= middle; step += 1) {
    order.push(step, step - 1, step);
  }
  return [...order, middle + 1];
}

/**
 * The intermediate sprites of the theme, from the placeholders of `placeholders.ts` (task C15:
 * replace the files there), and the order the frames are shown in.
 */
function useFrames(): { readonly middle: readonly string[]; readonly order: readonly number[] } {
  const { family } = useTheme();
  return useMemo(() => {
    const middle = EVOLUTION_STEPS.map((step) => evolutionSpriteKey(family, step)).filter(
      hasSprite,
    );
    return { middle, order: evolutionOrder(middle.length) };
  }, [family]);
}

/** One frame: visible only while `frame` is its index. */
function Frame({
  index,
  frame,
  greet,
  children,
  testID,
}: {
  readonly index: number;
  readonly frame: SharedValue<number>;
  /** The adult hides behind its greeting. */
  readonly greet?: SharedValue<number>;
  readonly children: React.ReactNode;
  readonly testID?: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: frame.get() === index ? 1 - (greet?.get() ?? 0) : 0,
  }));
  return (
    <Animated.View testID={testID} style={[StyleSheet.absoluteFill, styles.center, style]}>
      {children}
    </Animated.View>
  );
}

export interface CompanionEvolutionProps {
  readonly size: number;
  /** When the storyboard starts, after the sprite has bounced in. */
  readonly delayMs: number;
  /** «Riduci movimento» (A7): only the adult, no light, flash or hop. */
  readonly reduceMotion: boolean;
}

/**
 * The evolution of the companion from puppy to adult (design-sezioni.md 6.6), with Reanimated.
 * The moment around it can be skipped with «Salta» or a touch.
 */
export function CompanionEvolution({ size, delayMs, reduceMotion }: CompanionEvolutionProps) {
  const { colors } = useTheme();
  const { middle, order } = useFrames();
  const adultIndex = middle.length + 1;
  const frame = useSharedValue(reduceMotion ? adultIndex : 0);
  const light = useSharedValue(0);
  const flash = useSharedValue(0);
  const greet = useSharedValue(0);
  const hop = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    const shapeStart = delayMs + EVOLUTION.lightMs;
    const shapeEnd = shapeStart + order.length * EVOLUTION.frameMs;
    const greetStart = shapeEnd + EVOLUTION.flashMs / 2;
    light.set(
      withDelay(
        delayMs,
        withSequence(
          withTiming(1, { duration: EVOLUTION.lightMs, easing: Easing.out(Easing.quad) }),
          withDelay(
            order.length * EVOLUTION.frameMs,
            withTiming(0, { duration: EVOLUTION.flashMs }),
          ),
        ),
      ),
    );
    frame.set(
      withDelay(
        shapeStart,
        withSequence(
          ...order.map((index, step) =>
            withDelay(step === 0 ? 0 : EVOLUTION.frameMs, withTiming(index, { duration: 0 })),
          ),
        ),
      ),
    );
    flash.set(
      withDelay(
        shapeEnd,
        withSequence(
          withTiming(1, { duration: EVOLUTION.flashMs / 2 }),
          withTiming(0, { duration: EVOLUTION.flashMs / 2 }),
        ),
      ),
    );
    greet.set(
      withDelay(
        greetStart,
        withSequence(
          withTiming(1, { duration: 0 }),
          withDelay(EVOLUTION.greetMs, withTiming(0, { duration: 0 })),
        ),
      ),
    );
    const half = EVOLUTION.greetMs / 4;
    hop.set(
      withDelay(
        greetStart,
        withSequence(
          withTiming(1, { duration: half, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: half, easing: Easing.in(Easing.quad) }),
          withTiming(1, { duration: half, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: half, easing: Easing.in(Easing.quad) }),
        ),
      ),
    );
  }, [delayMs, flash, frame, greet, hop, light, order, reduceMotion]);

  const lightStyle = useAnimatedStyle(() => ({
    opacity: light.get() * 0.6,
    transform: [{ scale: 0.6 + (EVOLUTION.lightScale - 0.6) * light.get() }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const hopStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -EVOLUTION.hopHeight * hop.get() }],
  }));
  const greetStyle = useAnimatedStyle(() => ({ opacity: greet.get() }));

  if (reduceMotion) {
    return (
      <View testID="moment-evolution" style={{ width: size, height: size }}>
        <View testID="moment-grow-to">
          <CompanionSprite stage="adult" mood="happy" size={size} />
        </View>
      </View>
    );
  }

  return (
    <View testID="moment-evolution" style={[styles.center, { width: size, height: size }]}>
      <Animated.View
        testID="moment-evolution-light"
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.light,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary },
          lightStyle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, hopStyle]}>
        <Frame index={0} frame={frame} testID="moment-grow-from">
          <CompanionSprite stage="baby" mood="happy" size={size} />
        </Frame>
        {middle.map((key, step) => (
          <Frame
            key={key}
            index={step + 1}
            frame={frame}
            testID={`moment-evolution-frame-${step + 1}`}
          >
            <EvolutionFrameSprite spriteKey={key} size={size} />
          </Frame>
        ))}
        <Frame index={adultIndex} frame={frame} greet={greet} testID="moment-grow-to">
          <CompanionSprite stage="adult" mood="happy" size={size} />
        </Frame>
        <Animated.View
          testID="moment-evolution-greet"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFill, styles.center, greetStyle]}
        >
          <CompanionSprite stage="adult" mood="cheering" size={size} />
        </Animated.View>
      </Animated.View>
      <Animated.View
        testID="moment-evolution-flash"
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: size / 2, backgroundColor: FLASH_COLOR },
          flashStyle,
        ]}
      />
    </View>
  );
}

/** An intermediate sprite (C15), hidden from the screen reader like the light. */
function EvolutionFrameSprite({ spriteKey, size }: { spriteKey: string; size: number }) {
  const { colors, family } = useTheme();
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Sprite
        spriteKey={spriteKey}
        size={size}
        label=""
        ink={family === 'minimal' ? colors.text : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  light: { position: 'absolute' },
});
