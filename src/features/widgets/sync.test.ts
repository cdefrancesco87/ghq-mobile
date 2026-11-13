import { eq } from 'drizzle-orm';

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

  it('writes nothing before the first launch is finished', async () => {
    const { host, written } = fakeHost();
    const result = await syncWidgets(createTestDb(), host, () => clockAt(FRIDAY, 12));
    expect(result.snapshot).toBeNull();
    expect(written).toEqual([]);
  });
});
