import { and, asc, eq, gte, inArray, isNotNull } from 'drizzle-orm';

import { addDays, isGameDay } from '../../rules/gameDay';
import {
  pauseIntervals,
  pauseLength,
  type PauseEvent,
  type PauseInterval,
} from '../../rules/pause';
import type { GameDay } from '../../rules/types';
import { boss, events } from '../schema';
import type { Db } from '../types';
import { appendEvent } from './events';
import type { ActionClock } from './hero';
import { gameDayOf, getSetting, writeGeneralPause } from './settings';

// The general pause for a holiday or an illness (US-IMP-06; CLAUDE.md, choice 23; modello-dati.md
// 3.10 and 4.2): the setting `general_pause` holds the pause in progress or scheduled, the
// `pause.*` events keep every pause in the log, so the day closing knows the paused days of the
// past. The pause ends by itself after its last day, at the day closing (endPauseIfOver).

const PAUSE_TYPES = ['pause.started', 'pause.changed', 'pause.ended'] as const;

/** The pause in progress or scheduled; null without one. */
export function getGeneralPause(db: Db): PauseInterval | null {
  const stored = getSetting(db, 'general_pause');
  return stored === null ? null : { fromDay: stored.from_day, untilDay: stored.until_day };
}

/** Every general pause of the log, the one in progress included (pauseIntervals). */
export function pauseIntervalsOf(db: Db): PauseInterval[] {
  const rows = db
    .select({ type: events.type, payload: events.payload })
    .from(events)
    .where(inArray(events.type, PAUSE_TYPES))
    .orderBy(asc(events.seq))
    .all();
  return pauseIntervals(rows as unknown as PauseEvent[]);
}

function todayOf(db: Db, clock: ActionClock): GameDay {
  return gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
}

function base(clock: ActionClock) {
  return {
    occurredAt: clock.now,
    tzOffset: clock.tzOffset,
    source: clock.source ?? 'app',
  } as const;
}

function assertDay(day: GameDay | null): void {
  if (day !== null && !isGameDay(day)) {
    throw new RangeError(`Invalid game day: ${day}`);
  }
}

function save(db: Db, pause: PauseInterval | null, now: number): void {
  writeGeneralPause(
    db,
    pause === null ? null : { from_day: pause.fromDay, until_day: pause.untilDay },
    now,
  );
}

/**
 * Ends the pause whose last day is before `today`: the deadlines of the active bosses that fall
 * from its first day on move forward by the paused days, so that a deadline inside the pause is
 * neither missed nor warned during it; a deadline already passed before the pause stays as it is
 * (no second theft, choice 20). The warning 3 days before starts again. Writes `pause.ended` and
 * clears the setting. The day closing calls it in its transaction, before the deadlines are checked.
 */
export function endPauseIfOver(tx: Db, clock: ActionClock, today: GameDay): void {
  const pause = getGeneralPause(tx);
  if (pause === null || pause.untilDay === null || pause.untilDay >= today) {
    return;
  }
  const days = pauseLength({ fromDay: pause.fromDay, untilDay: pause.untilDay });
  const moved = tx
    .select({ id: boss.id, deadlineDay: boss.deadlineDay })
    .from(boss)
    .where(
      and(
        // The locked bosses of a chain keep their deadline too (task T83).
        inArray(boss.status, ['active', 'locked']),
        isNotNull(boss.deadlineDay),
        gte(boss.deadlineDay, pause.fromDay),
      ),
    )
    .all()
    .map((row) => ({
      bossId: row.id,
      oldDeadlineDay: row.deadlineDay!,
      deadlineDay: addDays(row.deadlineDay!, days),
    }));
  for (const item of moved) {
    tx.update(boss)
      .set({ deadlineDay: item.deadlineDay, deadlineWarned: false, updatedAt: clock.now })
      .where(eq(boss.id, item.bossId))
      .run();
  }
  appendEvent(tx, {
    ...base(clock),
    source: 'system',
    type: 'pause.ended',
    payload: { fromDay: pause.fromDay, untilDay: pause.untilDay, days, bosses: moved },
  });
  save(tx, null, clock.now);
}

