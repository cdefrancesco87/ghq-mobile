import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { useSettingsStore } from '@/stores/settings';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors, ThemeFamily } from '@/theme/themes';
import { announceOnIos } from './announce';
import { doneGlyph, Glyph, STAR } from './CompletionControl';
import { cutFramePath, Frame } from './Frame';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';
import { useReduceMotion } from './useReduceMotion';

/** The storyboard C1: the effect peaks at 150 ms, the coins arrive at 300 ms. */
const PEAK_MS = 150;
const COINS_ARRIVE_MS = 300;
const FADE_MS = 150;
/** How long the gain stays on screen, so that it can be read. */
export const CELEBRATION_MS = 1000;

const COIN_COUNT = 3;
const COIN_STAGGER_MS = 20;
const COIN_SIZE = 8;
const EFFECT_SIZE = 96;
const EFFECT_CENTER = EFFECT_SIZE / 2;
const SEAL_SIZE = 28;
const EDGE = 16;

/** How much the effect of the theme spreads from the control. */
const EFFECT_SCALE: Readonly<Record<ThemeFamily, number>> = {
  minimal: 2,
  arcade: 1,
  fantasy: 1.4,
  cyberpunk: 1,
  lovecraft: 2.2,
};

const PIXELS = [
  [24, 24],
  [46, 20],
  [68, 24],
  [20, 46],
  [72, 46],
  [24, 68],
  [46, 72],
  [68, 68],
] as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface CelebrationRequest {
  readonly xp: number;
  readonly coins: number;
  /** The centre of the control that was touched, in screen coordinates. */
  readonly origin: Point;
  /** Where the coins fly: the hero card; the top of the screen when missing. */
  readonly target?: Point;
  /** What the screen reader says (design 2.11); the gains when missing. */
  readonly label?: string;
  /** The text of the chip in place of the gains, e.g. «Goditi!» for a reward (design 7.6). */
  readonly chipText?: string;
  /** The screen reader hears it from another element (a toast): the chip says nothing. */
  readonly silent?: boolean;
}

interface CelebrationApi {
  /** Starts at once, in the same cycle as the touch: the gains appear within 300 ms (US-OGGI-03). */
  readonly celebrate: (request: CelebrationRequest) => void;
}

interface Burst extends CelebrationRequest {
  readonly id: number;
}

const CelebrationContext = createContext<CelebrationApi | null>(null);

