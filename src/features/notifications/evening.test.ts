import { completeMission, skipMission } from '@/db/repositories/completion';
import { deleteMission, updateMission } from '@/db/repositories/missions';
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
        title: "Com'è andata oggi?",
        body: "Ti mancano 2 abitudini, c'è ancora tempo: Journal, Meal.",
      },
    ]);
  });

  it('names 3 of 5 missions left and counts the others', async () => {
    const { db, scheduler } = setUp(5);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')?.body).toBe(
      "Ti mancano 5 abitudini, c'è ancora tempo: Journal, Meal, Bed e altre 2.",
    );
  });

  it('becomes the compliment after the last completion (0 left)', async () => {
    const { db, ids, scheduler } = setUp(2);
    await syncEveningSummary(db, scheduler, SYNC);
    ids.forEach((id) => complete(db, id));
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')).toMatchObject({
      title: 'Giornata completa!',
      body: 'Bel lavoro, Claudio: oggi hai fatto tutto.',
    });
  });

  it('leaves out the skipped missions', async () => {
    const { db, ids, scheduler } = setUp(3);
    skipMission(db, { missionId: ids[0], reason: 'travel', ...SYNC });
    complete(db, ids[1]);
    await syncEveningSummary(db, scheduler, SYNC);
    expect(scheduler.pending.get('evening-summary:2026-11-06')?.body).toBe(
      "Ti manca 1 abitudine, c'è ancora tempo: Bed.",
    );
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
});
