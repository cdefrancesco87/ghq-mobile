import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { renameCompanion } from '@/db/repositories/companion';
import { companionName } from '@/rules/companion';
import { COMPANION } from '@/rules/config';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { announceOnIos } from './announce';
import { Button } from './Button';
import { CompanionSprite } from './CompanionSprite';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';
import { MIN_TOUCH } from './touch';

/** The storyboard C3: the egg wobbles, opens at 1.1 s, the puppy jumps out, the name at 2 s. */
const WOBBLE_MS = 150;
const WOBBLE_TIMES = 3;
const WOBBLE_DEGREES = 10;
const OPEN_MS = 1100;
const OPEN_FADE_MS = 100;
const PUPPY_MS = 1500;
const JUMP_MS = 300;
const FORM_MS = 2000;
const FORM_FADE_MS = 250;
/** With «Riduci movimento»: one fade between the egg and the puppy with the sentence (1.10). */
const REDUCED_FADE_MS = 150;

const SPRITE_SIZE = 160;
const FIELD_HEIGHT = 56;
const EDGE = 16;

export interface HatchMomentProps {
  readonly reduceMotion: boolean;
  /** Closes the moment: the name typed is already saved. */
  readonly onDone: () => void;
}

/**
 * The hatching of the egg at the first completion (design-sezioni.md 1.8, 6.5, storyboard C3):
 * the egg wobbles and opens, the puppy greets, then «È nato!» with the name to choose or to
 * confirm. «Salta» keeps the name it has.
 */
export function HatchMoment({ reduceMotion, onDone }: HatchMomentProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const chosen = useHeroStore((state) => state.companionName);
  const themeDefault = t('lexicon.companion', { context: family });
  const [draft, setDraft] = useState(() => companionName(chosen, themeDefault));
  const egg = useSharedValue(1);
  const tilt = useSharedValue(0);
  const puppy = useSharedValue(0);
  const jump = useSharedValue(0);
  const form = useSharedValue(0);
  const title = t('shared.moments.hatched');

  useEffect(() => announceOnIos(title), [title]);

  useEffect(() => {
    if (reduceMotion) {
      const fade = withTiming(1, { duration: REDUCED_FADE_MS });
      egg.set(withTiming(0, { duration: REDUCED_FADE_MS }));
      puppy.set(fade);
      form.set(fade);
      return;
    }
    tilt.set(
      withSequence(
        withRepeat(
          withSequence(
            withTiming(WOBBLE_DEGREES, { duration: WOBBLE_MS }),
            withTiming(-WOBBLE_DEGREES, { duration: WOBBLE_MS }),
          ),
          WOBBLE_TIMES,
        ),
        withTiming(0, { duration: WOBBLE_MS }),
      ),
    );
    egg.set(withDelay(OPEN_MS, withTiming(0, { duration: OPEN_FADE_MS })));
    puppy.set(withDelay(PUPPY_MS, withTiming(1, { duration: OPEN_FADE_MS })));
    jump.set(
      withDelay(
        PUPPY_MS,
        withSequence(
          withTiming(-24, { duration: JUMP_MS / 2, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: JUMP_MS / 2, easing: Easing.in(Easing.quad) }),
        ),
      ),
    );
    form.set(withDelay(FORM_MS, withTiming(1, { duration: FORM_FADE_MS })));
  }, [egg, form, jump, puppy, reduceMotion, tilt]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: egg.get(),
    transform: [{ rotate: `${tilt.get()}deg` }],
  }));
  const puppyStyle = useAnimatedStyle(() => ({
    opacity: puppy.get(),
    transform: [{ translateY: jump.get() }],
  }));
  const formStyle = useAnimatedStyle(() => ({ opacity: form.get() }));

  const confirm = () => {
    try {
      runAction((db, clock) => renameCompanion(db, draft, themeDefault, clock));
    } catch {
      // The field never takes more than the limit; a name that cannot be saved stays as it was.
    }
    onDone();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      {/* Only for the finger: a touch outside the field closes the keyboard. */}
      <Pressable
        testID="moment-backdrop"
        onPress={Keyboard.dismiss}
        accessible={false}
        importantForAccessibility="no"
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        testID="moment-skip"
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={t('shared.moments.skip')}
        style={[styles.skip, { top: top + EDGE }]}
      >
        <ThemedText color={colors.textMuted}>{t('shared.moments.skip')}</ThemedText>
      </Pressable>
      <View style={styles.content} pointerEvents="box-none">
        <View testID="moment-hatch" style={styles.stage} pointerEvents="none">
          <Animated.View testID="moment-hatch-egg" style={[styles.layer, eggStyle]}>
            <CompanionSprite stage="egg" mood="happy" size={SPRITE_SIZE} />
          </Animated.View>
          <Animated.View testID="moment-hatch-puppy" style={[styles.layer, puppyStyle]}>
            <CompanionSprite stage="baby" mood="happy" size={SPRITE_SIZE} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.form, formStyle]}>
          <ThemedText
            variant="display"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.centered}
          >
            {title}
          </ThemedText>
          <View style={styles.field}>
            <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
            <TextInput
              testID="moment-hatch-name"
              value={draft}
              onChangeText={(text) => setDraft(text.slice(0, COMPANION.nameMaxLength))}
              onSubmitEditing={confirm}
              placeholder={t('shared.moments.hatchName')}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              maxLength={COMPANION.nameMaxLength}
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={t('companion.nameLabel')}
              accessibilityHint={t('companion.nameHint', { max: COMPANION.nameMaxLength })}
              style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
            />
          </View>
        </Animated.View>
      </View>
      <Button
        testID="moment-continue"
        label={t('shared.moments.hatchConfirm')}
        onPress={confirm}
        style={[styles.continue, { bottom: bottom + EDGE }]}
      />
    </KeyboardAvoidingView>
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
    zIndex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: EDGE,
  },
  stage: { width: SPRITE_SIZE, height: SPRITE_SIZE },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { alignSelf: 'stretch', alignItems: 'center', gap: 16 },
  centered: { textAlign: 'center' },
  field: { alignSelf: 'stretch', minHeight: FIELD_HEIGHT, justifyContent: 'center' },
  input: { minHeight: FIELD_HEIGHT, paddingHorizontal: 16, textAlign: 'center' },
  continue: { position: 'absolute', left: EDGE, right: EDGE },
});
