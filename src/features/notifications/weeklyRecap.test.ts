import { startPause } from '@/db/repositories/pause';
import { setSetting } from '@/db/repositories/settings';

import { FRIDAY, TZ, at, clockAt, newGame } from '../../../test/game';
import {
  WEEKLY_RECAP_ID,
  syncWeeklyRecap,
  type WeeklyRecapRequest,
  type WeeklyRecapScheduler,
} from './weeklyRecap';

/** The recap notifications of the system in memory, by identifier. */
class FakeWeekly implements WeeklyRecapScheduler {
  readonly pending = new Map<string, WeeklyRecapRequest>();
  schedule(request: WeeklyRecapRequest): Promise<void> {
    this.pending.set(request.id, request);
    return Promise.resolve();
  }
  cancel(id: string): Promise<void> {
    this.pending.delete(id);
    return Promise.resolve();
  }
}

const now = (day: number, hour: number) => ({ now: at(day, hour), tzOffset: TZ });

describe('syncWeeklyRecap (design 8.7, 10.6)', () => {
  it('schedules the next Sunday at 19:00, signed by the companion', async () => {
    const db = newGame(['journal']);
    const scheduler = new FakeWeekly();
    await syncWeeklyRecap(db, scheduler, now(FRIDAY, 18));
    expect([...scheduler.pending.values()]).toEqual([
      {
        id: WEEKLY_RECAP_ID,
        fireAt: at(8, 19),
        title: 'La tua settimana',
        body: 'Guarda cosa è andato bene in questi giorni.\n— Cloudy',
      },
    ]);
    await syncWeeklyRecap(db, scheduler, now(8, 20));
    expect(scheduler.pending.get(WEEKLY_RECAP_ID)?.fireAt).toBe(at(15, 19));
  });

  it('follows the day and the time of the Settings, and goes away when switched off', async () => {
    const db = newGame(['journal']);
    const scheduler = new FakeWeekly();
    setSetting(db, 'weekly_recap', { enabled: true, weekday: 1, time: '08:30' }, at(FRIDAY, 10));
    await syncWeeklyRecap(db, scheduler, now(FRIDAY, 10));
    expect(scheduler.pending.get(WEEKLY_RECAP_ID)?.fireAt).toBe(at(9, 8) + 30 * 60_000);
    setSetting(db, 'weekly_recap', { enabled: false, weekday: 1, time: '08:30' }, at(FRIDAY, 11));
    await syncWeeklyRecap(db, scheduler, now(FRIDAY, 11));
    expect(scheduler.pending.size).toBe(0);
  });

  it('skips the Sundays of a general pause', async () => {
    const db = newGame(['journal']);
    startPause(db, { fromDay: '2026-11-08', untilDay: '2026-11-10' }, clockAt(FRIDAY, 10));
    const scheduler = new FakeWeekly();
    await syncWeeklyRecap(db, scheduler, now(FRIDAY, 11));
    expect(scheduler.pending.get(WEEKLY_RECAP_ID)?.fireAt).toBe(at(15, 19));
  });
});
