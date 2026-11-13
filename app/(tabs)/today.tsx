import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { TodayScreen } from '@/features/today/TodayScreen';
import { useTodayView } from '@/features/today/useTodayView';
import { getSession } from '@/stores/session';

/**
 * Today. `?notifications=1` (the link of the small widget, design 12.1) opens the sheet «Notifiche
 * recenti» when some notifications are not seen yet.
 */
export default function Today() {
  const view = useTodayView();
  const { notifications } = useLocalSearchParams<{ notifications?: string }>();
  const handled = useCallback(() => {
    try {
      router.setParams({ notifications: undefined });
    } catch {
      // The navigation is not ready: the request is simply read once.
    }
  }, []);
  return view === null ? null : (
    <TodayScreen
      view={view}
      tzOffset={getSession().clock().tzOffset}
      recentRequested={notifications === '1'}
      onRecentHandled={handled}
    />
  );
}
