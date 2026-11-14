import { getBadgesView } from '@/db/repositories/badges';
import { getHeatmap } from '@/db/repositories/heatmap';
import { listHabitsView } from '@/db/repositories/habitsView';
import { getProfileView, getStatDetail } from '@/db/repositories/profile';
import { getQuestLog, type QuestLogQuery } from '@/db/repositories/questLog';
import { getStatsView } from '@/db/repositories/statsView';
import {
  getCurrentWeeklyRecap,
  getPastWeeklyRecaps,
  getStatTrend,
} from '@/db/repositories/weeklyRecap';
import { QUEST_LOG } from '@/rules/config';

import { totalsFromLog, heroTotals } from '../../../test/db';
import { SEED_NOW, SEED_TZ, seedEventLog, type SeededLog } from '../../../test/eventLogSeed';

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
});