/** The pause still in force after ending the one already over. */
function currentPause(tx: Db, clock: ActionClock, today: GameDay): PauseInterval | null {
  endPauseIfOver(tx, clock, today);
  return getGeneralPause(tx);
}

/**
 * Starts a general pause today or on a later day, until its last day (included) or without an
 * end (design-sezioni.md 10.5). Refused with a pause already in progress or scheduled, with a start
 * in the past and with an end before the start.
 */
export function startPause(
  db: Db,
  { fromDay, untilDay }: PauseInterval,
  clock: ActionClock,
): PauseInterval {
  assertDay(fromDay);
  assertDay(untilDay);
  return db.transaction((tx) => {
    const today = todayOf(tx, clock);
    if (fromDay < today) {
      throw new RangeError(`A pause starts today or later: ${fromDay}`);
    }
    if (untilDay !== null && untilDay < fromDay) {
      throw new RangeError(`A pause cannot end before it starts: ${fromDay} – ${untilDay}`);
    }
    if (currentPause(tx, clock, today) !== null) {
      throw new Error('A general pause is already in progress or scheduled');
    }
    const pause = { fromDay, untilDay };
    save(tx, pause, clock.now);
    appendEvent(tx, { ...base(clock), type: 'pause.started', payload: { ...pause } });
    return pause;
  });
}

/** Cancels a scheduled pause before its first day, with `pause.ended` and `cancelled: true`. */
export function cancelPause(db: Db, clock: ActionClock): void {
  db.transaction((tx) => {
    const today = todayOf(tx, clock);
    const pause = currentPause(tx, clock, today);
    if (pause === null || pause.fromDay <= today) {
      throw new Error('Only a pause not started yet can be cancelled');
    }
    save(tx, null, clock.now);
    appendEvent(tx, {
      ...base(clock),
      type: 'pause.ended',
      payload: { fromDay: pause.fromDay, untilDay: pause.untilDay, cancelled: true },
    });
  });
}

function setEnd(
  tx: Db,
  clock: ActionClock,
  pause: PauseInterval,
  untilDay: GameDay | null,
  extra: Record<string, unknown> = {},
): PauseInterval {
  const changed = { fromDay: pause.fromDay, untilDay };
  save(tx, changed, clock.now);
  appendEvent(tx, {
    ...base(clock),
    type: 'pause.changed',
    payload: { fromDay: pause.fromDay, oldUntilDay: pause.untilDay, untilDay, ...extra },
  });
  return changed;
}

/**
 * «Cambia»: a new last day of the pause, or no end. Refused without a pause and with a day before
 * today or before the start of the pause.
 */
export function changePauseEnd(
  db: Db,
  untilDay: GameDay | null,
  clock: ActionClock,
): PauseInterval {
  assertDay(untilDay);
  return db.transaction((tx) => {
    const today = todayOf(tx, clock);
    const pause = currentPause(tx, clock, today);
    if (pause === null) {
      throw new Error('No general pause to change');
    }
    if (untilDay !== null && (untilDay < today || untilDay < pause.fromDay)) {
      throw new RangeError(`The pause cannot end before today or before it starts: ${untilDay}`);
    }
    return setEnd(tx, clock, pause, untilDay);
  });
}

/**
 * «Riprendi»: today becomes the last paused day, so from tomorrow everything counts again. The
 * pause ends at the next day closing, which moves the boss deadlines. Refused without a pause in
 * progress (a scheduled one is cancelled with cancelPause).
 */
export function resumePause(db: Db, clock: ActionClock): PauseInterval {
  return db.transaction((tx) => {
    const today = todayOf(tx, clock);
    const pause = currentPause(tx, clock, today);
    if (pause === null || pause.fromDay > today) {
      throw new Error('No general pause in progress');
    }
    return setEnd(tx, clock, pause, today, { resumed: true });
  });
}
