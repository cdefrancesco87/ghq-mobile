// Main Quest and chains of goals (analisi-funzionale.md, section 5; design-sezioni.md 5.8):
// pure functions, the state lives in the columns `is_main` and `chain_prev_id` of the boss.

export type BossStatus = 'active' | 'locked' | 'defeated' | 'archived' | 'deleted';
export type BossKind = 'normal' | 'starter';

export interface ChainLink {
  readonly id: string;
  /** The boss this one follows in its chain, null at the head of a chain or out of any. */
  readonly chainPrevId: string | null;
}

/**
 * The order of Obiettivi with the chains: every boss right after the one it follows, so that a
 * chain is drawn as one column joined by a line. A chain takes the place of its first boss in the
 * list; a boss whose previous one is not in the list (defeated, archived) heads its chain.
 */
export function orderChains<T extends ChainLink>(items: readonly T[]): T[] {
  const ids = new Set(items.map((row) => row.id));
  const next = new Map<string, T>();
  for (const row of items) {
    if (row.chainPrevId !== null && ids.has(row.chainPrevId) && !next.has(row.chainPrevId)) {
      next.set(row.chainPrevId, row);
    }
  }
  const followers = new Set([...next.values()].map((row) => row.id));
  const ordered: T[] = [];
  const placed = new Set<string>();
  const place = (head: T) => {
    let current: T | undefined = head;
    while (current !== undefined && !placed.has(current.id)) {
      placed.add(current.id);
      ordered.push(current);
      current = next.get(current.id);
    }
  };
  for (const row of items) {
    if (!followers.has(row.id)) {
      place(row);
    }
  }
  // A loop has no head: its bosses keep their place rather than vanish.
  for (const row of items) {
    place(row);
  }
  return ordered;
}

/**
 * «Aggiungi il prossimo della catena»: a normal boss still to fight (active, or locked behind its
 * own previous one) gets at most one next boss. The quest of the first launch is not chained.
 */
export function canChainAfter(previous: {
  readonly status: BossStatus;
  readonly kind: BossKind;
  readonly hasNext: boolean;
}): boolean {
  return (
    (previous.status === 'active' || previous.status === 'locked') &&
    previous.kind === 'normal' &&
    !previous.hasNext
  );
}

/** «Fissa come Main Quest»: an active normal boss; a locked one waits for its turn. */
export function canBeMainQuest(target: {
  readonly status: BossStatus;
  readonly kind: BossKind;
}): boolean {
  return target.status === 'active' && target.kind === 'normal';
}
