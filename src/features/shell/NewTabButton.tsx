import { useRouter } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import { useTheme } from '@/theme/ThemeProvider';

const SIZE = 56;

/** The [+] in the middle of the tab bar: a round button, a little raised, that opens the editor. */
export function NewTabButton({ style }: BottomTabBarButtonProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[style, styles.slot]}>
      <Pressable
        testID="tab-new"
        accessibilityRole="button"
        accessibilityLabel={t('nav.new')}
        onPress={() => router.push('/editor')}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Icon name="aggiungi" color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
});
