import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/stores/app';
import { textStyleOf } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './icons';
import { NewTabButton } from './NewTabButton';

// The tab bar is the same in every theme: Today, Habits, [+], Goals, Statistics, Profile
// (analisi-funzionale.md, «Mappa dell'app»; design-sezioni.md A6).

const TABS: readonly { readonly name: string; readonly icon: IconName }[] = [
  { name: 'today', icon: 'today' },
  { name: 'habits', icon: 'habits' },
  { name: 'new', icon: 'new' },
  { name: 'goals', icon: 'goals' },
  { name: 'stats', icon: 'stats' },
  { name: 'profile', icon: 'profile' },
];

export function TabsLayout() {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const hasProfile = useAppStore((state) => state.hasProfile);

  // Without a profile the app is at its first launch.
  if (!hasProfile) {
    return <Redirect href="/onboarding" />;
  }
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: textStyleOf(typography.caption),
      }}
    >
      {TABS.map(({ name, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`nav.${name}`),
            tabBarIcon: ({ color }) => <Icon name={icon} color={color} />,
            ...(name === 'new' ? { tabBarButton: NewTabButton } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
