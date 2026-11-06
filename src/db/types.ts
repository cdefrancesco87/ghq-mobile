import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * The database as the repositories see it. In Drizzle both expo-sqlite (in the app) and
 * better-sqlite3 (in the tests) are synchronous, so the same repository code runs on both.
 */
export type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;
