import { completeMission, skipMission } from '@/db/repositories/completion';
import { deleteMission, updateMission } from '@/db/repositories/missions';
import { recentNotifications, unseenNotificationCount } from '@/db/repositories/appNotifications';
import { resumePause, startPause } from '@/db/repositories/pause';
import { renameCompanion } from '@/db/repositories/companion';
import { setSetting } from '@/db/repositories/settings';
import type { Db } from '@/db/types';

import { FRIDAY, TZ, at, clockAt, missionId, newGame } from '../../../test/game';
import { syncEveningSummary, type SummaryRequest, type SummaryScheduler } from './evening';

/** The summaries of the system in memory, by identifier. */
class FakeSummary implements SummaryScheduler {
  readonly pending = new Map<string, SummaryRequest>();
  schedule(request: SummaryRequest): Promise<void> {
    this.pending.set(request.id, request);
    return Promise.resolve();
  }
  cancel(id: string): Promise<void> {
    this.pending.delete(id);
    return Promise.resolve();
  }
}

const KEYS = ['journal', 'healthy_meal', 'bed_by_eleven', 'read_pages', 'run'];
const NAMES = ['Journal', 'Meal', 'Bed', 'Read', 'Run'];
const NOW = at(FRIDAY, 20);
const SYNC = { now: NOW, tzOffset: TZ };

function setUp(count: number) {
  const db = newGame(KEYS.slice(0, count));
  const ids = KEYS.slice(0, count).map((key) => missionId(db, key));
  ids.forEach((id, index) => updateMission(db, id, { name: NAMES[index] }, clockAt(FRIDAY, 9)));
  return { db, ids, scheduler: new FakeSummary() };
}

function complete(db: Db, id: string) {
  completeMission(db, { missionId: id, source: 'app', idemKey: `app:${id}`, ...SYNC });
}

describe('syncEveningSummary (design 11.5)', () => {
  it('lists the 2 missions left at 21:00 of today', async () => {
    const { db, scheduler } = setUp(2);
    await syncEveningSummary(db, scheduler, SYNC);
    expect([...scheduler.pending.values()]).toEqual([
      {
        id: 'evening-summary:2026-11-06',
        fireAt: at(FRIDAY, 21),
        title: 'Cloudy',
        body: 'La giornata non è finita: Journal, Meal. Bastano due minuti.',
      },
    ]);
  });

  it('names 3 of 5 missions left and counts the others', async () => {
    const { db, scheduler } = setUp(5);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')?.body).toBe(
      'La giornata non è finita: Journal, Meal, Bed e altre 2. Bastano due minuti.',
    );
  });

  it('becomes the compliment after the last completion (0 left)', async () => {
    const { db, ids, scheduler } = setUp(2);
    await syncEveningSummary(db, scheduler, SYNC);
    ids.forEach((id) => complete(db, id));
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')).toMatchObject({
      title: 'Cloudy',
      body: 'Tutto fatto per oggi, Claudio. Che giornata!',
    });
  });

  it('leaves out the skipped missions', async () => {
    const { db, ids, scheduler } = setUp(3);
    skipMission(db, { missionId: ids[0], reason: 'travel', ...SYNC });
    complete(db, ids[1]);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')?.body).toBe(
      "Ancora 1 da fare: Bed. C'è tempo!",
    );
  });

  it('signs the summary with the name given to the companion, in the voice of the theme', async () => {
    const { db, ids, scheduler } = setUp(2);
    setSetting(db, 'theme', 'arcade', NOW);
    renameCompanion(db, 'Bit', 'Pixel', SYNC);
    complete(db, ids[0]);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')).toMatchObject({
      title: 'Bit',
      body: "Bip! Ancora 1 da fare: Meal. C'è tempo!",
    });
  });

  it('follows the time and the switch of the Settings', async () => {
    const { db, scheduler } = setUp(2);
    setSetting(db, 'evening_summary', { enabled: true, time: '22:30' }, NOW);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')?.fireAt).toBe(at(FRIDAY, 22, 30));
    setSetting(db, 'evening_summary', { enabled: false, time: '22:30' }, NOW);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(0);
  });

  it('schedules nothing once the time has passed or with no mission', async () => {
    const late = setUp(2);
    await syncEveningSummary(late.db, late.scheduler, { now: at(FRIDAY, 21, 5), tzOffset: TZ });
    expect(late.scheduler.pending.size).toBe(0);
    const empty = setUp(1);
    deleteMission(empty.db, empty.ids[0], SYNC);
    await syncEveningSummary(empty.db, empty.scheduler, SYNC);
    expect(empty.scheduler.pending.size).toBe(0);
  });

  it('writes the summary among the recent notifications for its time, and only once sent', async () => {
    const { db, ids, scheduler } = setUp(2);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(unseenNotificationCount(db, at(FRIDAY, 21))).toBe(1);
    // All done before 21:00: the text changes, the row with it.
    ids.forEach((id) => complete(db, id));
    await syncEveningSummary(db, scheduler, SYNC);
    const view = recentNotifications(db, { now: at(FRIDAY, 22), tzOffset: TZ });
    expect(view.items.map((item) => [item.kind, item.time, item.params.title])).toEqual([
      ['summary', '21:00', 'Cloudy'],
    ]);
    // Switched off before it fires: it was never sent.
    setSetting(db, 'evening_summary', { enabled: false, time: '21:00' }, NOW);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(unseenNotificationCount(db, at(FRIDAY, 22))).toBe(0);
  });

  it('stays silent on a paused day, even after «Riprendi», and comes back the day after', async () => {
    const { db, scheduler } = setUp(2);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.size).toBe(1);
    startPause(db, { fromDay: '2026-11-06', untilDay: null }, clockAt(FRIDAY, 19));
    expect(await syncEveningSummary(db, scheduler, SYNC)).toBeNull();
    expect(scheduler.pending.size).toBe(0);
    resumePause(db, clockAt(FRIDAY, 19));
    expect(await syncEveningSummary(db, scheduler, SYNC)).toBeNull();
    expect(await syncEveningSummary(db, scheduler, { now: at(7, 12), tzOffset: TZ })).toMatchObject(
      { id: 'evening-summary:2026-11-07' },
    );
  });
});
