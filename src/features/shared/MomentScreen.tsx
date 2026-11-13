import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { TITLE_KEYS } from '@/content/titles';
import { companionName } from '@/rules/companion';
import { useHeroStore } from '@/stores/hero';
import { useTheme } from '@/theme/ThemeProvider';
import { announceOnIos } from './announce';
import { Button } from './Button';
import { CompanionSprite } from './CompanionSprite';
import { iconXml, type IconName } from './icons';
import type { Moment } from './moments';
import { ThemedText } from './ThemedText';
import { MIN_TOUCH } from './touch';

/** The storyboards C2a–C5a: the screen dims, the emblem bounces in, the text comes last. */
const EMBLEM_DELAY_MS = 500;
const EMBLEM_GROW_MS = 230;
const EMBLEM_SETTLE_MS = 120;
const DETAIL_DELAY_MS = 1250;
const DETAIL_MS = 250;
/** With «Riduci movimento» only one fade (A7). */
const REDUCED_FADE_MS = 150;

const EMBLEM_SIZE = 140;
const EMBLEM_ICON_SIZE = 64;
/** The victory of the quest of the first launch is smaller than that of a boss (design 1.8). */
const EMBLEM_SIZE_SMALL = 96;
const EMBLEM_ICON_SIZE_SMALL = 44;
const LEVEL_FONT_SIZE = 96;
const SPRITE_SIZE = 160;
const EDGE = 16;

/** XP and coins of a victory count up from 0 while the reward appears (design-sezioni.md 5.5). */
const COUNT_MS = 800;
const COUNT_STEPS = 20;

const CONFETTI_DELAY_MS = 1000;
const CONFETTI_MS = 800;
const CONFETTI_STAGGER_MS = 40;
const CONFETTI_SIZE = 8;
/** Where the 8 sober pieces of confetti fall, as fractions of the width (C2b). */
const CONFETTI = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94] as const;

interface MomentTexts {
  readonly title: string;
  readonly detail?: string;
  /** What the screen reader says after the title, when it differs from the detail. */
  readonly spokenDetail?: string;
}

/**
 * A number that counts up from 0 to its value in `COUNT_MS`, once the detail is there. Without
 * `run` it is the value at once (Riduci movimento, A7).
 */
function useCountUp(value: number, run: boolean): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!run) {
      return undefined;
    }
    let count = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        count += 1;
        setStep(count);
        if (count >= COUNT_STEPS) {
          clearInterval(timer);
        }
      }, COUNT_MS / COUNT_STEPS);
    }, DETAIL_DELAY_MS);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [run]);
  return run ? Math.round((value * step) / COUNT_STEPS) : value;
}

function useMomentTexts(moment: Moment): MomentTexts {
  const { t } = useTranslation();
  const { family } = useTheme();
  const chosenName = useHeroStore((state) => state.companionName);
  switch (moment.kind) {
    case 'level_up':
      return {
        title: t('shared.moments.levelUp', {
          term: t('lexicon.level', { context: family }),
          level: moment.level,
        }),
        detail:
          moment.titleIndex === null
            ? undefined
            : t('shared.moments.newTitle', {
                title: t(`titles.${family}.${TITLE_KEYS[family][moment.titleIndex]}`),
              }),
      };
    case 'boss_defeated': {
      const values = {
        xp: moment.xp,
        xpTerm: t('lexicon.xp_pl', { context: family }),
        coins: moment.coins,
        coinsTerm: t('lexicon.coins_pl', { context: family }),
      };
      return {
        title: t('lexicon.victory', { context: family }),
        detail: t('shared.moments.reward', values),
        spokenDetail: t('shared.moments.rewardLabel', values),
      };
    }
    case 'hatch':
      return { title: t('shared.moments.hatched') };
    case 'companion_stage':
      return {
        title: t('shared.moments.companionGrown', {
          name: companionName(chosenName, t('lexicon.companion', { context: family })),
        }),
        detail: t(`shared.moments.companionStage.${moment.stage}`),
      };
    case 'badge':
      return { title: t('shared.moments.badge') };
  }
}

