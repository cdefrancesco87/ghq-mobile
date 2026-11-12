import type { Mission, NewMission } from '@/db/repositories/missions';
import type { Frequency } from '@/rules/frequency';
import type { Difficulty, GameDay, StatKey } from '@/rules/types';

// What the editor is changing, kept apart from the database row so that «Scartare le modifiche?»
// can compare it with what it started from (design-sezioni.md 4.12).

export interface Draft {
  readonly name: string;
  readonly kind: Mission['kind'];
  readonly difficulty: Difficulty;
  readonly statPrimary: StatKey | null;
  /** Habits only. */
  readonly frequency: Frequency;
  /** Tasks only; null is a task without a due day. */
  readonly dueDay: GameDay | null;
  /** `HH:MM`, habits only. */
  readonly reminders: readonly string[];
  readonly bossId: string | null;
}

const DAILY: Frequency = { type: 'daily' };

/** A new mission: a daily medium habit, linked to `bossId` when opened from a boss (4.1). */
export function newDraft(bossId: string | null): Draft {
  return {
    name: '',
    kind: 'habit',
    difficulty: 'medium',
    statPrimary: null,
    frequency: DAILY,
    dueDay: null,
    reminders: [],
    bossId,
  };
}

/** The draft of a saved mission, with its reminder times. */
export function draftOf(mission: Mission, reminders: readonly string[]): Draft {
  return {
    name: mission.name,
    kind: mission.kind,
    difficulty: mission.difficulty,
    statPrimary: mission.statPrimary,
    frequency: mission.frequency ?? DAILY,
    dueDay: mission.dueDay,
    reminders,
    bossId: mission.bossId,
  };
}

export function sameDraft(a: Draft, b: Draft): boolean {
  return (
    JSON.stringify({ ...a, name: a.name.trim() }) === JSON.stringify({ ...b, name: b.name.trim() })
  );
}

/** The advanced fields differ from those of a new mission: «Altre opzioni» opens by itself (4.5). */
export function hasAdvancedValues(draft: Draft): boolean {
  return (
    draft.frequency.type !== 'daily' ||
    draft.dueDay !== null ||
    draft.reminders.length > 0 ||
    draft.bossId !== null
  );
}

/** The fields of `createMission` and `updateMission`: each kind keeps only its own fields. */
export function missionInput(draft: Draft): NewMission & { readonly kind: Mission['kind'] } {
  const habit = draft.kind === 'habit';
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    difficulty: draft.difficulty,
    statPrimary: draft.statPrimary,
    frequency: habit ? draft.frequency : null,
    dueDay: habit ? null : draft.dueDay,
    reminders: habit ? draft.reminders : [],
    bossId: draft.bossId,
  };
}
