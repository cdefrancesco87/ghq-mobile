import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { Logo } from '@/features/shared/Logo';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { LANGUAGE_NAMES, type Language } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { OnboardingStep, StepButton } from './OnboardingStep';

const LOGO_HEIGHT = 56;
const ROW_HEIGHT = 56;
const LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[];

/** The language of the phone is already selected; a tap changes every text at once (1.2). */
export function LanguageStep({ onContinue }: { readonly onContinue: () => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const selected = useSettingsStore((state) => state.settings.language);

  const choose = (language: Language) => {
    useSettingsStore.getState().update('language', language);
    void i18n.changeLanguage(language);
  };

  return (
    <OnboardingStep
      name="language"
      title={t('onboarding.language.title')}
      art={<Logo variant="mark" height={LOGO_HEIGHT} />}
      footer={
        <StepButton
          testID="onboarding-continue"
          label={t('onboarding.continue')}
          onPress={onContinue}
        />
      }
    >
      <Card style={styles.list}>
        <View accessibilityRole="radiogroup">
          {LANGUAGES.map((language, index) => (
            <Pressable
              key={language}
              testID={`onboarding-language-${language}`}
              onPress={() => choose(language)}
              accessibilityRole="radio"
              accessibilityLabel={LANGUAGE_NAMES[language]}
              accessibilityState={{ selected: language === selected }}
              style={[
                styles.row,
                index === 0 ? null : { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
            >
              <ThemedText>{LANGUAGE_NAMES[language]}</ThemedText>
              {language === selected ? <Icon name="completa" color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </Card>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: 16, paddingVertical: 0 },
  row: {
    minHeight: Math.max(ROW_HEIGHT, MIN_TOUCH),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
