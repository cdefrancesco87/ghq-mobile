import { GoalsScreen } from '@/features/bosses/GoalsScreen';
import { useGoalsView } from '@/features/bosses/useGoalsView';

export default function Goals() {
  const view = useGoalsView();
  return view === null ? null : <GoalsScreen view={view} />;
}
