import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';

import { TodayScreen } from '@/features/today/TodayScreen';
import { useTodayView } from '@/features/today/useTodayView';
import { useHighlightStore } from '@/stores/highlight';
import { getSession } from '@/stores/session';

/**
 * Today. `?notifications=1` (the link of the small widget, design 12.1) opens the sheet «Notifiche
 * recenti» when some notifications are not seen yet; `?mission=<id>` (the name of a mission in
 * the medium widget, design 12.2) gives the row of that mission a short highlight.
 */
export default function Today() {
  const view = useTodayView();
  const { notifications, mission } = useLocalSearchParams<{
    notifications?: string;
    mission?: string;
  }>();
  const handled = useCallback(() => {
    try {
      router.setParams({ notifications: undefined });
    } catch {
      // The navigation is not ready: the request is simply read once.
    }
  }, []);
  useEffect(() => {
    if (typeof mission !== 'string' || mission === '') {
      return;
    }
    useHighlightStore.getState().highlight(mission);
    try {
      router.setParams({ mission: undefined });
    } catch {
      // The navigation is not ready: the highlight is simply given once.
    }
  }, [mission]);
  return view === null ? null : (
    <TodayScreen
      view={view}
      tzOffset={getSession().clock().tzOffset}
      recentRequested={notifications === '1'}
      onRecentHandled={handled}
    />
  );
}
