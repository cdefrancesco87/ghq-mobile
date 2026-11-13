import type { MissionPlace } from '@/db/repositories/missions';

/** A category of Habits as reorder mode sees it: its key and its missions, in order. */
export interface ReorderGroup {
  readonly key: string | null;
  readonly ids: readonly string[];
}

/** One place between two rows: the category and the mission it comes before (null at the end). */
type Gap = MissionPlace;

/**
 * Where a mission lands when moved by `steps` places (design-sezioni.md 3.4, 3.11): one step is
 * one place between two rows, and the end of a category and the start of the next one are two
 * places, so «Sposta giù» on the last row of a category takes it to the top of the next one.
 * Null when it does not move.
 */
export function moveTarget(
  groups: readonly ReorderGroup[],
  missionId: string,
  steps: number,
): MissionPlace | null {
  const gaps: Gap[] = [];
  let from = -1;
  for (const { key, ids } of groups) {
    const others = ids.filter((id) => id !== missionId);
    const own = ids.indexOf(missionId);
    others.forEach((id, index) => {
      if (index === own) {
        from = gaps.length;
      }
      gaps.push({ categoryKey: key, beforeId: id });
    });
    if (own !== -1 && own === others.length) {
      from = gaps.length;
    }
    gaps.push({ categoryKey: key, beforeId: null });
  }
  if (from === -1 || steps === 0) {
    return null;
  }
  const to = Math.min(Math.max(from + Math.trunc(steps), 0), gaps.length - 1);
  return to === from ? null : gaps[to];
}
