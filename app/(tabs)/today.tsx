import { TodayScreen } from '@/features/today/TodayScreen';
import { useTodayView } from '@/features/today/useTodayView';

export default function Today() {
  const view = useTodayView();
  return view === null ? null : <TodayScreen view={view} />;
}