/** Gives `useCelebration` to the screens and draws the celebrations above them. */
export function CelebrationProvider({ children }: { readonly children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const [bursts, setBursts] = useState<readonly Burst[]>([]);
  const nextId = useRef(0);

  const api = useMemo<CelebrationApi>(
    () => ({
      celebrate: (request) => {
        // «Vibrazioni» of the Settings (design 10.7), read at the touch. A phone that cannot
        // vibrate refuses: the celebration goes on without.
        if (useSettingsStore.getState().settings.vibrations) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
        nextId.current += 1;
        const id = nextId.current;
        setBursts((current) => [...current, { ...request, id }]);
      },
    }),
    [],
  );
  const remove = useCallback((id: number) => {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  }, []);

  return (
    <CelebrationContext value={api}>
      <View style={styles.root}>
        {children}
        {bursts.length === 0 ? null : (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {bursts.map((burst) => (
              <CelebrationBurst
                key={burst.id}
                burst={burst}
                reduceMotion={reduceMotion}
                onDone={remove}
              />
            ))}
          </View>
        )}
      </View>
    </CelebrationContext>
  );
}

/** «+25 XP», coins to the hero card, the sign of the theme and a light vibration (A7). */
export function useCelebration(): CelebrationApi {
  const api = useContext(CelebrationContext);
  if (api === null) {
    throw new Error('useCelebration must be used inside a CelebrationProvider');
  }
  return api;
}

function CelebrationBurst({
  burst,
  reduceMotion,
  onDone,
}: {
  readonly burst: Burst;
  readonly reduceMotion: boolean;
  readonly onDone: (id: number) => void;
}) {
  const { width } = useWindowDimensions();
  const { top } = useSafeAreaInsets();
  const { id, origin, coins } = burst;
  const target = burst.target ?? { x: width - EFFECT_SIZE, y: top + EFFECT_SIZE };

  useEffect(() => {
    const timer = setTimeout(() => onDone(id), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, [id, onDone]);

  return (
    <>
      {reduceMotion ? null : (
        <>
          <CheckEffect origin={origin} />
          {coins > 0
            ? Array.from({ length: COIN_COUNT }, (_, index) => (
                <FlyingCoin key={index} index={index} origin={origin} target={target} />
              ))
            : null}
        </>
      )}
      <GainChip burst={burst} reduceMotion={reduceMotion} />
    </>
  );
}

/** The shapes of the theme around the control: simple forms, no new assets. */
function themeEffect(family: ThemeFamily, colors: ThemeColors) {
  const center = EFFECT_CENTER - SEAL_SIZE / 2;
  switch (family) {
    case 'minimal':
      return (
        <Circle
          cx={EFFECT_CENTER}
          cy={EFFECT_CENTER}
          r={14}
          fill="none"
          stroke={colors.done}
          strokeWidth={2}
        />
      );
    case 'arcade':
      return (
        <>
          <Rect x={center} y={center} width={SEAL_SIZE} height={SEAL_SIZE} fill={colors.coins} />
          {PIXELS.map(([x, y]) => (
            <Rect key={`${x}-${y}`} x={x} y={y} width={4} height={4} fill={colors.coins} />
          ))}
        </>
      );
    case 'fantasy':
      return <Circle cx={EFFECT_CENTER} cy={EFFECT_CENTER} r={22} fill={colors.coins} />;
    case 'cyberpunk':
      return (
        <>
          <G x={center - 4} y={center}>
            <Path
              d={cutFramePath(SEAL_SIZE, SEAL_SIZE, 6, 1)}
              fill="none"
              stroke={colors.info}
              strokeWidth={2}
            />
          </G>
          <G x={center + 4} y={center}>
            <Path
              d={cutFramePath(SEAL_SIZE, SEAL_SIZE, 6, 1)}
              fill="none"
              stroke={colors.danger}
              strokeWidth={2}
            />
          </G>
          <Rect x={0} y={EFFECT_CENTER} width={EFFECT_SIZE} height={2} fill={colors.coins} />
        </>
      );
    case 'lovecraft':
      return (
        <G x={center} y={center}>
          <Path d={STAR} fill={colors.danger} />
        </G>
      );
  }
}

function clockTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

/** The sign that gives in by 10% and comes back, with the effect of the theme around it (C1). */
function CheckEffect({ origin }: { readonly origin: Point }) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const [time] = useState(clockTime);
  const signScale = useSharedValue(0.9);
  const signOpacity = useSharedValue(1);
  const effectScale = useSharedValue(1);
  const effectOpacity = useSharedValue(0.8);
  const flickers = family === 'arcade' || family === 'cyberpunk';

  useEffect(() => {
    signScale.set(withDelay(PEAK_MS, withTiming(1, { duration: FADE_MS })));
    signOpacity.set(withDelay(COINS_ARRIVE_MS, withTiming(0, { duration: FADE_MS })));
    effectScale.set(
      withTiming(EFFECT_SCALE[family], { duration: PEAK_MS, easing: Easing.out(Easing.quad) }),
    );
    effectOpacity.set(
      flickers
        ? withSequence(
            withTiming(0.2, { duration: PEAK_MS / 3 }),
            withTiming(0.9, { duration: PEAK_MS / 3 }),
            withDelay(PEAK_MS, withTiming(0, { duration: FADE_MS })),
          )
        : withDelay(PEAK_MS, withTiming(0, { duration: FADE_MS })),
    );
  }, [effectOpacity, effectScale, family, flickers, signOpacity, signScale]);

  const signStyle = useAnimatedStyle(() => ({
    opacity: signOpacity.get(),
    transform: [{ scale: signScale.get() }],
  }));
  const effectStyle = useAnimatedStyle(() => ({
    opacity: effectOpacity.get(),
    transform: [{ scale: effectScale.get() }],
  }));
  const timestampStyle = useAnimatedStyle(() => ({ opacity: effectOpacity.get() }));
  const place = { left: origin.x - EFFECT_CENTER, top: origin.y - EFFECT_CENTER };

  return (
    <View
      testID="celebration-effect"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.effect, place]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, effectStyle]}>
        <Svg width={EFFECT_SIZE} height={EFFECT_SIZE} viewBox={`0 0 ${EFFECT_SIZE} ${EFFECT_SIZE}`}>
          {themeEffect(family, colors)}
        </Svg>
      </Animated.View>
      <Animated.View style={signStyle}>
        <Glyph>{doneGlyph(family, colors)}</Glyph>
      </Animated.View>
      {family === 'cyberpunk' ? (
        <Animated.View style={[styles.timestamp, timestampStyle]}>
          <ThemedText variant="caption" color={colors.infoText} numberOfLines={1}>
            {t('shared.celebration.timestamp', { time })}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function FlyingCoin({
  index,
  origin,
  target,
}: {
  readonly index: number;
  readonly origin: Point;
  readonly target: Point;
}) {
  const { colors, family } = useTheme();
  const progress = useSharedValue(0);
  const square = family === 'arcade' || family === 'cyberpunk';

  useEffect(() => {
    const stagger = index * COIN_STAGGER_MS;
    progress.set(
      withDelay(
        PEAK_MS + stagger,
        withTiming(1, {
          duration: COINS_ARRIVE_MS - PEAK_MS - stagger,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );
  }, [index, progress]);

  const flight = useAnimatedStyle(() => {
    const travelled = progress.get();
    return {
      opacity: travelled === 0 || travelled === 1 ? 0 : 1,
      transform: [
        { translateX: (target.x - origin.x) * travelled },
        { translateY: (target.y - origin.y) * travelled },
      ],
    };
  });

  return (
    <Animated.View
      testID="celebration-coin"
      style={[
        styles.coin,
        {
          left: origin.x - COIN_SIZE / 2,
          top: origin.y - COIN_SIZE / 2,
          backgroundColor: colors.coins,
          borderRadius: square ? 0 : COIN_SIZE / 2,
        },
        flight,
      ]}
    />
  );
}

/**
 * Beside the control (mockup D08). Comes with a fade: at once with «Riduci movimento», otherwise
 * at the peak of the effect.
 */
function GainChip({
  burst,
  reduceMotion,
}: {
  readonly burst: Burst;
  readonly reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { width } = useWindowDimensions();
  const { xp, coins, origin } = burst;
  const opacity = useSharedValue(0);
  const xpTerm = t('lexicon.xp_pl', { context: family });
  const gain = t('shared.celebration.xp', { xp, xpTerm });
  const coinGain = t('shared.celebration.coins', { coins });
  const label =
    burst.label ??
    (coins > 0
      ? t('shared.celebration.label', {
          gain,
          coins,
          coinsTerm: t('lexicon.coins_pl', { context: family }),
        })
      : gain);

  const silent = burst.silent === true;
  useEffect(() => {
    if (!silent) {
      announceOnIos(label);
    }
  }, [label, silent]);

  useEffect(() => {
    const fadeIn = withTiming(1, { duration: FADE_MS });
    opacity.set(
      withSequence(
        reduceMotion ? fadeIn : withDelay(PEAK_MS, fadeIn),
        withDelay(
          CELEBRATION_MS - FADE_MS * 2 - (reduceMotion ? 0 : PEAK_MS),
          withTiming(0, { duration: FADE_MS }),
        ),
      ),
    );
  }, [opacity, reduceMotion]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      testID="celebration-chip"
      accessible={!silent}
      accessibilityRole={silent ? undefined : 'alert'}
      accessibilityLiveRegion={silent ? 'none' : 'polite'}
      importantForAccessibility={silent ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={silent}
      accessibilityLabel={silent ? undefined : label}
      style={[
        styles.chip,
        { top: origin.y, right: Math.max(EDGE, width - origin.x + SEAL_SIZE / 2) },
        fade,
      ]}
    >
      <Frame shape={SHAPES[family].control} fill={colors.surfaceHigh} stroke={colors.border} />
      <ThemedText variant="label" color={colors.doneText} numberOfLines={1}>
        {burst.chipText ?? (coins > 0 ? `${gain} · ${coinGain}` : gain)}
      </ThemedText>
      {coins > 0 ? <Icon name="moneta" size={16} color={colors.coinsText} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  effect: {
    position: 'absolute',
    width: EFFECT_SIZE,
    height: EFFECT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: { position: 'absolute', top: EFFECT_SIZE - 16, alignSelf: 'center' },
  coin: { position: 'absolute', width: COIN_SIZE, height: COIN_SIZE },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    transform: [{ translateY: '-50%' }],
  },
});