/** A circle in every theme (mockup D35B, storyboard C2c); smaller for the starter quest (1.8). */
function IconEmblem({
  name,
  small = false,
}: {
  readonly name: IconName;
  readonly small?: boolean;
}) {
  const { colors, family } = useTheme();
  const size = small ? EMBLEM_SIZE_SMALL : EMBLEM_SIZE;
  const icon = small ? EMBLEM_ICON_SIZE_SMALL : EMBLEM_ICON_SIZE;
  return (
    <View
      testID="moment-icon-emblem"
      style={[
        styles.iconEmblem,
        { width: size, height: size, borderRadius: size / 2 },
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <SvgXml xml={iconXml(name, family)} width={icon} height={icon} color={colors.coinsText} />
    </View>
  );
}

/** Before the adult, the previous stage: the puppy (design-sezioni.md 6.6). */
const PREVIOUS_STAGE = { baby: 'egg', adult: 'baby' } as const;
/** The puppy fades into the adult once the sprite has bounced in. */
const GROW_DELAY_MS = EMBLEM_DELAY_MS + EMBLEM_GROW_MS + EMBLEM_SETTLE_MS;
const GROW_FADE_MS = 600;

/**
 * The evolution (design-sezioni.md 6.6): a cross-fade between the two sprites, until the full
 * animation of T85. With «Riduci movimento» only the new stage.
 */
function GrowFade({
  stage,
  reduceMotion,
}: {
  readonly stage: 'baby' | 'adult';
  readonly reduceMotion: boolean;
}) {
  const grown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) {
      grown.set(withDelay(GROW_DELAY_MS, withTiming(1, { duration: GROW_FADE_MS })));
    }
  }, [grown, reduceMotion]);
  const fromStyle = useAnimatedStyle(() => ({ opacity: 1 - grown.get() }));
  const toStyle = useAnimatedStyle(() => ({ opacity: grown.get() }));
  return (
    <View style={styles.grow}>
      {reduceMotion ? null : (
        <Animated.View testID="moment-grow-from" style={[StyleSheet.absoluteFill, fromStyle]}>
          <CompanionSprite stage={PREVIOUS_STAGE[stage]} mood="happy" size={SPRITE_SIZE} />
        </Animated.View>
      )}
      <Animated.View testID="moment-grow-to" style={toStyle}>
        <CompanionSprite stage={stage} mood="happy" size={SPRITE_SIZE} />
      </Animated.View>
    </View>
  );
}

function Emblem({
  moment,
  reduceMotion,
}: {
  readonly moment: Moment;
  readonly reduceMotion: boolean;
}) {
  const { colors } = useTheme();
  switch (moment.kind) {
    case 'level_up':
      return (
        <ThemedText
          variant="display"
          color={colors.primary}
          numberOfLines={1}
          style={styles.levelNumber}
        >
          {moment.level}
        </ThemedText>
      );
    case 'boss_defeated':
      return <IconEmblem name="trofeo" small={moment.starter} />;
    case 'hatch':
      return <CompanionSprite stage="baby" mood="happy" size={SPRITE_SIZE} />;
    case 'companion_stage':
      return moment.stage === 'egg' ? (
        <CompanionSprite stage="egg" mood="happy" size={SPRITE_SIZE} />
      ) : (
        <GrowFade stage={moment.stage} reduceMotion={reduceMotion} />
      );
    case 'badge':
      return <IconEmblem name="badge" />;
  }
}

