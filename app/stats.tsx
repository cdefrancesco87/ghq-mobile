import { useLocalSearchParams } from 'expo-router';

import { MissionDetailScreen } from '@/features/stats/MissionDetailScreen';
import { StatsScreen } from '@/features/stats/StatsScreen';
import { useMissionDetail } from '@/features/stats/useMissionDetail';
import { useStarterStatsStep } from '@/features/stats/useStarterStatsStep';
import { useStatsView } from '@/features/stats/useStatsView';
import { useHeroStore } from '@/stores/hero';

/**
 * Statistics, a route of the stack opened from the Profile and from the hero card in Today
 * (decision of 08/11). With `missionId` it is the detail of a mission (design-sezioni.md 8.5).
 */
export default function Stats() {
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  return missionId === undefined ? <Overview /> : <Detail missionId={missionId} />;
}

function Overview() {
  useStarterStatsStep();
  const view = useStatsView();
  return view === null ? null : <StatsScreen view={view} />;
}

function Detail({ missionId }: { readonly missionId: string }) {
  const ready = useHeroStore((state) => state.hero !== null);
  const detail = useMissionDetail(missionId);
  return ready ? <MissionDetailScreen detail={detail} /> : null;
}
