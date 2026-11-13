import { eq } from 'drizzle-orm';

import { createMission } from '@/db/repositories/missions';
import { getTodayView } from '@/db/repositories/todayView';
import { events, missionDays } from '@/db/schema';
import { FRIDAY, clockAt, expectHeroMatchesLog, missionId, newGame } from '../../../test/game';

import { handleWidgetTarget, pendingTargets } from './actions';
import { encodeTarget } from './snapshot';

const TODAY = '2026-11-06';

describe('handleWidgetTarget (US-WID-01)', () => {
  it('completes a mission from the widget once, even when the touch arrives twice', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    const target = encodeTarget({ kind: 'complete', missionId: id, day: TODAY, stamp: 'g1' });

    const first = handleWidgetTarget(db, target, clockAt(FRIDAY, 10));
    const second = handleWidgetTarget(db, target, clockAt(FRIDAY, 10));

    expect(first.outcome).toBe('completed');
    expect(second.outcome).toBe('already_recorded');
    const completed = db.select().from(events).where(eq(events.type, 'mission.completed')).all();
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ source: 'widget', idemKey: `widget:${target}` });
    expect(db.select().from(missionDays).where(eq(missionDays.missionId, id)).get()).toMatchObject({
      status: 'done',
      source: 'widget',
    });
    expectHeroMatchesLog(db);
  });

  it('adds the increment of a measurable mission once per value shown', () => {
    const db = newGame(['drink_water']);
    const id = missionId(db, 'drink_water');
    const at0 = encodeTarget({ kind: 'progress', missionId: id, day: TODAY, stamp: '0' });
    const at25 = encodeTarget({ kind: 'progress', missionId: id, day: TODAY, stamp: '0.25' });

    expect(handleWidgetTarget(db, at0, clockAt(FRIDAY, 10)).outcome).toBe('progressed');
    expect(handleWidgetTarget(db, at0, clockAt(FRIDAY, 10)).outcome).toBe('already_recorded');
    expect(handleWidgetTarget(db, at25, clockAt(FRIDAY, 11)).outcome).toBe('progressed');

    const view = getTodayView(db, clockAt(FRIDAY, 12));
    expect(view.missions[0].value).toBe(0.5);
  });

  it('ignores a touch of another day, an unknown target and a mission no longer due', () => {
    const db = newGame(['journal']);
    const id = missionId(db, 'journal');
    const yesterday = encodeTarget({
      kind: 'complete',
      missionId: id,
      day: '2026-11-05',
      stamp: 'g1',
    });
    expect(handleWidgetTarget(db, yesterday, clockAt(FRIDAY, 10)).outcome).toBe('ignored');
    expect(handleWidgetTarget(db, 'open', clockAt(FRIDAY, 10)).outcome).toBe('ignored');
    const unknown = encodeTarget({ kind: 'complete', missionId: 'nope', day: TODAY, stamp: 'g' });
    expect(handleWidgetTarget(db, unknown, clockAt(FRIDAY, 10)).outcome).toBe('failed');
    expect(db.select().from(events).where(eq(events.type, 'mission.completed')).all()).toEqual([]);
  });

  it('gives back the reminders of the day to cancel', () => {
    const db = newGame(['journal']);
    const id = createMission(db, { name: 'Leggi' }, clockAt(FRIDAY, 9)).id;
    const target = encodeTarget({ kind: 'complete', missionId: id, day: TODAY, stamp: 'g2' });
    const result = handleWidgetTarget(db, target, clockAt(FRIDAY, 10));
    expect(result).toMatchObject({ outcome: 'completed', cancelledNotificationIds: [] });
  });
});

describe('pendingTargets', () => {
  it('collects the touches the widget recorded, once each', () => {
    expect(
      pendingTargets([
        { pending: ['a', 'b'] },
        { pending: ['b', 'c'] },
        { pending: 'x' },
        {},
        null,
      ]),
    ).toEqual(['a', 'b', 'c']);
  });
});