/** A piece of confetti: squares in Arcade and Cyberpunk, gold dust in Fantasy and Lovecraft. */
function Confetto({ index, fraction }: { readonly index: number; readonly fraction: number }) {
  const { colors, family } = useTheme();
  const { width, height } = useWindowDimensions();
  const fall = useSharedValue(0);
  const palette = [colors.primary, colors.done, colors.coins, colors.danger];
  const dust = family === 'fantasy' || family === 'lovecraft';

  useEffect(() => {
    fall.set(
      withDelay(
        CONFETTI_DELAY_MS + index * CONFETTI_STAGGER_MS,
        withTiming(1, { duration: CONFETTI_MS, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [fall, index]);

  const style = useAnimatedStyle(() => ({
    opacity: fall.get() === 0 ? 0 : 1 - fall.get(),
    transform: [{ translateY: (height / 2) * fall.get() }],
  }));

  return (
    <Animated.View
      testID="moment-particle"
      style={[
        styles.confetto,
        {
          left: width * fraction,
          backgroundColor: dust ? colors.coins : palette[index % palette.length],
          borderRadius: dust ? CONFETTI_SIZE / 2 : 0,
        },
        style,
      ]}
    />
  );
}

export interface MomentScreenProps {
  readonly moment: Moment;
  readonly reduceMotion: boolean;
  /** Goes to the next moment of the queue. */
  readonly onSkip: () => void;
  /** «Vedi il trofeo» of a victory: closes the moment and opens the defeated boss. */
  readonly onSeeTrophy?: (bossId: string) => void;
}

/**
 * A full-screen moment: a touch anywhere moves on (design-sezioni.md A7, mockup D35). A victory
 * counts its XP and coins up and offers «Vedi il trofeo» and «Continua» (5.5, mockup D23).
 */
export function MomentScreen({ moment, reduceMotion, onSkip, onSeeTrophy }: MomentScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const victory = moment.kind === 'boss_defeated' ? moment : null;
  const xp = useCountUp(victory?.xp ?? 0, victory !== null && !reduceMotion);
  const coins = useCountUp(victory?.coins ?? 0, victory !== null && !reduceMotion);
  const { title, detail: finalDetail, spokenDetail } = useMomentTexts(moment);
  // The reward on screen counts up; the screen reader hears the final values at once.
  const { detail } = useMomentTexts(victory === null ? moment : { ...victory, xp, coins });
  const spoken = spokenDetail ?? finalDetail;
  const label = spoken === undefined ? title : `${title}. ${spoken}`;
  // The small victory of the quest of the first launch: no confetti and no trophy (design 1.8).
  const small = victory?.starter === true;
  const trophyBossId = small ? null : (victory?.bossId ?? null);
  const emblemOpacity = useSharedValue(0);
  const emblemScale = useSharedValue(reduceMotion ? 1 : 0.6);
  const detailOpacity = useSharedValue(0);

  useEffect(() => announceOnIos(label), [label]);

  useEffect(() => {
    if (reduceMotion) {
      const fade = withTiming(1, { duration: REDUCED_FADE_MS });
      emblemOpacity.set(fade);
      detailOpacity.set(fade);
      return;
    }
    emblemOpacity.set(withDelay(EMBLEM_DELAY_MS, withTiming(1, { duration: EMBLEM_SETTLE_MS })));
    emblemScale.set(
      withDelay(
        EMBLEM_DELAY_MS,
        withSequence(
          withTiming(1.1, { duration: EMBLEM_GROW_MS, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: EMBLEM_SETTLE_MS }),
        ),
      ),
    );
    detailOpacity.set(withDelay(DETAIL_DELAY_MS, withTiming(1, { duration: DETAIL_MS })));
  }, [detailOpacity, emblemOpacity, emblemScale, reduceMotion]);

  const emblemStyle = useAnimatedStyle(() => ({
    opacity: emblemOpacity.get(),
    transform: [{ scale: emblemScale.get() }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: emblemOpacity.get(),
    transform: [{ scale: emblemScale.get() }],
  }));
  const detailStyle = useAnimatedStyle(() => ({ opacity: detailOpacity.get() }));

  return (
    <View style={styles.root}>
      {/* Only for the finger: the screen reader finds «Salta» and «Continua». */}
      <Pressable
        testID="moment-backdrop"
        onPress={onSkip}
        accessible={false}
        importantForAccessibility="no"
        style={StyleSheet.absoluteFill}
      />
      {moment.kind === 'boss_defeated' && !small && !reduceMotion
        ? CONFETTI.map((fraction, index) => (
            <Confetto key={fraction} index={index} fraction={fraction} />
          ))
        : null}
      <Pressable
        testID="moment-skip"
        onPress={onSkip}
        accessibilityRole="button"
        accessibilityLabel={t('shared.moments.skip')}
        style={[styles.skip, { top: top + EDGE }]}
      >
        <ThemedText color={colors.textMuted}>{t('shared.moments.skip')}</ThemedText>
      </Pressable>
      <View pointerEvents="none" style={styles.content}>
        <Animated.View testID={`moment-${moment.kind}`} style={emblemStyle}>
          <Emblem moment={moment} reduceMotion={reduceMotion} />
        </Animated.View>
        <Animated.View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={label}
          style={[styles.texts, titleStyle]}
        >
          <ThemedText variant={small ? 'screenTitle' : 'display'} style={styles.centered}>
            {title}
          </ThemedText>
          {detail === undefined ? null : (
            <Animated.View style={detailStyle}>
              <ThemedText color={colors.textMuted} style={styles.centered}>
                {detail}
              </ThemedText>
            </Animated.View>
          )}
        </Animated.View>
      </View>
      {trophyBossId === null || onSeeTrophy === undefined ? (
        <Button
          testID="moment-continue"
          label={t('shared.moments.continue')}
          onPress={onSkip}
          style={[styles.continue, { bottom: bottom + EDGE }]}
        />
      ) : (
        <View style={[styles.continue, styles.actions, { bottom: bottom + EDGE }]}>
          <Button
            testID="moment-trophy"
            label={t('shared.moments.seeTrophy')}
            onPress={() => onSeeTrophy(trophyBossId)}
          />
          <Pressable
            testID="moment-continue"
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t('shared.moments.continue')}
            style={styles.link}
          >
            <ThemedText variant="label" color={colors.primary}>
              {t('shared.moments.continue')}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: {
    position: 'absolute',
    right: EDGE,
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: EDGE,
  },
  texts: { alignItems: 'center', gap: 8 },
  centered: { textAlign: 'center' },
  grow: { width: SPRITE_SIZE, height: SPRITE_SIZE },
  levelNumber: { fontSize: LEVEL_FONT_SIZE, lineHeight: LEVEL_FONT_SIZE * 1.2 },
  iconEmblem: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confetto: {
    position: 'absolute',
    top: 0,
    width: CONFETTI_SIZE,
    height: CONFETTI_SIZE,
    pointerEvents: 'none',
  },
  continue: { position: 'absolute', left: EDGE, right: EDGE },
  actions: { gap: 8 },
  link: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
