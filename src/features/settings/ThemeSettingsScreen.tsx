import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { setSetting, type SettingValue } from '@/db/repositories/settings';
import { announceOnIos } from '@/features/shared/announce';
import { Button } from '@/features/shared/Button';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemeCarousel } from '@/features/shared/ThemeCarousel';
import { useUndoToast } from '@/features/shared/UndoToast';
import { runAction } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useThemeStore } from '@/stores/theme';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The page of the theme (design-sezioni.md 10.3, mockup D03): the carousel of the first launch with
 * the chips of Minimal; the theme changes only with «Usa questo tema», then «Stessi dati, nuova
 * veste». Companion, names and progress stay.
 */
export function ThemeSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const current = useThemeStore((state) => state.theme);
  const heroName = useHeroStore((state) => state.hero?.name ?? '');
  const [chosen, setChosen] = useState<SettingValue<'theme'>>(current);

  const apply = () => {
    // Through `runAction`, so reminders, summaries, boss warnings and widgets take the words of
    // the new theme at once.
    runAction((db, clock) => setSetting(db, 'theme', chosen, clock.now));
    const message = t('settings.themeApplied');
    toast.show({ message });
    announceOnIos(message);
  };

  return (
    <View
      testID="settings-theme-screen"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        testID="settings-theme-header"
        title={t('settings.theme')}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemeCarousel value={chosen} onChange={setChosen} heroName={heroName} />
        <View style={styles.footer}>
          <Button
            testID="settings-theme-use"
            label={chosen === current ? t('settings.themeInUse') : t('settings.useTheme')}
            disabled={chosen === current}
            onPress={apply}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingTop: 8, paddingBottom: 48 },
  footer: { paddingHorizontal: 16 },
});
