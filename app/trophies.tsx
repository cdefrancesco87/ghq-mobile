import { TrophyHallScreen } from '@/features/bosses/TrophyHallScreen';
import { useGoalsView } from '@/features/bosses/useGoalsView';

/** La Sala dei trofei, from Obiettivi («Vedi tutti») and from the Profile (design-sezioni.md 5.7). */
export default function Trophies() {
  const view = useGoalsView();
  return view === null ? null : <TrophyHallScreen trophies={view.trophies} />;
}
