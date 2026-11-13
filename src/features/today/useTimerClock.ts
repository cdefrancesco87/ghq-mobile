import { useEffect, useRef, useState } from 'react';

import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { TIMER } from '@/rules/config';
import { getSession } from '@/stores/session';
import { timerStateOf } from './missionText';

function clockNow(): number {
  return getSession().clock().now;
}

/**
 * The clock of the timers of Today (design 2.5, T79): it ticks every second while a timer runs and
 * finishes each timer that reached the end, once, also at the opening of the app after the end.
 * Returns the instant to draw the countdowns with.
 */
export function useTimerClock(
  view: TodayView | null,
  finish: (item: TodayMission) => void,
): number {
  const [now, setNow] = useState(clockNow);
  const running = (view?.missions ?? []).filter((item) => item.timerStartedAt !== null);
  const anyRunning = running.length > 0;
  // The timers already finished: a failure is told once, not at every tick.
  const finished = useRef(new Set<string>());

  useEffect(() => {
    if (!anyRunning) {
      return undefined;
    }
    // Until the first tick a countdown shows the whole time missing (timerRemainingMs).
    const id = setInterval(() => setNow(clockNow()), TIMER.tickMs);
    return () => clearInterval(id);
  }, [anyRunning]);

  useEffect(() => {
    for (const item of running) {
      const key = `${item.mission.id}:${item.timerStartedAt}`;
      const timer = timerStateOf(item, clockNow());
      if (timer !== null && timer.remainingMs <= 0 && !finished.current.has(key)) {
        finished.current.add(key);
        finish(item);
      }
    }
    // `running` follows `view`; `finish` is a new function at every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, view]);

  return now;
}
