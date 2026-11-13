import { eq } from 'drizzle-orm';

import { getCompanionView, renameCompanion } from '@/db/repositories/companion';
import { completeMission } from '@/db/repositories/completion';
import { deleteMission } from '@/db/repositories/missions';
import { companion, events } from '@/db/schema';

import { clockAt, expectHeroMatchesLog, FRIDAY, missionId, newGame } from '../../../test/game';

const NOW = clockAt(FRIDAY, 10);

function renamedEvents(db: ReturnType<typeof newGame>) {
  return db.select().from(events).where(eq(events.type, 'companion.renamed')).all();
}

describe('getCompanionView', () => {
  it('shows the egg of a new game with the default name and its growth', () => {
    const db = newGame(['meditation']);
    expect(getCompanionView(db, NOW)).toEqual({
      stage: 'egg',
      name: null,
      mood: 'normal',
      growth: { stageNumber: 1, stageCount: 3, done: 0, target: 1, left: 1 },
    });
  });

  it('shows the puppy after the first completion, happy because of today', () => {
    const db = newGame(['meditation']);
    completeMission(db, { missionId: missionId(db, 'meditation'), source: 'app', ...NOW });
    expect(getCompanionView(db, NOW)).toEqual({
      stage: 'baby',
      name: null,
      mood: 'happy',
      growth: { stageNumber: 2, stageCount: 3, done: 1, target: 150, left: 149 },
    });
  });

  it('does not count today a completion of a mission deleted since, like Today', () => {
    const db = newGame(['meditation']);
    const meditation = missionId(db, 'meditation');
    completeMission(db, { missionId: meditation, source: 'app', ...NOW });
    deleteMission(db, meditation, NOW);
    expect(getCompanionView(db, NOW)).toMatchObject({ stage: 'baby', mood: 'normal' });
  });

  it('shows the adult fully grown', () => {
    const db = newGame(['meditation']);
    db.update(companion).set({ stage: 'adult', completionsTotal: 160 }).run();
    expect(getCompanionView(db, NOW)).toMatchObject({
      stage: 'adult',
      growth: { stageNumber: 3, done: 160, target: null, left: 0 },
    });
  });
});

describe('renameCompanion', () => {
  it('stores the chosen name and logs it', () => {
    const db = newGame(['meditation']);
    expect(renameCompanion(db, '  Fiocco ', 'Cloudy', NOW)).toBe('Fiocco');
    expect(db.select().from(companion).get()?.name).toBe('Fiocco');
    const [event] = renamedEvents(db);
    expect(event).toMatchObject({
      occurredAt: NOW.now,
      tzOffset: NOW.tzOffset,
      source: 'app',
      gameDay: '2026-11-06',
      payload: { from: null, to: 'Fiocco' },
      dXp: 0,
      dCoins: 0,
    });
    expect(getCompanionView(db, NOW).name).toBe('Fiocco');
    expectHeroMatchesLog(db);
  });

  it('goes back to the default of the theme with an empty name or the default itself', () => {
    const db = newGame(['meditation']);
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(renameCompanion(db, '   ', 'Cloudy', NOW)).toBeNull();
    expect(db.select().from(companion).get()?.name).toBeNull();
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(renameCompanion(db, 'Cloudy', 'Cloudy', NOW)).toBeNull();
    expect(renamedEvents(db).map((event) => event.payload)).toEqual([
      { from: null, to: 'Fiocco' },
      { from: 'Fiocco', to: null },
      { from: null, to: 'Fiocco' },
      { from: 'Fiocco', to: null },
    ]);
  });

  it('writes nothing when the name does not change', () => {
    const db = newGame(['meditation']);
    renameCompanion(db, 'Cloudy', 'Cloudy', NOW);
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    renameCompanion(db, ' Fiocco', 'Cloudy', NOW);
    expect(renamedEvents(db)).toHaveLength(1);
  });

  it('refuses a name longer than 20 characters and changes nothing', () => {
    const db = newGame(['meditation']);
    expect(() => renameCompanion(db, 'A'.repeat(21), 'Cloudy', NOW)).toThrow(RangeError);
    expect(db.select().from(companion).get()?.name).toBeNull();
    expect(renamedEvents(db)).toEqual([]);
  });

  it('keeps a chosen name when the theme changes, while the default follows the theme', () => {
    const db = newGame(['meditation']);
    // Default in Minimal: the name stays null, so Arcade shows its own default.
    renameCompanion(db, 'Cloudy', 'Cloudy', NOW);
    expect(getCompanionView(db, NOW).name).toBeNull();
    // Chosen in Minimal, then the user moves to Arcade and types the Arcade default: back to null.
    renameCompanion(db, 'Fiocco', 'Cloudy', NOW);
    expect(getCompanionView(db, NOW).name).toBe('Fiocco');
    renameCompanion(db, 'Pixel', 'Pixel', NOW);
    expect(getCompanionView(db, NOW).name).toBeNull();
  });
});
