import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/features/shell/ScreenPlaceholder';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { useStatsView } from '@/features/stats/useStatsView';

/**
 * Statistics, a route of the stack opened from the Profile and from the hero card in Today
 * (decision of 08/11). With `missionId` it is the detail of a mission, still a placeholder (T53).
 */
export default function Stats() {
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  const view = useStatsView();
  if (missionId !== undefined) {
    return <ScreenPlaceholder titleKey="stats" />;
  }
  return view === null ? null : <StatsScreen view={view} />;
}
