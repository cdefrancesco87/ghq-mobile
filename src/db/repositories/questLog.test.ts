import { eq } from 'drizzle-orm';

import { completeBossStep, createBoss } from '@/db/repositories/boss';
import { closePendingDays } from '@/db/repositories/closing';
import { completeMission, skipMission } from '@/db/repositories/completion';
import { deleteMission } from '@/db/repositories/missions';
import { getQuestLog, type QuestLogEntry, type QuestLogView } from '@/db/repositories/questLog';
import { createReward, redeemReward, updateReward } from '@/db/repositories/rewards';
import { buyItem } from '@/db/repositories/shop';
import { undoEvent } from '@/db/repositories/undo';
import { bossSteps, hero } from '@/db/schema';
import type { Db } from '@/db/types';

import { at, clockAt, missionId, newGame, TZ } from '../../../test/game';

// The game starts on Friday 6 November 2026 in Rome.

const DAILY = ['journal', 'no_social_evening'];

function giveCoins(db: Db, coins: number) {
  db.update(hero).set({ coins }).run();
}

function complete(db: Db, key: string, day: number, hour = 10) {
  return completeMission(db, {
    missionId: missionId(db, key),
    source: 'app',
    now: at(day, hour),
    tzOffset: TZ,
  });
}

const entries = (view: QuestLogView): QuestLogEntry[] => view.days.flatMap((day) => day.entries);
const types = (view: QuestLogView) => entries(view).map((entry) => entry.type);

