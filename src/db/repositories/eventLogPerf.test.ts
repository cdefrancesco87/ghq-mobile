import { getBadgesView } from '@/db/repositories/badges';
import { getHeatmap } from '@/db/repositories/heatmap';
import { listHabitsView } from '@/db/repositories/habitsView';
import { getProfileView, getStatDetail } from '@/db/repositories/profile';
import {
  getQuestLog,
  QUEST_LOG_FILTERS,
  type QuestLogQuery,
  type QuestLogView,
} from '@/db/repositories/questLog';
import { getStatsView } from '@/db/repositories/statsView';
import {
  getCurrentWeeklyRecap,
  getPastWeeklyRecaps,
  getStatTrend,
  getWeeklyRecaps,
} from '@/db/repositories/weeklyRecap';
import { addDays } from '@/rules/gameDay';
import { QUEST_LOG } from '@/rules/config';

import { totalsFromLog, heroTotals } from '../../../test/db';
import { getQuestLogV1 } from '../../../test/legacy/questLogV1';
import {
  getCurrentWeeklyRecapV1,
  getPastWeeklyRecapsV1,
  getStatTrendV1,
  getWeeklyRecapsV1,
} from '../../../test/legacy/weeklyRecapV1';
import {
  SEED_NOW,
  SEED_TODAY,
  SEED_TZ,
  seedEventLog,
  type SeededLog,
} from '../../../test/eventLogSeed';

// Measurements of the views that read the event log, on a long game: about 3 years and 20,000
// events with GHQ_PERF_FULL=1, one year by default so that `npm test` stays fast. The timings are
// printed, not asserted: they depend on the machine.

const FULL = process.env.GHQ_PERF_FULL === '1';
const DAYS = FULL ? 1100 : 365;
const RUNS = FULL ? 5 : 2;

const clock = { now: SEED_NOW, tzOffset: SEED_TZ };

/** The median time of `RUNS` runs after a first one to warm up, in milliseconds. */
function measure(run: () => unknown): number {
  run();
  const times: number[] = [];
  for (let index = 0; index < RUNS; index++) {
    const start = process.hrtime.bigint();
    run();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

describe('event log views on a long game', () => {
  let seeded: SeededLog;

  beforeAll(() => {
    seeded = seedEventLog(DAYS);
  });

  it('writes a realistic log that adds up to the hero', () => {
    expect(seeded.events).toBeGreaterThan(DAYS * 15);
    expect(heroTotals(seeded.db)).toEqual(totalsFromLog(seeded.db));
  });

  it('measures the views', () => {
    const { db, missionIds } = seeded;
    const questLog = (query: QuestLogQuery) => () => getQuestLog(db, clock, query);
    const later = QUEST_LOG.pageSize * 10;
    const cases: [string, () => unknown][] = [
      ['questLog all, first page', questLog({ filter: 'all' })],
      [`questLog all, limit ${later}`, questLog({ filter: 'all', limit: later })],
      ['questLog completions, first page', questLog({ filter: 'completions' })],
      [`questLog completions, limit ${later}`, questLog({ filter: 'completions', limit: later })],
      ['questLog skips', questLog({ filter: 'skips' })],
      ['questLog one mission', questLog({ filter: 'all', missionId: missionIds.drink_water })],
      [
        'questLog one month',
        questLog({ filter: 'all', from: '2026-03-01', to: '2026-03-31' } as QuestLogQuery),
      ],
      ['questLog essential', questLog({ filter: 'all', essential: true })],
      ['statTrend', () => getStatTrend(db, clock)],
      ['weekly recap, current', () => getCurrentWeeklyRecap(db, clock)],
      ['weekly recaps, past', () => getPastWeeklyRecaps(db, clock)],
      ['statsView', () => getStatsView(db, clock)],
      ['habitsView', () => listHabitsView(db, clock)],
      ['heatmap', () => getHeatmap(db, clock)],
      ['profile', () => getProfileView(db, clock)],
      ['stat detail', () => getStatDetail(db, 'wisdom', clock)],
      ['badges', () => getBadgesView(db)],
    ];
    const lines = cases.map(([name, run]) => `${name.padEnd(40)} ${measure(run).toFixed(1)} ms`);
    console.log(`${seeded.events} events, ${DAYS} days\n${lines.join('\n')}`);
  });

  it('pages the Registro in SQL exactly as the old reading of the whole log', () => {
    const { db, missionIds } = seeded;
    const withoutCursor = ({ next: _next, ...view }: QuestLogView) => view;
    for (const filter of QUEST_LOG_FILTERS) {
      for (const essential of [false, true]) {
        for (const extra of [
          {},
          { limit: QUEST_LOG.pageSize * 7 },
          { limit: 100_000 },
          { missionId: missionIds.drink_water, limit: 400 },
          { missionId: missionIds.journal },
          { missionId: missionIds.tidy_desk },
          { from: '2026-03-01', to: '2026-04-15', limit: 1000 },
        ] as Partial<QuestLogQuery>[]) {
          const query: QuestLogQuery = { filter, essential, ...extra };
          expect(withoutCursor(getQuestLog(db, clock, query))).toEqual(
            getQuestLogV1(db, clock, query),
          );
        }
      }
    }
  });

  it('pages with a cursor through the same entries as one long list', () => {
    const { db } = seeded;
    const whole = getQuestLog(db, clock, { filter: 'all', limit: 100_000 });
    expect(whole.hasMore).toBe(false);
    expect(whole.next).toBeNull();
    const ids: string[] = [];
    let before: QuestLogView['next'] = null;
    let pages = 0;
    do {
      const page = getQuestLog(db, clock, { filter: 'all', limit: 500, before });
      ids.push(...page.days.flatMap((day) => day.entries.map((entry) => entry.id)));
      expect(page.next !== null).toBe(page.hasMore);
      before = page.next;
      pages += 1;
    } while (before !== null);
    expect(pages).toBeGreaterThan(1);
    expect(ids).toEqual(whole.days.flatMap((day) => day.entries.map((entry) => entry.id)));
  });

  it('reads the weekly recaps and the stat trend exactly as the old reading of the whole log', () => {
    const { db, firstDay } = seeded;
    // Today, a day in the middle of the game and the first days of the hero.
    for (const back of [0, 40, 200, DAYS - 3, DAYS - 20]) {
      const day = Date.UTC(2026, 10, 14 - back, 19, 30);
      const at = { now: day, tzOffset: SEED_TZ };
      expect(getStatTrend(db, at)).toEqual(getStatTrendV1(db, at));
      expect(getCurrentWeeklyRecap(db, at)).toEqual(getCurrentWeeklyRecapV1(db, at));
      expect(getPastWeeklyRecaps(db, at)).toEqual(getPastWeeklyRecapsV1(db, at));
    }
    const lastDays = [
      addDays(firstDay, -3),
      addDays(firstDay, 2),
      addDays(firstDay, 30),
      addDays(SEED_TODAY, -200),
      addDays(SEED_TODAY, -1),
    ];
    expect(getWeeklyRecaps(db, clock, lastDays)).toEqual(getWeeklyRecapsV1(db, clock, lastDays));
  });
});
