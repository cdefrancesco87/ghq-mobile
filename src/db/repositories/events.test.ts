import {
  EVENT_TYPES,
  appendEvent,
  notDeleted,
  type EventInput,
  type EventType,
} from '@/db/repositories/events';
import { getDeviceId, setDayChange } from '@/db/repositories/settings';
import { events, missions } from '@/db/schema';

import { createTestDb } from '../../../test/db';

const ROME_WINTER = 60;
const NINE_AM = Date.UTC(2026, 10, 6, 8, 0); // 09:00 in Rome on 6 November
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function completion(overrides: Partial<EventInput> = {}): EventInput {
  return {
    type: 'mission.completed',
    occurredAt: NINE_AM,
    tzOffset: ROME_WINTER,
    source: 'app',
    missionId: 'mission-1',
    deltas: { xp: 25, coins: 5, hp: 1, stats: { strength: 20, wisdom: 6 } },
    ...overrides,
  };
}

describe('appendEvent', () => {
  it('writes the event with a UUID v7, its game day and the id of the device', () => {
    const db = createTestDb();
    const result = appendEvent(db, completion({ idemKey: 'app:1', payload: { value: 2 } }));
    expect(result.status).toBe('recorded');
    expect(result.event).toMatchObject({
      type: 'mission.completed',
      v: 1,
      occurredAt: NINE_AM,
      tzOffset: ROME_WINTER,
      gameDay: '2026-11-06',
      source: 'app',
      deviceId: getDeviceId(db, NINE_AM),
      missionId: 'mission-1',
      bossId: null,
      idemKey: 'app:1',
      dXp: 25,
      dCoins: 5,
      dHp: 1,
      dStats: { strength: 20, wisdom: 6 },
      payload: { value: 2 },
    });
    expect(result.event.id).toMatch(UUID_V7);
    expect(db.select().from(events).all()).toEqual([result.event]);
  });

  it('gives an event at 01:00 to the previous game day', () => {
    const db = createTestDb();
    const oneAm = Date.UTC(2026, 10, 6, 0, 0);
    expect(appendEvent(db, completion({ occurredAt: oneAm })).event.gameDay).toBe('2026-11-05');
  });

  it('follows the day change time of the settings, also when it changes from tomorrow', () => {
    const db = createTestDb();
    setDayChange(db, '05:00', { today: '2026-11-06', now: NINE_AM });
    const halfPastFiveTomorrow = Date.UTC(2026, 10, 7, 4, 30);
    const fiveTheDayAfter = Date.UTC(2026, 10, 8, 4, 0);
    expect(appendEvent(db, completion({ occurredAt: halfPastFiveTomorrow })).event.gameDay).toBe(
      '2026-11-06',
    );
    expect(appendEvent(db, completion({ occurredAt: fiveTheDayAfter })).event.gameDay).toBe(
      '2026-11-08',
    );
  });

  it('keeps the game day given by the action, for example when closing a past day', () => {
    const db = createTestDb();
    const event = appendEvent(db, completion({ type: 'day.closed', gameDay: '2026-11-01' })).event;
    expect(event.gameDay).toBe('2026-11-01');
  });

  it('records the same idempotency key once and says it was already recorded, without errors', () => {
    const db = createTestDb();
    const fromNotification = appendEvent(
      db,
      completion({ idemKey: 'notif:abc123', source: 'notification' }),
    );
    const fromApp = appendEvent(
      db,
      completion({ idemKey: 'notif:abc123', source: 'app', occurredAt: NINE_AM + 5000 }),
    );
    expect(fromApp).toEqual({ status: 'already_recorded', event: fromNotification.event });
    expect(db.select().from(events).all()).toHaveLength(1);
  });

  it('writes events without an idempotency key every time', () => {
    const db = createTestDb();
    appendEvent(db, completion());
    appendEvent(db, completion());
    expect(db.select().from(events).all()).toHaveLength(2);
  });

  it('gives ids that sort in the order of writing', () => {
    const db = createTestDb();
    const ids = Array.from(
      { length: 50 },
      (_, i) => appendEvent(db, completion({ occurredAt: NINE_AM + i })).event.id,
    );
    expect([...ids].sort()).toEqual(ids);
    const bySeq = db.select({ id: events.id }).from(events).orderBy(events.seq).all();
    expect(bySeq.map((row) => row.id)).toEqual(ids);
  });

  it('records an undo with the opposite changes and the id of the undone event', () => {
    const db = createTestDb();
    const done = appendEvent(db, completion());
    const undo = appendEvent(
      db,
      completion({
        type: 'event.reverted',
        revertsId: done.event.id,
        deltas: { xp: -25, coins: -5, hp: -1, stats: { strength: -20, wisdom: -6 } },
      }),
    );
    expect(undo.event).toMatchObject({ revertsId: done.event.id, dXp: -25, dCoins: -5, dHp: -1 });
  });

  it('stores no stat changes as null and missing changes as 0', () => {
    const db = createTestDb();
    const event = appendEvent(db, completion({ type: 'hero.renamed', deltas: undefined })).event;
    expect(event).toMatchObject({ dXp: 0, dCoins: 0, dHp: 0, dStats: null, payload: {} });
  });

  it('leaves nothing when the transaction of the action fails', () => {
    const db = createTestDb();
    expect(() =>
      db.transaction((tx) => {
        appendEvent(tx, completion());
        throw new Error('the action failed');
      }),
    ).toThrow('the action failed');
    expect(db.select().from(events).all()).toEqual([]);
  });

  it('rejects unknown types and changes that are not integers', () => {
    const db = createTestDb();
    expect(() => appendEvent(db, completion({ type: 'mission.exploded' as EventType }))).toThrow(
      RangeError,
    );
    expect(() => appendEvent(db, completion({ deltas: { xp: 2.5 } }))).toThrow(RangeError);
    expect(() => appendEvent(db, completion({ deltas: { stats: { strength: 0.5 } } }))).toThrow(
      RangeError,
    );
    expect(db.select().from(events).all()).toEqual([]);
  });
});

describe('EVENT_TYPES', () => {
  it('lists the 31 event types of the data model plus hero.created, the provisional boss ones, companion.renamed, the 3 of the general pause and the 2 of the Main Quest and the chains', () => {
    expect(EVENT_TYPES).toHaveLength(40);
    expect(new Set(EVENT_TYPES).size).toBe(40);
    expect(EVENT_TYPES).toEqual(
      expect.arrayContaining([
        'mission.deleted',
        'mission.completed',
        'event.reverted',
        'day.closed',
        'boss.deadline_missed',
        'boss.updated',
        'boss.deleted',
        'boss.main_changed',
        'boss.unlocked',
        'companion.stage_up',
        'companion.renamed',
        'hero.created',
        'shield.consumed',
        'pause.started',
        'pause.changed',
        'pause.ended',
      ]),
    );
  });
});

describe('notDeleted', () => {
  it('leaves out the deleted missions', () => {
    const db = createTestDb();
    const base = { kind: 'habit' as const, sortOrder: 1, createdAt: NINE_AM, updatedAt: NINE_AM };
    db.insert(missions)
      .values([
        { ...base, id: 'kept', name: 'Leggi' },
        { ...base, id: 'deleted', name: 'Corri', deletedAt: NINE_AM },
      ])
      .run();
    const visible = db.select({ id: missions.id }).from(missions).where(notDeleted(missions)).all();
    expect(visible).toEqual([{ id: 'kept' }]);
  });
});