describe('getQuestLog', () => {
  it('groups the entries by day, the latest first', () => {
    const db = newGame(DAILY);
    closePendingDays(db, clockAt(7, 9));
    complete(db, 'journal', 7, 9);
    complete(db, 'no_social_evening', 7, 11);
    complete(db, 'journal', 8, 10);
    const view = getQuestLog(db, clockAt(8, 12), { filter: 'completions' });
    expect(view.today).toBe('2026-11-08');
    expect(view.days.map((day) => day.day)).toEqual(['2026-11-08', '2026-11-07']);
    expect(view.days[1].entries.map((entry) => entry.missionName)).toEqual([
      'templates.no_social_evening.name',
      'templates.journal.name',
    ]);
    const first = view.days[0].entries[0];
    expect(first).toMatchObject({ type: 'mission.completed', gameDay: '2026-11-08' });
    expect(first.xp).toBeGreaterThan(0);
    expect(first.time).toBe('10:00');
  });

  it('names a redeemed reward as it was at the redemption, among the items', () => {
    const db = newGame(DAILY);
    giveCoins(db, 300);
    const id = createReward(db, { name: 'Pizza', size: 'small' }, clockAt(6, 10));
    redeemReward(db, id, clockAt(6, 11));
    updateReward(db, id, { name: 'Cinema', size: 'small' });
    const [entry] = entries(getQuestLog(db, clockAt(6, 12), { filter: 'items' }));
    expect(entry).toMatchObject({ type: 'reward.redeemed', rewardName: 'Pizza', coins: -100 });
  });

  it('filters by kind', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 6, 10);
    skipMission(db, {
      missionId: missionId(db, 'no_social_evening'),
      reason: 'illness',
      now: at(6, 11),
      tzOffset: TZ,
    });
    giveCoins(db, 100);
    buyItem(db, 'potion', clockAt(6, 12));
    const clock = clockAt(6, 13);
    expect(types(getQuestLog(db, clock, { filter: 'skips' }))).toEqual(['mission.skipped']);
    expect(types(getQuestLog(db, clock, { filter: 'items' }))).toEqual(['item.bought']);
    expect(types(getQuestLog(db, clock, { filter: 'completions' }))).toEqual(['mission.completed']);
    // The steps of the quest of the first launch: the creation and the first completion.
    expect(types(getQuestLog(db, clock, { filter: 'bosses' }))).toEqual([
      'boss.step_done',
      'boss.step_done',
    ]);
    const all = types(getQuestLog(db, clock, { filter: 'all' }));
    expect(all).toEqual(
      expect.arrayContaining(['item.bought', 'mission.skipped', 'mission.completed']),
    );
  });

  it('hides an undone completion together with its undo', () => {
    const db = newGame(DAILY);
    const done = complete(db, 'journal', 6, 10);
    complete(db, 'no_social_evening', 6, 10);
    undoEvent(db, done.completion!.eventId, clockAt(6, 11));
    const view = getQuestLog(db, clockAt(6, 12), { filter: 'all' });
    expect(entries(view).map((entry) => entry.id)).not.toContain(done.completion!.eventId);
    expect(types(view)).not.toContain('event.reverted');
    // The full day bonus given and taken back goes away too.
    expect(types(view)).not.toContain('bonus.full_day');
    expect(types(getQuestLog(db, clockAt(6, 12), { filter: 'completions' }))).toEqual([
      'mission.completed',
    ]);
  });

  it('leaves out the entries of deleted missions', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 6, 10);
    complete(db, 'no_social_evening', 6, 10);
    deleteMission(db, missionId(db, 'no_social_evening'), clockAt(6, 11));
    const view = getQuestLog(db, clockAt(6, 12), { filter: 'completions' });
    expect(entries(view).map((entry) => entry.missionName)).toEqual(['templates.journal.name']);
    expect(view.missions.map((mission) => mission.name)).not.toContain(
      'templates.no_social_evening.name',
    );
  });

  it('filters by mission and by dates', () => {
    const db = newGame(DAILY);
    for (const day of [6, 7, 8]) {
      closePendingDays(db, clockAt(day, 9));
      complete(db, 'journal', day, 10);
      complete(db, 'no_social_evening', day, 10);
    }
    const journal = missionId(db, 'journal');
    const view = getQuestLog(db, clockAt(8, 12), {
      filter: 'all',
      missionId: journal,
      from: '2026-11-07',
      to: '2026-11-08',
    });
    expect(entries(view).every((entry) => entry.missionId === journal)).toBe(true);
    expect(view.days.map((day) => day.day)).toEqual(['2026-11-08', '2026-11-07']);
  });

  it('marks as undoable only the completions, skips and steps of today', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 6, 10);
    closePendingDays(db, clockAt(7, 9));
    complete(db, 'no_social_evening', 7, 10);
    giveCoins(db, 100);
    buyItem(db, 'potion', clockAt(7, 10));
    const view = getQuestLog(db, clockAt(7, 12), { filter: 'all' });
    const undoable = entries(view)
      .filter((entry) => entry.undoable)
      .map((entry) => entry.type);
    expect(undoable).toEqual(['mission.completed']);
  });

  it('gives the boss of a step and the damage it dealt; the winning step cannot be undone', () => {
    const db = newGame(DAILY);
    const created = createBoss(
      db,
      { name: 'Tesi', difficulty: 'medium', steps: ['Uno', 'Due'] },
      clockAt(6, 10),
    );
    const steps = db
      .select()
      .from(bossSteps)
      .where(eq(bossSteps.bossId, created.id))
      .all()
      .sort((a, b) => a.position - b.position);
    completeBossStep(db, steps[0].id, clockAt(6, 11));
    let view = getQuestLog(db, clockAt(6, 12), { filter: 'bosses' });
    const step = entries(view).find((entry) => entry.bossId === created.id)!;
    expect(step).toMatchObject({ type: 'boss.step_done', bossName: 'Tesi', damage: 20 });
    expect(step.undoable).toBe(true);
    completeBossStep(db, steps[1].id, clockAt(6, 12));
    view = getQuestLog(db, clockAt(6, 13), { filter: 'bosses' });
    const ofBoss = entries(view).filter((entry) => entry.bossId === created.id);
    expect(ofBoss.map((entry) => entry.type)).toEqual([
      'boss.defeated',
      'boss.step_done',
      'boss.step_done',
    ]);
    expect(ofBoss.every((entry) => !entry.undoable)).toBe(true);
  });

  it('shows the hit points lost at the close of a day', () => {
    const db = newGame(DAILY);
    closePendingDays(db, clockAt(7, 9));
    const view = getQuestLog(db, clockAt(7, 10), { filter: 'all' });
    const closed = entries(view).find((entry) => entry.type === 'day.closed');
    expect(closed).toMatchObject({ gameDay: '2026-11-06' });
    expect(closed!.hp).toBeLessThan(0);
    expect(db.select().from(hero).get()!.hp).toBeLessThan(100);
  });

  it('leaves out health, bosses, coins and the shop in the Essential mode', () => {
    const db = newGame(DAILY);
    closePendingDays(db, clockAt(7, 9));
    complete(db, 'journal', 7, 10);
    giveCoins(db, 100);
    buyItem(db, 'potion', clockAt(7, 11));
    const clock = clockAt(7, 12);
    const full = types(getQuestLog(db, clock, { filter: 'all' }));
    expect(full).toEqual(
      expect.arrayContaining(['day.closed', 'item.bought', 'boss.step_done', 'mission.completed']),
    );
    const essential = types(getQuestLog(db, clock, { filter: 'all', essential: true }));
    expect(essential).toContain('mission.completed');
    expect(essential).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^(day\.closed|item\.|boss\.|bonus\.full_day|shield\.)/),
      ]),
    );
    expect(types(getQuestLog(db, clock, { filter: 'bosses', essential: true }))).toEqual([]);
    expect(types(getQuestLog(db, clock, { filter: 'items', essential: true }))).toEqual([]);
  });

  it('pages the entries', () => {
    const db = newGame(DAILY);
    complete(db, 'journal', 6, 10);
    complete(db, 'no_social_evening', 6, 11);
    const view = getQuestLog(db, clockAt(6, 12), { filter: 'completions', limit: 1 });
    expect(entries(view)).toHaveLength(1);
    expect(view.hasMore).toBe(true);
    expect(getQuestLog(db, clockAt(6, 12), { filter: 'completions' }).hasMore).toBe(false);
  });
});
