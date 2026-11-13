import {
  archiveBoss,
  createBoss,
  deleteBoss,
  setBossDeadline,
  updateBoss,
  type NewBoss,
} from '@/db/repositories/boss';
import { getBossEdit } from '@/db/repositories/goalsView';

import { FRIDAY, TZ, at, clockAt, newGame } from '../../../test/game';
import {
  syncBossWarnings,
  type BossWarningRequest,
  type BossWarningScheduler,
} from './bossWarnings';

/** The notifications of the system in memory, only those still to fire. */
class FakeScheduler implements BossWarningScheduler {
  readonly pending = new Map<string, BossWarningRequest>();
  readonly cancelled: string[] = [];
  scheduledCount = 0;

  scheduled() {
    return Promise.resolve(
      [...this.pending.values()].map(({ id, title, body }) => ({ id, title, body })),
    );
  }

  schedule(request: BossWarningRequest): Promise<void> {
    this.scheduledCount += 1;
    this.pending.set(request.id, request);
    return Promise.resolve();
  }

  cancel(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      this.pending.delete(id);
      this.cancelled.push(id);
    }
    return Promise.resolve();
  }

  /** The time each one fires, as «title@local day hour:minute» (UTC+1). */
  times(): string[] {
    return [...this.pending.values()].map((request) => {
      const local = new Date(request.fireAt + TZ * 60_000).toISOString();
      return `${request.title}@${local.slice(8, 10)} ${local.slice(11, 16)}`;
    });
  }
}

const THESIS: NewBoss = {
  name: 'Tesi',
  difficulty: 'medium',
  deadlineDay: '2026-11-20',
  steps: ['Indice', 'Capitolo'],
};

const texts = (boss: { name: string }) => ({
  title: boss.name,
  body: `Mancano 3 giorni per sconfiggere ${boss.name}`,
});

const sync = (db: ReturnType<typeof newGame>, scheduler: FakeScheduler, day = FRIDAY, hour = 12) =>
  syncBossWarnings(db, scheduler, { now: at(day, hour), tzOffset: TZ }, texts);

describe('syncBossWarnings', () => {
  it('schedules one warning at 09:00, 3 days before the deadline, on the Boss channel data', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    // The quest of the first launch has no deadline: no warning.
    const scheduler = new FakeScheduler();
    expect(await sync(db, scheduler)).toEqual({ scheduled: 1, cancelled: 0 });
    expect(scheduler.times()).toEqual(['Tesi@17 09:00']);
    expect([...scheduler.pending.values()][0]).toMatchObject({
      bossId: thesis.id,
      body: 'Mancano 3 giorni per sconfiggere Tesi',
    });
    // Again: nothing new, the warning is only one.
    expect(await sync(db, scheduler)).toEqual({ scheduled: 0, cancelled: 0 });
    expect(scheduler.scheduledCount).toBe(1);
  });

  it('never schedules a warning whose time has passed', async () => {
    const db = newGame(['journal']);
    createBoss(db, { ...THESIS, deadlineDay: '2026-11-08' }, clockAt(FRIDAY, 10));
    const scheduler = new FakeScheduler();
    expect(await sync(db, scheduler)).toEqual({ scheduled: 0, cancelled: 0 });
  });

  it('moves the warning with a new deadline and follows the new name', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    const scheduler = new FakeScheduler();
    await sync(db, scheduler);
    setBossDeadline(db, thesis.id, '2026-11-25', clockAt(FRIDAY, 13));
    expect(await sync(db, scheduler)).toEqual({ scheduled: 1, cancelled: 1 });
    expect(scheduler.times()).toEqual(['Tesi@22 09:00']);
    const steps = getBossEdit(db, thesis.id)?.steps ?? [];
    updateBoss(
      db,
      thesis.id,
      { name: 'Tesi di laurea', steps: steps.map(({ id, title }) => ({ id, title })) },
      clockAt(FRIDAY, 14),
    );
    await sync(db, scheduler);
    expect(scheduler.times()).toEqual(['Tesi di laurea@22 09:00']);
  });

  it('cancels the warning of a boss archived, deleted or without deadline', async () => {
    const db = newGame(['journal']);
    const thesis = createBoss(db, THESIS, clockAt(FRIDAY, 10));
    const move = createBoss(db, { ...THESIS, name: 'Trasloco' }, clockAt(FRIDAY, 10));
    const scheduler = new FakeScheduler();
    await sync(db, scheduler);
    expect(scheduler.pending.size).toBe(2);
    archiveBoss(db, thesis.id, clockAt(FRIDAY, 13));
    setBossDeadline(db, move.id, null, clockAt(FRIDAY, 13));
    expect(await sync(db, scheduler)).toEqual({ scheduled: 0, cancelled: 2 });
    const third = createBoss(db, { ...THESIS, name: 'Terzo' }, clockAt(FRIDAY, 14));
    await sync(db, scheduler);
    deleteBoss(db, third.id, clockAt(FRIDAY, 15));
    await sync(db, scheduler);
    expect(scheduler.pending.size).toBe(0);
  });
});
