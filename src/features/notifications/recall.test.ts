import { renameCompanion } from '@/db/repositories/companion';
import { startPause } from '@/db/repositories/pause';
import { setSetting } from '@/db/repositories/settings';

import { FRIDAY, TZ, at, clockAt, newGame } from '../../../test/game';
import { RECALL_ID, syncRecall, type RecallRequest, type RecallScheduler } from './recall';

/** The check-ins of the system in memory, by identifier. */
class FakeRecall implements RecallScheduler {
  readonly pending = new Map<string, RecallRequest>();
  schedule(request: RecallRequest): Promise<void> {
    this.pending.set(request.id, request);
    return Promise.resolve();
  }
  cancel(id: string): Promise<void> {
    this.pending.delete(id);
    return Promise.resolve();
  }
}

const open = (day: number, hour: number) => ({ now: at(day, hour), tzOffset: TZ });

describe('syncRecall (design 11.6)', () => {
  it('schedules one gentle check-in 3 days after the opening', async () => {
    const db = newGame(['journal']);
    const scheduler = new FakeRecall();
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    expect([...scheduler.pending.values()]).toEqual([
      {
        id: RECALL_ID,
        fireAt: at(FRIDAY + 3, 18),
        title: 'Cloudy ti aspetta',
        body: 'Bastano due minuti per ripartire.',
      },
    ]);
  });

  it('is scheduled again at every opening, never twice', async () => {
    const db = newGame(['journal']);
    const scheduler = new FakeRecall();
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    await syncRecall(db, scheduler, open(FRIDAY + 2, 8));
    expect(scheduler.pending.size).toBe(1);
    expect(scheduler.pending.get(RECALL_ID)?.fireAt).toBe(at(FRIDAY + 5, 8));
  });

  it('is cancelled when the switch of the Settings is off, and back when on', async () => {
    const db = newGame(['journal']);
    const scheduler = new FakeRecall();
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    setSetting(db, 'recall_enabled', false, at(FRIDAY, 18));
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    expect(scheduler.pending.size).toBe(0);
    setSetting(db, 'recall_enabled', true, at(FRIDAY, 19));
    await syncRecall(db, scheduler, open(FRIDAY, 19));
    expect(scheduler.pending.get(RECALL_ID)?.fireAt).toBe(at(FRIDAY + 3, 19));
  });

  it('names the companion chosen by the user', async () => {
    const db = newGame(['journal']);
    renameCompanion(db, 'Nuvola', 'Cloudy', clockAt(FRIDAY, 10));
    const scheduler = new FakeRecall();
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    expect(scheduler.pending.get(RECALL_ID)?.title).toBe('Nuvola ti aspetta');
  });

  it('waits for «Non disturbare» and skips a general pause without an end', async () => {
    const db = newGame(['journal']);
    setSetting(db, 'quiet_hours', [{ start: '17:00', end: '20:00' }], at(FRIDAY, 9));
    const scheduler = new FakeRecall();
    await syncRecall(db, scheduler, open(FRIDAY, 18));
    expect(scheduler.pending.get(RECALL_ID)?.fireAt).toBe(at(FRIDAY + 3, 20));
    startPause(db, { fromDay: '2026-11-08', untilDay: null }, clockAt(FRIDAY, 19));
    await syncRecall(db, scheduler, open(FRIDAY, 19));
    expect(scheduler.pending.size).toBe(0);
  });
});
