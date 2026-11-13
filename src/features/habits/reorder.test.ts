import { moveTarget } from './reorder';

const GROUPS = [
  { key: 'health', ids: ['a', 'b', 'c'] },
  { key: 'mind', ids: ['m'] },
  { key: null, ids: ['n'] },
];

describe('moveTarget', () => {
  it('moves up and down inside a category', () => {
    expect(moveTarget(GROUPS, 'b', -1)).toEqual({ categoryKey: 'health', beforeId: 'a' });
    expect(moveTarget(GROUPS, 'b', 1)).toEqual({ categoryKey: 'health', beforeId: null });
    expect(moveTarget(GROUPS, 'a', 1)).toEqual({ categoryKey: 'health', beforeId: 'c' });
  });

  it('crosses into the next or the previous category', () => {
    expect(moveTarget(GROUPS, 'c', 1)).toEqual({ categoryKey: 'mind', beforeId: 'm' });
    expect(moveTarget(GROUPS, 'm', -1)).toEqual({ categoryKey: 'health', beforeId: null });
    expect(moveTarget(GROUPS, 'm', 1)).toEqual({ categoryKey: null, beforeId: 'n' });
    expect(moveTarget(GROUPS, 'a', 4)).toEqual({ categoryKey: 'mind', beforeId: null });
  });

  it('stops at the ends of the list and ignores a mission that is not there', () => {
    expect(moveTarget(GROUPS, 'a', -1)).toBeNull();
    expect(moveTarget(GROUPS, 'n', 1)).toBeNull();
    expect(moveTarget(GROUPS, 'n', 99)).toBeNull();
    expect(moveTarget(GROUPS, 'a', -99)).toBeNull();
    expect(moveTarget(GROUPS, 'c', 99)).toEqual({ categoryKey: null, beforeId: null });
    expect(moveTarget(GROUPS, 'x', 1)).toBeNull();
    expect(moveTarget(GROUPS, 'b', 0)).toBeNull();
  });
});
