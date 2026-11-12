import { TodayScreen } from '@/features/today/TodayScreen';
import { useTodayView } from '@/features/today/useTodayView';
import { getSession } from '@/stores/session';

export default function Today() {
  const view = useTodayView();
  return view === null ? null : (
    <TodayScreen view={view} tzOffset={getSession().clock().tzOffset} />
  );
}
