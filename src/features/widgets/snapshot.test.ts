import { completeMission, setDayPlan, skipMission } from '@/db/repositories/completion';
import { createMission } from '@/db/repositories/missions';
import { setSetting } from '@/db/repositories/settings';
import { getTodayView } from '@/db/repositories/todayView';
import { THEMES } from '@/theme/themes';
import { FRIDAY, at, clockAt, missionId, newGame } from '../../../test/game';

import { buildWidgetSnapshot, decodeTarget, encodeTarget, widgetThemeOf } from './snapshot';
import { widgetTexts } from './texts';

const TODAY = '2026-11-06';
const texts = widgetTexts({ language: 'it', theme: 'minimal' });
const extras = { unseen: 0, texts, generation: 'g1' };
const minimal = widgetThemeOf('minimal');

function viewWith(names: number) {
  const db = newGame(['meditation', 'journal', 'read_pages']);
  for (let index = 3; index < names; index += 1) {
    createMission(db, { name: `Missione ${index + 1}` }, clockAt(FRIDAY, 9));
  }
  return db;
}

const view = (db: ReturnType<typeof newGame>) => getTodayView(db, clockAt(FRIDAY, 12));

describe('buildWidgetSnapshot (design-sezioni.md 12.1–12.3)', () => {
  it('shows 3 missions with no «e altre», with streak, level, remaining and progress', () => {
    const db = viewWith(3);
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);

    expect(snapshot).toMatchObject({
      day: TODAY,
      state: 'missions',
      essential: false,
      streak: 0,
      level: 1,
      levelText: 'Livello 1',
      done: 0,
      total: 3,
      remainingText: '3 rimaste',
      progressText: '0 di 3',
      more: 0,
      moreText: null,
      message: null,
      unseen: 0,
      pending: [],
    });
    expect(snapshot.missions).toHaveLength(3);
    const journal = snapshot.missions.find((item) => item.id === missionId(db, 'journal'));
    expect(journal).toMatchObject({
      done: false,
      measurable: false,
      detail: null,
      xp: expect.stringMatching(/^\+\d+$/),
      a11y: `Completa ${journal?.name}`,
      url: `ghq:///today?mission=${journal?.id}`,
    });
    expect(decodeTarget(journal?.target ?? '')).toEqual({
      kind: 'complete',
      missionId: journal?.id,
      day: TODAY,
      stamp: 'g1',
    });
    expect(snapshot.description).toBe('GHQ, serie 0 giorni, 3 rimaste');
    // The widget updates its texts after a touch before the app writes again.
    expect(snapshot.remainingTexts).toEqual(['Tutte fatte', '1 rimasta', '2 rimaste', '3 rimaste']);
    expect(snapshot.progressTexts[2]).toBe('2 di 3');
    expect(snapshot.fullDayText).toBe('Giornata completa!');
  });

  it('with 6 missions shows the first 3 and «e altre 3»', () => {
    const db = viewWith(6);
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);

    expect(snapshot.total).toBe(6);
    expect(snapshot.missions).toHaveLength(3);
    expect(snapshot.more).toBe(3);
    expect(snapshot.moreText).toBe('e altre 3');
    expect(snapshot.urls.more).toBe('ghq:///today');
  });

  it('shows 4 missions when there are exactly 4, and 2 with «e altre» with very large text', () => {
    const db = viewWith(4);
    expect(buildWidgetSnapshot(view(db), minimal, 'full', extras).missions).toHaveLength(4);
    const large = buildWidgetSnapshot(view(db), minimal, 'full', { ...extras, largeText: true });
    expect(large.missions).toHaveLength(2);
    expect(large.more).toBe(2);
  });

  it('puts the missions of the plan first, then the others, then the done ones at the bottom', () => {
    const db = newGame(['meditation', 'journal', 'read_pages']);
    const meditation = missionId(db, 'meditation');
    const journal = missionId(db, 'journal');
    const pages = missionId(db, 'read_pages');
    setDayPlan(db, pages, clockAt(FRIDAY, 10));
    completeMission(db, { missionId: meditation, source: 'app', ...clockAt(FRIDAY, 11) });

    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);

    expect(snapshot.missions.map((item) => item.id)).toEqual([pages, journal, meditation]);
    expect(snapshot.missions[2]).toMatchObject({ done: true, target: null, xp: null });
    expect(snapshot.progressText).toBe('1 di 3');
    expect(snapshot.remainingText).toBe('2 rimaste');
  });

  it('leaves the skipped missions out', () => {
    const db = newGame(['meditation', 'journal']);
    skipMission(db, {
      missionId: missionId(db, 'journal'),
      reason: 'rest',
      ...clockAt(FRIDAY, 10),
    });
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);
    expect(snapshot.missions.map((item) => item.id)).toEqual([missionId(db, 'meditation')]);
    expect(snapshot.total).toBe(1);
  });

  it('says «Giornata completa!» when everything is done', () => {
    const db = newGame(['meditation']);
    completeMission(db, {
      missionId: missionId(db, 'meditation'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);
    expect(snapshot.state).toBe('full_day');
    expect(snapshot.message).toBe('Giornata completa!');
    expect(snapshot.remainingText).toBe('Tutte fatte');
    expect(snapshot.companion.mood).toBe('happy');
  });

  it('says the rest day on a rest day and on a day with no missions', () => {
    const db = newGame(['meditation']);
    setSetting(db, 'rest_days', [5], at(FRIDAY, 9));
    const rest = buildWidgetSnapshot(view(db), minimal, 'full', extras);
    expect(rest).toMatchObject({ state: 'rest', missions: [], total: 0 });
    expect(rest.message).toBe('Giorno di riposo: la serie è al sicuro');
  });

  it('has no level and no XP in the Essential mode', () => {
    const db = newGame(['meditation', 'journal']);
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'essential', extras);
    expect(snapshot).toMatchObject({ essential: true, level: null, levelText: null });
    expect(snapshot.missions.every((item) => item.xp === null)).toBe(true);
    expect(snapshot.remainingText).toBe('2 rimaste');
  });

  it('adds the increment for a measurable mission and shows its value', () => {
    const db = newGame(['drink_water']);
    const snapshot = buildWidgetSnapshot(view(db), minimal, 'full', extras);
    const [water] = snapshot.missions;
    expect(water.detail).toBe('0 di 2 L');
    expect(water.a11y).toBe(`Aggiungi 0,25 L a ${water.name}`);
    expect(decodeTarget(water.target ?? '')).toEqual({
      kind: 'progress',
      missionId: water.id,
      day: TODAY,
      stamp: 'g1~0',
    });
    expect(water).toMatchObject({ value: 0, step: 0.25, goal: 2 });
  });

  it('gives the unseen notifications and the colours of the theme', () => {
    const db = newGame(['meditation']);
    const snapshot = buildWidgetSnapshot(view(db), widgetThemeOf('arcade'), 'full', {
      ...extras,
      unseen: 2,
    });
    expect(snapshot.unseen).toBe(2);
    expect(snapshot.unseenText).toBe('2 notifiche non viste');
    expect(snapshot.urls.open).toBe('ghq:///today?notifications=1');
    expect(snapshot.colors.light.background).toBe(THEMES.arcade.colors.background);
    expect(snapshot.colors.dark).toEqual(snapshot.colors.light);
    // Minimal follows the light or dark mode of the phone (design 12.4).
    const automatic = buildWidgetSnapshot(view(db), minimal, 'full', extras);
    expect(automatic.colors.light.background).toBe(THEMES['minimal-chiaro'].colors.background);
    expect(automatic.colors.dark.background).toBe(THEMES['minimal-scuro'].colors.background);
    expect(automatic.urls.open).toBe('ghq:///today');
  });

  it('uses the lexicon of the theme', () => {
    const db = newGame(['meditation']);
    const arcade = buildWidgetSnapshot(view(db), widgetThemeOf('arcade'), 'full', {
      ...extras,
      texts: widgetTexts({ language: 'it', theme: 'arcade' }),
    });
    expect(arcade.remainingText).toBe('1 rimasto');
  });
});

describe('widget targets', () => {
  it('encodes and decodes a completion and refuses anything else', () => {
    const target = encodeTarget({ kind: 'complete', missionId: 'm-1', day: TODAY, stamp: 'g1' });
    expect(decodeTarget(target)).toEqual({
      kind: 'complete',
      missionId: 'm-1',
      day: TODAY,
      stamp: 'g1',
    });
    expect(decodeTarget('x|m-1|2026-11-06|g1')).toBeNull();
    expect(decodeTarget('c|m-1|yesterday|g1')).toBeNull();
    expect(decodeTarget('c|m-1')).toBeNull();
  });
});
