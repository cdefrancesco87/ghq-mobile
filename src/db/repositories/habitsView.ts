import { and, asc, inArray } from 'drizzle-orm';

import { TEMPLATE_CATEGORIES, type TemplateCategory } from '../../content/templates';
import { completionRate, pauseSpans, type PauseEvent } from '../../rules/missionRate';
import { isPausedOn, pauseLastDay } from '../../rules/pause';
import type { GameDay } from '../../rules/types';
import { events, missionDays, missions } from '../schema';
import type { Db } from '../types';
import { notDeleted, type EventType } from './events';
import type { ActionClock } from './hero';
import type { Mission } from './missions';
import { gameDayOf, getSetting } from './settings';
import { companionOn, type TodayView } from './todayView';

// The data of Habits (analisi-funzionale.md section 3, design-sezioni.md 3.1, 3.2, 3.7): every
// mission not deleted, with its streak and its completion rate of the last 30 days.

export interface HabitItem {
  readonly mission: Mission;
  /** From 0 to 100, or null when nothing was expected yet (`completionRate`). */
  readonly completionRate: number | null;
  /** The game day a single task was done, if it was. */
  readonly doneDay: GameDay | null;
  /** The game day of the archive, for the archived missions. */
  readonly archivedDay: GameDay | null;
  /** Paused today (design-sezioni.md 3.6): a pause past its end day is over by itself. */
  readonly paused: boolean;
  /** The last paused day, for «In pausa fino al …»; null without an end or when not paused. */
  readonly pausedLastDay: GameDay | null;
}

export interface HabitsCategory {
  /** A category of the templates, or null for «Senza categoria». */
  readonly key: TemplateCategory | null;
  readonly items: readonly HabitItem[];
}

export interface HabitsView {
  readonly today: GameDay;
  /** For the empty state (design-sezioni.md 3.8). */
  readonly companion: TodayView['companion'];
  /** The numbers of the filter chips; `all` is also the count of the active missions. */
  readonly counts: {
    readonly all: number;
    readonly habits: number;
    readonly tasks: number;
    readonly archived: number;
  };
  /**
   * The missions neither archived nor paused, by category in the order of the templates, without
   * empty ones.
   */
  readonly categories: readonly HabitsCategory[];
  /** The paused missions, in the order of the list: the group «In pausa» at the bottom (3.1). */
  readonly paused: readonly HabitItem[];
  /** The archived missions, the latest first. */
  readonly archived: readonly HabitItem[];
}

const RATE_EVENTS: EventType[] = [
  'mission.created',
  'mission.paused',
  'mission.resumed',
  'mission.archived',
  'mission.deleted',
];

function categoryOf(mission: Mission): TemplateCategory | null {
  const key = mission.categoryKey;
  return (TEMPLATE_CATEGORIES as readonly (string | null)[]).includes(key)
    ? (key as TemplateCategory)
    : null;
}

/** Every mission of Habits, read in a few queries. */
export function listHabitsView(db: Db, clock: ActionClock): HabitsView {
  const dayChange = getSetting(db, 'day_change');
  const today = gameDayOf(clock.now, clock.tzOffset, dayChange);
  const settings = {
    restDays: getSetting(db, 'rest_days'),
    weekStart: getSetting(db, 'week_start'),
  };
  const rows = db
    .select()
    .from(missions)
    .where(notDeleted(missions))
    .orderBy(asc(missions.sortOrder))
    .all();
  const ids = rows.map((row) => row.id);
  const days = db
    .select({
      missionId: missionDays.missionId,
      gameDay: missionDays.gameDay,
      status: missionDays.status,
    })
    .from(missionDays)
    .where(inArray(missionDays.missionId, ids))
    .all();
  const log = db
    .select({
      type: events.type,
      missionId: events.missionId,
      gameDay: events.gameDay,
      payload: events.payload,
    })
    .from(events)
    .where(and(inArray(events.missionId, ids), inArray(events.type, RATE_EVENTS)))
    .orderBy(asc(events.seq))
    .all();

  const itemOf = (mission: Mission): HabitItem => {
    const own = days.filter((day) => day.missionId === mission.id);
    const ownLog = log.filter((event) => event.missionId === mission.id);
    const archivedDay =
      mission.status === 'archived' && mission.archivedAt !== null
        ? gameDayOf(mission.archivedAt, clock.tzOffset, dayChange)
        : null;
    const createdDay =
      ownLog.find((event) => event.type === 'mission.created')?.gameDay ??
      gameDayOf(mission.createdAt, clock.tzOffset, dayChange);
    const pauses = pauseSpans(
      ownLog.map((event): PauseEvent => ({
        type: event.type,
        gameDay: event.gameDay,
        until: (event.payload.until as GameDay | null | undefined) ?? null,
      })),
    );
    const doneDays = own.filter((day) => day.status === 'done').map((day) => day.gameDay);
    const paused = isPausedOn(mission, today);
    return {
      mission,
      completionRate: completionRate({
        mission: { ...mission, createdDay },
        lastDay: archivedDay ?? today,
        days: own,
        pauses,
        ...settings,
      }),
      doneDay: mission.kind === 'task' && doneDays.length > 0 ? doneDays.sort()[0] : null,
      archivedDay,
      paused,
      pausedLastDay: paused ? pauseLastDay(mission.pausedUntil) : null,
    };
  };

  const current = rows.filter((row) => row.status !== 'archived').map(itemOf);
  const archived = rows
    .filter((row) => row.status === 'archived')
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
    .map(itemOf);
  const categories = [...TEMPLATE_CATEGORIES, null]
    .map((key) => ({
      key,
      items: current.filter((row) => !row.paused && categoryOf(row.mission) === key),
    }))
    .filter((category) => category.items.length > 0);
  const doneToday = days.filter((day) => day.gameDay === today && day.status === 'done').length;
  return {
    today,
    companion: companionOn(db, today, doneToday),
    counts: {
      all: current.length,
      habits: current.filter((row) => row.mission.kind === 'habit').length,
      tasks: current.filter((row) => row.mission.kind === 'task').length,
      archived: archived.length,
    },
    categories,
    paused: current.filter((row) => row.paused),
    archived,
  };
}
