import { asc, getTableColumns, type Column } from 'drizzle-orm';

import { events, missions } from '../schema';
import type { Db } from '../types';

// The export of the data as CSV (US-IMP-04; design-sezioni.md 10.8): the missions and the whole
// event log, in one file of two sections, each with its title on a line of its own and the column
// names of the database in its header. RFC 4180: commas, quotes and line breaks are quoted, lines
// end with CRLF.
//
// PROVISIONAL (T82): the documents say only «missioni e registro completo». Deleted missions are
// written too (with `deleted_at`), because the log speaks of them; instants (`*_at`) become ISO 8601
// in UTC, JSON columns stay JSON, the rest is written as stored.

const LINE_END = '\r\n';
const NEEDS_QUOTES = /[",\r\n]/;

/** One field of a CSV line: empty for null, JSON for objects, quoted when it needs it. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvLine(values: readonly unknown[]): string {
  return values.map(csvField).join(',') + LINE_END;
}

/** An instant in milliseconds as ISO 8601 in UTC; other values as they are. */
function cellOf(column: Column, value: unknown): unknown {
  if (column.name.endsWith('_at') && typeof value === 'number') {
    return new Date(value).toISOString();
  }
  return value;
}

function sectionOf(
  title: string,
  columns: Record<string, Column>,
  rows: readonly Record<string, unknown>[],
): string {
  const entries = Object.entries(columns);
  return (
    csvLine([title]) +
    csvLine(entries.map(([, column]) => column.name)) +
    rows.map((row) => csvLine(entries.map(([key, column]) => cellOf(column, row[key])))).join('')
  );
}

/** The text of the export: missions in their order, then the log in the order it was written. */
export function exportCsv(db: Db): string {
  const missionRows = db
    .select()
    .from(missions)
    .orderBy(asc(missions.sortOrder), asc(missions.createdAt))
    .all();
  const eventRows = db.select().from(events).orderBy(asc(events.seq)).all();
  return (
    sectionOf('missions', getTableColumns(missions), missionRows) +
    LINE_END +
    sectionOf('events', getTableColumns(events), eventRows)
  );
}
