import { createBoss, checkBossDeadlines, completeStarterStatsStep } from '@/db/repositories/boss';
import {
  completeMission,
  progressMission,
  setDayPlan,
  skipMission,
} from '@/db/repositories/completion';
import { changeHero } from '@/db/repositories/hero';
import { createMission, deleteMission, getMission, pauseMission } from '@/db/repositories/missions';
import { setSetting, setWeekRules } from '@/db/repositories/settings';
import { getTodayView } from '@/db/repositories/todayView';
import { undoEvent } from '@/db/repositories/undo';
import { daySummaries, hero, missionReminders } from '@/db/schema';
import { FRIDAY, at, clockAt, missionId, newGame } from '../../../test/game';

const TODAY = '2026-11-06';

function missionOf(view: ReturnType<typeof getTodayView>, id: string) {
  const found = view.missions.find((item) => item.mission.id === id);
  if (found === undefined) {
    throw new Error(`Mission ${id} is not in the view`);
  }
  return found;
}

describe('getTodayView', () => {
  it('gives hero, missions with their state, plan, bosses and counters on a normal day', () => {
    const db = newGame(['drink_water', 'read_pages', 'meditation']);
    const water = missionId(db, 'drink_water');
    const pages = missionId(db, 'read_pages');
    const meditation = missionId(db, 'meditation');
    completeMission(db, { missionId: meditation, source: 'app', ...clockAt(FRIDAY, 10) });
    progressMission(db, { missionId: water, source: 'app', ...clockAt(FRIDAY, 11) });
    setDayPlan(db, pages, clockAt(FRIDAY, 11));

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(view.day).toBe(TODAY);
    expect(view.restDay).toBe(false);
    expect(view.hero.name).toBe('Claudio');
    expect(view.xpToNext).toBeGreaterThan(view.hero.xpInLevel);
    expect(view.missions.map((item) => item.mission.id)).toEqual([water, pages, meditation]);
    expect(missionOf(view, meditation)).toMatchObject({
      state: 'done',
      doneAt: at(FRIDAY, 10),
      overdue: false,
    });
    expect(missionOf(view, water)).toMatchObject({ state: 'todo', value: 0.25, doneAt: null });
    expect(missionOf(view, pages)).toMatchObject({ state: 'todo', value: null });
    expect(view.plan).toEqual([pages]);
    expect(view.doneCount).toBe(1);
    expect(view.totalCount).toBe(3);
    // The quest of the first launch is the boss in progress.
    expect(view.bosses).toHaveLength(1);
    expect(view.bosses[0]).toMatchObject({ stepsDone: 2, stepsTotal: 3 });
    expect(view.bosses[0].nextStep?.title).toBe('starter_quest.steps.open_stats');
    // The first completion hatches the egg; a completion today makes the companion happy.
    expect(view.companion).toMatchObject({ stage: 'baby', mood: 'happy' });
    expect(view.notices).toEqual({
      exhausted: false,
      shieldUsedYesterday: false,
      coinsStolen: [],
      companionGrewTo: 'baby',
      resumedMissions: [],
    });
  });

  it('marks a skipped mission', () => {
    const db = newGame(['meditation']);
    const meditation = missionId(db, 'meditation');
    skipMission(db, { missionId: meditation, reason: 'rest', ...clockAt(FRIDAY, 10) });

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(missionOf(view, meditation).state).toBe('skipped');
    expect(view.doneCount).toBe(0);
  });

  it('gives skips left, reason and event of a skip, and leaves skipped missions out of the total', () => {
    const db = newGame(['meditation', 'journal']);
    const meditation = missionId(db, 'meditation');
    const journal = missionId(db, 'journal');
    // Friday 6 is the first skip of the week from Monday 2 November.
    const { eventId } = skipMission(db, {
      missionId: meditation,
      reason: 'illness',
      ...clockAt(FRIDAY, 10),
    });

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(missionOf(view, meditation)).toMatchObject({
      state: 'skipped',
      skipsLeft: 2,
      skipReason: 'illness',
      skipEventId: eventId,
      completionEventId: null,
    });
    expect(missionOf(view, journal)).toMatchObject({
      state: 'todo',
      skipsLeft: 3,
      skipReason: null,
      skipEventId: null,
    });
    expect(view.totalCount).toBe(1);
    expect(view.fullDay).toBe(false);
  });

  it('counts the skips of the week from the week start of the settings', () => {
    const db = newGame(['meditation'], 3);
    const meditation = missionId(db, 'meditation');
    for (const day of [3, 4]) {
      skipMission(db, { missionId: meditation, reason: 'travel', ...clockAt(day, 10) });
    }
    // Sunday 8 closes the week from Monday 2…
    expect(missionOf(getTodayView(db, clockAt(8, 12)), meditation).skipsLeft).toBe(1);
    // …and starts a new one with the week from Sunday.
    setWeekRules(db, { weekStart: 7 }, { today: '2026-11-03', now: at(3, 11) });
    expect(missionOf(getTodayView(db, clockAt(8, 12)), meditation).skipsLeft).toBe(3);
  });

  it('says when the day is full until an undo opens it again', () => {
    const db = newGame(['meditation', 'journal']);
    const meditation = missionId(db, 'meditation');
    completeMission(db, { missionId: meditation, source: 'app', ...clockAt(FRIDAY, 10) });
    const { eventId } = skipMission(db, {
      missionId: missionId(db, 'journal'),
      reason: 'rest',
      ...clockAt(FRIDAY, 11),
    });
    expect(getTodayView(db, clockAt(FRIDAY, 12))).toMatchObject({
      fullDay: true,
      doneCount: 1,
      totalCount: 1,
    });
    undoEvent(db, eventId, clockAt(FRIDAY, 12));
    expect(getTodayView(db, clockAt(FRIDAY, 12))).toMatchObject({
      fullDay: false,
      doneCount: 1,
      totalCount: 2,
    });
  });

  it('has no missions on a rest day', () => {
    const db = newGame(['meditation']);
    // 6 November 2026 is a Friday (5 with Monday = 1).
    setSetting(db, 'rest_days', [5], at(FRIDAY, 9));

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(view.restDay).toBe(true);
    expect(view.missions).toEqual([]);
    expect(view.totalCount).toBe(0);
  });

  it('keeps the missions of today when today becomes a rest day from tomorrow', () => {
    const db = newGame(['meditation']);
    setWeekRules(db, { restDays: [5, 6] }, { today: TODAY, now: at(FRIDAY, 9) });

    expect(getTodayView(db, clockAt(FRIDAY, 12)).restDay).toBe(false);
    expect(getTodayView(db, clockAt(FRIDAY, 12)).missions).toHaveLength(1);
    expect(getTodayView(db, clockAt(FRIDAY + 1, 12)).restDay).toBe(true);
    expect(getTodayView(db, clockAt(FRIDAY + 1, 12)).missions).toEqual([]);
  });

  it('tells when the hero is exhausted today', () => {
    const db = newGame(['meditation']);
    db.update(hero).set({ exhaustedDay: TODAY }).run();

    expect(getTodayView(db, clockAt(FRIDAY, 12)).notices.exhausted).toBe(true);
    expect(getTodayView(db, clockAt(FRIDAY + 1, 12)).notices.exhausted).toBe(false);
  });

  it('tells when the shield saved the streak yesterday', () => {
    const db = newGame(['meditation']);
    db.insert(daySummaries)
      .values({
        gameDay: TODAY,
        scheduledCount: 1,
        doneCount: 0,
        scheduledXp: 15,
        missedXp: 15,
        hpLost: 0,
        isRestDay: false,
        fullDay: false,
        planComplete: false,
        shieldUsed: true,
        closedAt: at(FRIDAY + 1, 6),
      })
      .run();

    expect(getTodayView(db, clockAt(FRIDAY + 1, 12)).notices.shieldUsedYesterday).toBe(true);
    expect(getTodayView(db, clockAt(FRIDAY + 2, 12)).notices.shieldUsedYesterday).toBe(false);
  });

  it('leaves out the deleted missions', () => {
    const db = newGame(['meditation', 'read_pages']);
    const meditation = missionId(db, 'meditation');
    deleteMission(db, meditation, clockAt(FRIDAY, 10));

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(view.missions.map((item) => item.mission.id)).toEqual([missionId(db, 'read_pages')]);
  });

  it('marks a task due before today as overdue', () => {
    const db = newGame(['meditation'], FRIDAY - 2);
    const task = createMission(
      db,
      { name: 'Chiama il dentista', kind: 'task', difficulty: 'easy', dueDay: '2026-11-05' },
      clockAt(FRIDAY - 2, 10),
    );

    expect(missionOf(getTodayView(db, clockAt(FRIDAY, 12)), task.id).overdue).toBe(true);
    expect(missionOf(getTodayView(db, clockAt(FRIDAY - 1, 12)), task.id).overdue).toBe(false);
  });

  it('puts overdue tasks first, then the missions by time, then the others', () => {
    const db = newGame(['meditation', 'read_pages', 'journal'], FRIDAY - 2);
    const meditation = missionId(db, 'meditation');
    const pages = missionId(db, 'read_pages');
    const journal = missionId(db, 'journal');
    db.insert(missionReminders)
      .values([
        { id: 'r1', missionId: journal, time: '21:00' },
        { id: 'r2', missionId: meditation, time: '08:00' },
        { id: 'r3', missionId: meditation, time: '07:30' },
      ])
      .run();
    const task = createMission(
      db,
      { name: 'Chiama il dentista', kind: 'task', difficulty: 'easy', dueDay: '2026-11-05' },
      clockAt(FRIDAY - 2, 10),
    );

    const view = getTodayView(db, clockAt(FRIDAY, 12));

    expect(view.missions.map((item) => item.mission.id)).toEqual([
      task.id,
      meditation,
      journal,
      pages,
    ]);
    expect(missionOf(view, meditation).time).toBe('07:30');
    expect(missionOf(view, pages).time).toBeNull();
  });

  it('gives the XP at stake, halved when the hero is exhausted', () => {
    const db = newGame(['read_pages', 'journal']);
    const pages = missionId(db, 'read_pages');

    expect(missionOf(getTodayView(db, clockAt(FRIDAY, 12)), pages).xp).toBe(25);
    db.update(hero).set({ exhaustedDay: TODAY }).run();
    expect(missionOf(getTodayView(db, clockAt(FRIDAY, 12)), pages).xp).toBe(13);
  });

  it('gives the completion event of a done mission until it is undone', () => {
    const db = newGame(['meditation', 'journal']);
    const meditation = missionId(db, 'meditation');
    const result = completeMission(db, {
      missionId: meditation,
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    const eventId = result.completion?.eventId ?? '';

    expect(missionOf(getTodayView(db, clockAt(FRIDAY, 12)), meditation).completionEventId).toBe(
      eventId,
    );
    undoEvent(db, eventId, clockAt(FRIDAY, 11));
    expect(missionOf(getTodayView(db, clockAt(FRIDAY, 12)), meditation)).toMatchObject({
      state: 'todo',
      completionEventId: null,
    });
  });

  it('tells when the bonus of the plan is given today, until the undo takes it back', () => {
    const db = newGame(['meditation', 'journal']);
    const meditation = missionId(db, 'meditation');
    setDayPlan(db, meditation, clockAt(FRIDAY, 9));
    expect(getTodayView(db, clockAt(FRIDAY, 9)).planBonus).toBe(false);

    const result = completeMission(db, {
      missionId: meditation,
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    expect(getTodayView(db, clockAt(FRIDAY, 11)).planBonus).toBe(true);

    undoEvent(db, result.completion?.eventId ?? '', clockAt(FRIDAY, 11));
    expect(getTodayView(db, clockAt(FRIDAY, 12)).planBonus).toBe(false);
  });

  it('tells the coins stolen today by a boss', () => {
    const db = newGame(['meditation']);
    changeHero(db, { coins: 300 }, at(FRIDAY, 10));
    const goal = createBoss(
      db,
      {
        name: 'Maratona',
        difficulty: 'medium',
        deadlineDay: TODAY,
        steps: ['Corri', 'Corri ancora'],
      },
      clockAt(FRIDAY, 10),
    );
    const { robbed } = checkBossDeadlines(db, clockAt(FRIDAY + 1, 8));

    const view = getTodayView(db, clockAt(FRIDAY + 1, 12));

    expect(view.notices.coinsStolen).toEqual([
      { bossId: goal.id, bossName: 'Maratona', coins: robbed[0].coins },
    ]);
    expect(getTodayView(db, clockAt(FRIDAY + 2, 12)).notices.coinsStolen).toEqual([]);
  });

  it('tells the missions back from a pause today, without the deleted ones', () => {
    const db = newGame(['meditation']);
    const meditation = missionId(db, 'meditation');
    pauseMission(db, meditation, '2026-11-07', clockAt(FRIDAY, 10));
    const gone = createMission(db, { name: 'Sparita' }, clockAt(FRIDAY, 10)).id;
    pauseMission(db, gone, '2026-11-07', clockAt(FRIDAY, 10));
    deleteMission(db, gone, clockAt(FRIDAY, 11));

    expect(getTodayView(db, clockAt(FRIDAY, 12)).notices.resumedMissions).toEqual([]);
    expect(getTodayView(db, clockAt(FRIDAY + 1, 12)).notices.resumedMissions).toEqual([
      { id: meditation, name: getMission(db, meditation)?.name },
    ]);
  });

  it('orders the active bosses by deadline, the ones without a deadline last', () => {
    const db = newGame(['meditation']);
    const later = createBoss(
      db,
      { name: 'Tardi', difficulty: 'easy', deadlineDay: '2026-11-20', steps: ['A', 'B'] },
      clockAt(FRIDAY, 10),
    );
    const sooner = createBoss(
      db,
      { name: 'Presto', difficulty: 'easy', deadlineDay: '2026-11-10', steps: ['A', 'B'] },
      clockAt(FRIDAY, 10),
    );

    const names = getTodayView(db, clockAt(FRIDAY, 12)).bosses.map((item) => item.boss.id);

    expect(names.slice(0, 2)).toEqual([sooner.id, later.id]);
  });

  it('gives the steps of the quest of the first launch while it is active', () => {
    const db = newGame(['journal']);
    expect(getTodayView(db, clockAt(FRIDAY, 10)).starterQuest).toEqual({
      bossId: expect.any(String),
      steps: [
        { title: 'starter_quest.steps.create_habit', done: true },
        { title: 'starter_quest.steps.complete_habit', done: false },
        { title: 'starter_quest.steps.open_stats', done: false },
      ],
    });

    completeMission(db, {
      missionId: missionId(db, 'journal'),
      source: 'app',
      ...clockAt(FRIDAY, 10),
    });
    const after = getTodayView(db, clockAt(FRIDAY, 11)).starterQuest;
    expect(after?.steps.map((step) => step.done)).toEqual([true, true, false]);

    completeStarterStatsStep(db, clockAt(FRIDAY, 11));
    expect(getTodayView(db, clockAt(FRIDAY, 12)).starterQuest).toBeNull();
  });
});
