import { canChainAfter, canBeMainQuest, orderChains } from '@/rules/chain';

const item = (id: string, chainPrevId: string | null = null) => ({ id, chainPrevId });

describe('orderChains', () => {
  it('keeps the order of bosses without a chain', () => {
    const list = [item('a'), item('b'), item('c')];
    expect(orderChains(list).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts every boss right after the one it follows, the whole chain in order', () => {
    const list = [item('c', 'b'), item('x'), item('b', 'a'), item('a'), item('y')];
    expect(orderChains(list).map((row) => row.id)).toEqual(['x', 'a', 'b', 'c', 'y']);
  });

  it('starts a chain whose previous boss is not in the list where the chain starts', () => {
    // The first one of the list follows a defeated boss: it heads its chain.
    const list = [item('x'), item('b', 'gone'), item('c', 'b')];
    expect(orderChains(list).map((row) => row.id)).toEqual(['x', 'b', 'c']);
  });

  it('never loses a boss, even with a loop in the data', () => {
    const list = [item('a', 'b'), item('b', 'a'), item('c')];
    expect(
      orderChains(list)
        .map((row) => row.id)
        .sort(),
    ).toEqual(['a', 'b', 'c']);
  });
});

describe('canChainAfter', () => {
  it('lets a normal boss, active or locked, have one next boss', () => {
    expect(canChainAfter({ status: 'active', kind: 'normal', hasNext: false })).toBe(true);
    expect(canChainAfter({ status: 'locked', kind: 'normal', hasNext: false })).toBe(true);
  });

  it('refuses a boss that already has its next one, the starter quest and bosses that left', () => {
    expect(canChainAfter({ status: 'active', kind: 'normal', hasNext: true })).toBe(false);
    expect(canChainAfter({ status: 'active', kind: 'starter', hasNext: false })).toBe(false);
    for (const status of ['defeated', 'archived', 'deleted'] as const) {
      expect(canChainAfter({ status, kind: 'normal', hasNext: false })).toBe(false);
    }
  });
});

describe('canBeMainQuest', () => {
  it('is only an active normal boss', () => {
    expect(canBeMainQuest({ status: 'active', kind: 'normal' })).toBe(true);
    expect(canBeMainQuest({ status: 'active', kind: 'starter' })).toBe(false);
    expect(canBeMainQuest({ status: 'locked', kind: 'normal' })).toBe(false);
    expect(canBeMainQuest({ status: 'defeated', kind: 'normal' })).toBe(false);
  });
});
