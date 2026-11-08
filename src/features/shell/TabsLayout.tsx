import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/features/shared/Icon';
import type { IconName } from '@/features/shared/icons';
import { useAppStore } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';
import { NavLabel } from './NavLabel';
import { NewTabButton } from './NewTabButton';

// The tab bar: Today, Habits, [+], Goals, Profile. Statistics is a stack route accessible
// from the Profile screen (design decision 08/11).

const TABS: readonly { readonly name: string; readonly icon: IconName }[] = [
  { name: 'today', icon: 'oggi' },
  { name: 'habits', icon: 'abitudini' },
  { name: 'new', icon: 'nuovo' },
  { name: 'goals', icon: 'boss' },
  { name: 'profile', icon: 'profilo' },
];

export function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
      }}
    >
      {TABS.map(({ name, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: t(`nav.${name}`),
            tabBarButtonTestID: `tab-${name}`,
            tabBarAccessibilityLabel: t(`nav.${name}`),
            tabBarLabel: ({ color, children }) => <NavLabel color={color}>{children}</NavLabel>,
            tabBarIcon: ({ color }) => <Icon name={icon} color={color} />,
            ...(name === 'new' ? { tabBarButton: NewTabButton } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
