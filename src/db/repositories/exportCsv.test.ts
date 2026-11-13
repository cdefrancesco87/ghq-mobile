import { csvField, exportCsv } from '@/db/repositories/exportCsv';
import { completeMission } from '@/db/repositories/completion';
import { deleteMission } from '@/db/repositories/missions';
import { events, missions } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { createTestDb } from '../../../test/db';
import { clockAt, missionId, newGame } from '../../../test/game';

/** Splits a CSV text into records and fields, following RFC 4180 (quotes, commas, line breaks). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' && text[index + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** The records of one section of the export: the header and the rows under its title. */
function section(text: string, title: string): { header: string[]; rows: string[][] } {
  const records = parseCsv(text);
  const start = records.findIndex((record) => record.length === 1 && record[0] === title);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = records.findIndex(
    (record, index) => index > start && record.length === 1 && record[0] === '',
  );
  const body = records.slice(start + 1, end === -1 ? undefined : end);
  return { header: body[0], rows: body.slice(1) };
}

describe('csvField', () => {
  it('leaves plain values as they are and empties null', () => {
    expect(csvField('Bevi acqua')).toBe('Bevi acqua');
    expect(csvField(12)).toBe('12');
    expect(csvField(null)).toBe('');
    expect(csvField(true)).toBe('true');
  });

  it('quotes commas, quotes and line breaks, doubling the quotes', () => {
    expect(csvField('Leggi, poi dormi')).toBe('"Leggi, poi dormi"');
    expect(csvField('Il "grande" libro')).toBe('"Il ""grande"" libro"');
    expect(csvField('riga uno\nriga due')).toBe('"riga uno\nriga due"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('writes objects as JSON', () => {
    expect(csvField({ type: 'daily' })).toBe('"{""type"":""daily""}"');
  });
});

describe('exportCsv', () => {
  it('has a section for the missions and one for the whole log, with their headers', () => {
    const csv = exportCsv(createTestDb());
    const missionPart = section(csv, 'missions');
    const eventPart = section(csv, 'events');

    expect(missionPart.header.slice(0, 4)).toEqual(['id', 'kind', 'name', 'difficulty']);
    expect(missionPart.header).toContain('deleted_at');
    expect(missionPart.rows).toEqual([]);
    expect(eventPart.header.slice(0, 6)).toEqual([
      'seq',
      'id',
      'type',
      'v',
      'occurred_at',
      'tz_offset',
    ]);
    expect(eventPart.header).toContain('payload');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('writes every mission, deleted ones too, keeping commas and line breaks in names and notes', () => {
    const db = newGame(['drink_water', 'run']);
    const water = missionId(db, 'drink_water');
    db.update(missions)
      .set({ name: 'Bevi acqua, 2 litri', notes: 'Mattina "presto"\nE sera' })
      .where(eq(missions.id, water))
      .run();
    deleteMission(db, missionId(db, 'run'), clockAt(7, 9));

    const { header, rows } = section(exportCsv(db), 'missions');
    const column = (name: string) => header.indexOf(name);
    const byId = new Map(rows.map((row) => [row[column('id')], row]));

    expect(rows).toHaveLength(2);
    const waterRow = byId.get(water)!;
    expect(waterRow).toHaveLength(header.length);
    expect(waterRow[column('name')]).toBe('Bevi acqua, 2 litri');
    expect(waterRow[column('notes')]).toBe('Mattina "presto"\nE sera');
    expect(waterRow[column('deleted_at')]).toBe('');
    expect(JSON.parse(waterRow[column('frequency')])).toEqual(expect.any(Object));
    expect(waterRow[column('created_at')]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(byId.get(missionId(db, 'run'))![column('deleted_at')]).toBe('2026-11-07T08:00:00.000Z');
  });

  it('writes the whole log in order, with the changes and the payload', () => {
    const db = newGame(['drink_water']);
    completeMission(db, {
      missionId: missionId(db, 'drink_water'),
      source: 'app',
      ...clockAt(6, 9),
    });
    const logged = db.select().from(events).orderBy(events.seq).all();

    const { header, rows } = section(exportCsv(db), 'events');
    const column = (name: string) => header.indexOf(name);

    expect(rows.map((row) => row[column('type')])).toEqual(logged.map((event) => event.type));
    const done = rows.find((row) => row[column('type')] === 'mission.completed')!;
    expect(Number(done[column('d_xp')])).toBeGreaterThan(0);
    expect(done[column('game_day')]).toBe('2026-11-06');
    expect(JSON.parse(done[column('payload')])).toEqual(expect.any(Object));
    expect(done[column('occurred_at')]).toBe('2026-11-06T08:00:00.000Z');
  });
});
