import { sql } from 'drizzle-orm';

import * as schema from '@/db/schema';

import journal from '../drizzle/meta/_journal.json';
import { createTestDb } from './db';

describe('createTestDb', () => {
  it('applies every migration from zero', () => {
    const db = createTestDb();
    const tables = db
      .all<{ name: string }>(
        sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'`,
      )
      .map((row) => row.name);
    expect(tables).toHaveLength(17);
    expect(tables).toEqual(expect.arrayContaining(['hero', 'missions', 'events', 'rewards']));
    expect(db.all(sql`SELECT hash FROM __drizzle_migrations`)).toHaveLength(journal.entries.length);
  });

  it('turns the foreign keys on', () => {
    const db = createTestDb();
    let error: unknown;
    try {
      db.run(
        sql`INSERT INTO mission_days (mission_id, game_day, status, source, updated_at) VALUES ('missing', '2026-11-06', 'done', 'app', 1)`,
      );
    } catch (caught) {
      error = caught;
    }
    // Drizzle wraps the SQLite error and keeps it as the cause.
    expect((error as Error).cause).toEqual(
      expect.objectContaining({ message: expect.stringMatching(/FOREIGN KEY/) }),
    );
  });

  it('gives every test a new empty database', () => {
    createTestDb().insert(schema.badges).values({ badgeKey: 'first_step', unlockedAt: 1 }).run();
    expect(createTestDb().select().from(schema.badges).all()).toEqual([]);
  });
});
