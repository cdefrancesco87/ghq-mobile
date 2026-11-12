import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { Frame } from '@/features/shared/Frame';
import { ThemedText } from '@/features/shared/ThemedText';
import { useReduceMotion } from '@/features/shared/useReduceMotion';
import { HERO_NAME_MAX_LENGTH } from '@/rules/config';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { OnboardingStep, StepButton } from './OnboardingStep';

const FIELD_HEIGHT = 48;
const SWING_DEGREES = 6;
const SWING_MS = 700;

/** The egg swings from side to side; with «Riduci movimento» it stays still (1.10). */
function SwingingEgg() {
  const reduceMotion = useReduceMotion();
  const rotation = useSharedValue(reduceMotion ? 0 : -SWING_DEGREES);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(rotation);
      rotation.set(0);
      return;
    }
    rotation.set(-SWING_DEGREES);
    rotation.set(withRepeat(withTiming(SWING_DEGREES, { duration: SWING_MS }), -1, true));
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  return (
    <Animated.View testID="onboarding-egg" style={style}>
      <CompanionSprite stage="egg" mood="normal" />
    </Animated.View>
  );
}

export interface NameStepProps {
  readonly name: string;
  readonly onChangeName: (name: string) => void;
  readonly onBack: () => void;
  readonly onContinue: () => void;
}

/** The only step that cannot be left empty; the keyboard is already open (1.3). */
export function NameStep({ name, onChangeName, onBack, onContinue }: NameStepProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const empty = name.trim() === '';
  const title = t('onboarding.name.title');

  return (
    <OnboardingStep
      name="name"
      title={title}
      art={<SwingingEgg />}
      onBack={onBack}
      footer={
        <StepButton
          testID="onboarding-continue"
          label={t('onboarding.continue')}
          onPress={onContinue}
          disabled={empty}
          disabledReason={t('onboarding.name.disabledReason')}
        />
      }
    >
      <View style={styles.form}>
        <View style={styles.field}>
          <Frame shape={SHAPES[family].control} fill={colors.surface} stroke={colors.textMuted} />
          <TextInput
            testID="onboarding-name"
            value={name}
            onChangeText={(text) => onChangeName(text.slice(0, HERO_NAME_MAX_LENGTH))}
            onSubmitEditing={empty ? undefined : onContinue}
            placeholder={t('onboarding.name.placeholder')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxLength={HERO_NAME_MAX_LENGTH}
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={title}
            style={[styles.input, textStyleOf(typography.body), { color: colors.text }]}
          />
        </View>
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('onboarding.name.hint')}
        </ThemedText>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: 20, gap: 8 },
  field: { minHeight: FIELD_HEIGHT, justifyContent: 'center' },
  input: { minHeight: FIELD_HEIGHT, paddingHorizontal: 16 },
});
