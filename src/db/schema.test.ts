import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';
import type { DueMission, Frequency } from '@/rules/frequency';
import type { GameDay, StatKey, StatPoints } from '@/rules/types';

/** True when A and B are exactly the same type. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Mission = typeof schema.missions.$inferSelect;
type Event = typeof schema.events.$inferSelect;

// Checked by `npm run typecheck`: assigning `true` fails as soon as a column loses its type.
const frequencyIsTyped: Equals<Mission['frequency'], Frequency | null> = true;
const dueDayIsGameDay: Equals<Mission['dueDay'], GameDay | null> = true;
const statIsStatKey: Equals<Mission['statPrimary'], StatKey | null> = true;
const eventStatsAreTyped: Equals<Event['dStats'], StatPoints | null> = true;

function tableNames(): string[] {
  return (Object.values(schema) as unknown[])
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => getTableConfig(table).name)
    .sort();
}

function checkNames(table: SQLiteTable): string[] {
  return getTableConfig(table).checks.map((check) => check.name);
}

describe('schema', () => {
  it('has every table of the data model, without the rewards of a later version', () => {
    expect(tableNames()).toEqual(
      [
        'hero',
        'hero_stats',
        'companion',
        'settings',
        'boss',
        'boss_steps',
        'missions',
        'mission_reminders',
        'mission_days',
        'day_plan',
        'day_summaries',
        'inventory',
        'badges',
        'app_notifications',
        'scheduled_reminders',
        'events',
      ].sort(),
    );
  });

  it('derives the row types from the tables', () => {
    expect([frequencyIsTyped, dueDayIsGameDay, statIsStatKey, eventStatsAreTyped]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // A row of `missions` has every field that isDueToday needs.
    const row = { kind: 'habit', frequency: { type: 'daily' } } as Mission;
    const due: DueMission = row;
    expect(due.frequency).toEqual({ type: 'daily' });
  });

  it('keeps the database constraints of the data model', () => {
    expect(checkNames(schema.hero)).toContain('hero_coins_non_negative');
    expect(checkNames(schema.missions)).toContain('missions_stats_differ');
    expect(checkNames(schema.dayPlan)).toContain('day_plan_max_three');
    expect(checkNames(schema.inventory)).toContain('inventory_shields_max');
    expect(getTableConfig(schema.events).columns.find((c) => c.name === 'idem_key')?.isUnique).toBe(
      true,
    );
  });
});
