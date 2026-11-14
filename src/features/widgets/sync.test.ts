import { eq } from 'drizzle-orm';

import { updateMission } from '@/db/repositories/missions';
import { undoEvent } from '@/db/repositories/undo';
import { events } from '@/db/schema';
import { createTestDb } from '../../../test/db';
import { FRIDAY, clockAt, missionId, newGame } from '../../../test/game';

import { encodeTarget, type WidgetSnapshot } from './snapshot';
import { syncWidgets, type WidgetHost } from './sync';

function fakeHost(pending: string[] = []) {
  const written: WidgetSnapshot[] = [];
  const host: WidgetHost = {
    update: (snapshot) => {
      written.push(snapshot);
      pending.length = 0;
    },
    readPending: async () => [...pending],
  };
  return { host, written, pending };
}

describe('syncWidgets', () => {
  it('writes the snapshot of today', async () => {
    const db = newGame(['journal', 'meditation']);
    const { host, written } = fakeHost();
    await syncWidgets(db, host, () => clockAt(FRIDAY, 12));
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ day: '2026-11-06', total: 2, pending: [] });
  });

  it('completes the touches the widget recorded, once, before writing the new snapshot', async () => {
    const db = newGame(['journal', 'meditation']);
    const target = encodeTarget({
      kind: 'complete',
      missionId: missionId(db, 'journal'),
      day: '2026-11-06',
      stamp: 'g1',
    });
    const { host, written, pending } = fakeHost([target, target]);

    const first = await syncWidgets(db, host, () => clockAt(FRIDAY, 12));
    pending.push(target);
    await syncWidgets(db, host, () => clockAt(FRIDAY, 12));

    expect(first.outcomes.map((item) => item.outcome)).toEqual(['completed', 'already_recorded']);
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toHaveLength(
      1,
    );
    expect(written[0]).toMatchObject({ done: 1, total: 2 });
  });

  it('adds the increment again after an undo brought the value back to one already used', async () => {
    const db = newGame(['drink_water']);
    const id = missionId(db, 'drink_water');
    updateMission(
      db,
      id,
      { goal: { type: 'quantity', target: 0.5, unit: 'liter', increment: 0.25 } },
      clockAt(FRIDAY, 9),
    );
    const { host, written, pending } = fakeHost();
    let hour = 10;
    const sync = () => syncWidgets(db, host, () => clockAt(FRIDAY, hour));
    const tap = async () => {
      const row = written[written.length - 1].missions.find((item) => item.id === id);
      pending.push(row?.target ?? '');
      // The same touch arrives twice (the event and the list of the widget): it counts once.
      pending.push(row?.target ?? '');
      hour += 1;
      return (await sync()).outcomes.map((item) => item.outcome);
    };

    await sync();
    expect(await tap()).toEqual(['progressed', 'already_recorded']);
    const completed = await tap();
    expect(completed).toEqual(['completed', 'already_recorded']);
    const completion = db.select().from(events).where(eq(events.type, 'mission.completed')).get();
    undoEvent(db, completion!.id, clockAt(FRIDAY, hour));
    await sync();
    expect(written[written.length - 1].missions[0]).toMatchObject({ value: 0.25, done: false });

    expect(await tap()).toEqual(['completed', 'already_recorded']);
  });

  it('writes an empty snapshot before the first launch is finished, and after a wipe', async () => {
    // A widget left from the data deleted with «Elimina tutti i dati» must not show them.
    const { host, written } = fakeHost([
      encodeTarget({ kind: 'complete', missionId: 'old', day: '2026-11-06', stamp: 'g1' }),
    ]);
    const result = await syncWidgets(createTestDb(), host, () => clockAt(FRIDAY, 12));
    expect(result).toEqual({ outcomes: [], snapshot: null });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      day: '2026-11-06',
      state: 'rest',
      streak: 0,
      level: null,
      levelText: null,
      done: 0,
      total: 0,
      missions: [],
      message: null,
      unseen: 0,
      pending: [],
    });
  });
});
