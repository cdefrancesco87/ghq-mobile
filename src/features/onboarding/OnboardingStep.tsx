import { useEffect, type ComponentRef, type ReactNode, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, type ButtonProps } from '@/features/shared/Button';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { MAX_TITLE_SCALE, scaledTextHeight } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';

export const STEP_NAMES = ['language', 'name', 'theme', 'missions', 'notifications'] as const;
export type StepName = (typeof STEP_NAMES)[number];

/** The «Continua» of the first launch is higher than the other buttons (misure-componenti.md). */
const CONTINUE_HEIGHT = 56;
const SEGMENT_HEIGHT = 4;

/** The main button of a step. */
export function StepButton(props: ButtonProps) {
  return <Button {...props} style={styles.mainButton} />;
}

export interface OnboardingStepProps {
  readonly name: StepName;
  /** Under the indicator; a step that scrolls under its title writes it in `children`. */
  readonly title: string;
  readonly titleAlign?: 'center' | 'left';
  /** The height kept for the title, on a step where its font can change. */
  readonly titleMinHeight?: number;
  /** Shows the back arrow (from step 2). */
  readonly onBack?: () => void;
  /** Shows «Salta», which leaves the default choice. */
  readonly onSkip?: () => void;
  /** The buttons at the bottom, always above the keyboard. */
  readonly footer: ReactNode;
  /** Above the title, in the centre: logo or companion. */
  readonly art?: ReactNode;
  /** The scrolling body, for a step that brings its content back into view. */
  readonly bodyRef?: Ref<ComponentRef<typeof ScrollView>>;
  readonly children?: ReactNode;
}

/** A full-screen step: indicator with 5 segments, back arrow, «Salta», content and buttons (1.1). */
export function OnboardingStep({
  name,
  title,
  titleAlign = 'center',
  titleMinHeight,
  onBack,
  onSkip,
  footer,
  art,
  bodyRef,
  children,
}: OnboardingStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const position = STEP_NAMES.indexOf(name) + 1;
  const stepLabel = t('onboarding.stepLabel', {
    step: position,
    total: STEP_NAMES.length,
    name: t(`onboarding.steps.${name}`),
  });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(stepLabel);
  }, [stepLabel]);

  // The back button of Android follows the arrow; on the first step it leaves the app.
  useEffect(() => {
    if (onBack === undefined) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  return (
    <KeyboardAvoidingView
      testID="onboarding-step"
      behavior="padding"
      style={[styles.screen, { backgroundColor: colors.background, paddingTop: top }]}
    >
      {onBack === undefined && onSkip === undefined ? null : (
        <View style={styles.bar}>
          {onBack === undefined ? (
            <View />
          ) : (
            <Pressable
              testID="onboarding-back"
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={t('shared.back')}
              style={styles.back}
            >
              <Icon name="indietro" />
            </Pressable>
          )}
          {onSkip === undefined ? null : (
            <Button
              testID="onboarding-skip"
              variant="text"
              label={t('onboarding.skip')}
              onPress={onSkip}
            />
          )}
        </View>
      )}
      <View
        testID="onboarding-progress"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={stepLabel}
        accessibilityValue={{ min: 1, max: STEP_NAMES.length, now: position }}
        style={styles.segments}
      >
        {STEP_NAMES.map((step, index) => (
          <View
            key={step}
            testID={index < position ? 'onboarding-segment-on' : 'onboarding-segment-off'}
            style={[
              styles.segment,
              { backgroundColor: index < position ? colors.primary : colors.track },
            ]}
          />
        ))}
      </View>
      <ScrollView
        ref={bodyRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        {art === undefined ? null : <View style={styles.art}>{art}</View>}
        <View
          testID="onboarding-title"
          style={[
            styles.title,
            titleMinHeight === undefined
              ? null
              : { minHeight: scaledTextHeight(titleMinHeight, fontScale, MAX_TITLE_SCALE) },
          ]}
        >
          <ThemedText
            variant="screenTitle"
            accessibilityRole="header"
            style={{ textAlign: titleAlign }}
          >
            {title}
          </ThemedText>
        </View>
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  back: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingVertical: 8 },
  segment: { flex: 1, height: SEGMENT_HEIGHT, borderRadius: SEGMENT_HEIGHT / 2 },
  body: { flex: 1 },
  bodyContent: { paddingVertical: 16, gap: 16 },
  art: { alignItems: 'center', paddingTop: 16 },
  title: { paddingHorizontal: 16, justifyContent: 'center' },
  footer: { paddingHorizontal: 20, paddingTop: 8, gap: 4 },
  mainButton: { minHeight: CONTINUE_HEIGHT },
});
