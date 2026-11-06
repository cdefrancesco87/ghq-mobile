import { asc, eq } from 'drizzle-orm';

import { closePendingDays } from '@/db/repositories/closing';
import { completeMission } from '@/db/repositories/completion';
import { appendEvent, type EventType } from '@/db/repositories/events';
import { changeHero } from '@/db/repositories/hero';
import { buyItem } from '@/db/repositories/shop';
import { daySummaries, events, hero, inventory, missions } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, expectHeroMatchesLog, missionId, newGame, TZ } from '../../../test/game';

function adjustHero(db: Db, deltas: { coins?: number; hp?: number }): void {
  const change = changeHero(db, deltas, at(6, 8));
  appendEvent(db, {
    type: 'bonus.full_day',
    occurredAt: at(6, 8),
    tzOffset: TZ,
    source: 'system',
    gameDay: '2026-11-05',
    deltas: change.deltas,
  });
}

function complete(db: Db, id: string, day: number) {
  return completeMission(db, { missionId: id, source: 'app', ...clockAt(day, 10) });
}

function eventsOf(db: Db, type: EventType) {
  return db.select().from(events).where(eq(events.type, type)).orderBy(asc(events.seq)).all();
}

describe('closePendingDays', () => {
  it('closes every whole day since the last close, in order, and leaves today open', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    complete(db, journal, 6);
    const closed = closePendingDays(db, clockAt(9, 10));
    expect(closed.map((day) => day.gameDay)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08']);
    expect(db.select().from(daySummaries).orderBy(asc(daySummaries.gameDay)).all()).toEqual([
      {
        gameDay: '2026-11-06',
        scheduledCount: 1,
        doneCount: 1,
        scheduledXp: 10,
        missedXp: 0,
        hpLost: 0,
        isRestDay: false,
        fullDay: true,
        planComplete: false,
        shieldUsed: false,
        closedAt: at(9, 10),
      },
      expect.objectContaining({ gameDay: '2026-11-07', missedXp: 10, hpLost: 10 }),
      expect.objectContaining({ gameDay: '2026-11-08', missedXp: 10, hpLost: 10 }),
    ]);
    expect(eventsOf(db, 'day.closed').map((event) => [event.gameDay, event.dHp])).toEqual([
      ['2026-11-06', 0],
      ['2026-11-07', -10],
      ['2026-11-08', -10],
    ]);
    expect(db.select().from(hero).get()).toMatchObject({ hp: 30, streak: 0, streakBest: 1 });
    expect(db.select().from(missions).where(eq(missions.id, journal)).get()).toMatchObject({
      streak: 0,
      streakBest: 1,
    });
    expectHeroMatchesLog(db);
  });

  it('changes nothing when it runs again', () => {
    const db = newGame(['journal']);
    complete(db, missionId(db, 'journal'), 6);
    closePendingDays(db, clockAt(9, 10));
    const count = db.select().from(events).all().length;
    const before = db.select().from(hero).get();
    expect(closePendingDays(db, clockAt(9, 10))).toEqual([]);
    expect(closePendingDays(db, clockAt(9, 23))).toEqual([]);
    expect(db.select().from(events).all()).toHaveLength(count);
    expect(db.select().from(hero).get()).toEqual(before);
    expect(db.select().from(daySummaries).all()).toHaveLength(3);
  });

  it('closes nothing on the day of the first launch', () => {
    const db = newGame(['journal']);
    expect(closePendingDays(db, clockAt(6, 23))).toEqual([]);
    expect(db.select().from(daySummaries).all()).toEqual([]);
  });

  it('uses a shield on a missed day, with its event, and keeps the streaks', () => {
    const db = newGame(['journal']);
    const journal = missionId(db, 'journal');
    adjustHero(db, { coins: 100 });
    buyItem(db, 'shield', clockAt(6, 9));
    complete(db, journal, 6);
    closePendingDays(db, clockAt(8, 10));
    expect(
      db.select().from(daySummaries).where(eq(daySummaries.gameDay, '2026-11-07')).get(),
    ).toMatchObject({ shieldUsed: true });
    expect(eventsOf(db, 'shield.consumed')).toEqual([
      expect.objectContaining({ gameDay: '2026-11-07', itemKey: 'shield' }),
    ]);
    expect(db.select().from(inventory).where(eq(inventory.itemKey, 'shield')).get()?.quantity).toBe(
      0,
    );
    expect(db.select().from(hero).get()).toMatchObject({ streak: 1 });
    expect(db.select().from(missions).where(eq(missions.id, journal)).get()?.streak).toBe(1);
    expectHeroMatchesLog(db);
  });

  it('makes the hero exhausted on the next day and gives back 13 hit points after it', () => {
    const db = newGame(['journal']);
    adjustHero(db, { hp: -45 });
    closePendingDays(db, clockAt(7, 10));
    expect(db.select().from(hero).get()).toMatchObject({ hp: 0, exhaustedDay: '2026-11-07' });
    expect(eventsOf(db, 'hero.exhausted')).toEqual([
      expect.objectContaining({ gameDay: '2026-11-06', payload: { exhaustedDay: '2026-11-07' } }),
    ]);
    closePendingDays(db, clockAt(8, 10));
    expect(db.select().from(hero).get()).toMatchObject({ hp: 13, exhaustedDay: '2026-11-07' });
    expectHeroMatchesLog(db);
  });
});
