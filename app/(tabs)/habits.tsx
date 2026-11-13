import { HabitsScreen } from '@/features/habits/HabitsScreen';
import { useHabitsView } from '@/features/habits/useHabitsView';

export default function Habits() {
  const view = useHabitsView();
  return view === null ? null : <HabitsScreen view={view} />;
}
