import { eq, sql } from 'drizzle-orm';

import { events } from '@/db/schema';
import type { Db } from '@/db/types';

import { createTestDb } from '../../test/db';

function insertEvent(db: Db, id: string): void {
  db.insert(events)
    .values({
      id,
      type: 'mission.completed',
      occurredAt: Date.UTC(2026, 10, 6, 9, 0),
      tzOffset: 60,
      gameDay: '2026-11-06',
      source: 'app',
      deviceId: 'device-1',
      dXp: 25,
    })
    .run();
}

/** The message of the SQLite error behind a failed query (Drizzle keeps it as the cause). */
function sqliteErrorOf(action: () => void): string {
  try {
    action();
  } catch (error) {
    return String((error as Error).cause ?? error);
  }
  return 'no error';
}

describe('the event log', () => {
  it('accepts new events', () => {
    const db = createTestDb();
    insertEvent(db, 'event-1');
    insertEvent(db, 'event-2');
    expect(db.select({ id: events.id }).from(events).all()).toEqual([
      { id: 'event-1' },
      { id: 'event-2' },
    ]);
  });

  it('refuses to change an event', () => {
    const db = createTestDb();
    insertEvent(db, 'event-1');
    const message = sqliteErrorOf(() =>
      db.update(events).set({ dXp: 1000 }).where(eq(events.id, 'event-1')).run(),
    );
    expect(message).toMatch(/append-only/);
    expect(db.select({ dXp: events.dXp }).from(events).all()).toEqual([{ dXp: 25 }]);
  });

  it('refuses to delete an event', () => {
    const db = createTestDb();
    insertEvent(db, 'event-1');
    const message = sqliteErrorOf(() => db.delete(events).run());
    expect(message).toMatch(/append-only/);
    expect(db.select({ id: events.id }).from(events).all()).toHaveLength(1);
  });
});

describe('the active bosses', () => {
  it('have a partial index on the active rows', () => {
    const db = createTestDb();
    const index = db.get<{ sql: string } | undefined>(
      sql`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'boss_active_idx'`,
    );
    expect(index?.sql).toMatch(/WHERE "boss"\."status" = 'active'/);
  });
});
