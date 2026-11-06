import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { textStyleOf } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export interface ScreenPlaceholderProps {
  /** Key of the translated title, in the `nav` group of the language files. */
  readonly titleKey: string;
}

/** A screen that is not built yet: the translated title, in the colours of the theme. */
export function ScreenPlaceholder({ titleKey }: ScreenPlaceholderProps) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text
        accessibilityRole="header"
        style={[textStyleOf(typography.screenTitle), { color: colors.text }]}
      >
        {t(`nav.${titleKey}`)}
      </Text>
      <Text style={[textStyleOf(typography.body), { color: colors.textMuted }]}>
        {t('nav.placeholder')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
});
