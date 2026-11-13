import type { LiveActivityFactory } from 'expo-widgets';

import type { TimerActivityProps } from './timerActivity';

// Live Activities exist only on iPhone: the layout is in `GhqTimerActivity.ios.tsx`.

export const timerActivity: LiveActivityFactory<TimerActivityProps> | null = null;
