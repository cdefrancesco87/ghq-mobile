import { canUsePotion, shopOffer } from '@/rules/shop';

describe('canUsePotion', () => {
  it('refuses at full hit points (choice 18)', () => {
    expect(canUsePotion(50)).toBe(false);
  });

  it('allows a potion below the maximum, even when it heals less than 10', () => {
    expect(canUsePotion(47)).toBe(true);
    expect(canUsePotion(0)).toBe(true);
  });

  it('rejects hit points that are not valid', () => {
    expect(() => canUsePotion(51)).toThrow(RangeError);
    expect(() => canUsePotion(-1)).toThrow(RangeError);
    expect(() => canUsePotion(2.5)).toThrow(RangeError);
  });
});

describe('shopOffer', () => {
  const potion = { price: 50, maxOwned: null };
  const shield = { price: 100, maxOwned: 2 };

  it('can be bought with enough coins, and says the balance after', () => {
    expect(shopOffer(potion, 245, 1)).toEqual({ state: 'buyable', missing: 0, balanceAfter: 195 });
    expect(shopOffer(potion, 50, 0)).toEqual({ state: 'buyable', missing: 0, balanceAfter: 0 });
  });

  it('says how many coins are missing', () => {
    expect(shopOffer(shield, 80, 0)).toEqual({ state: 'missing', missing: 20, balanceAfter: null });
  });

  it('refuses a third shield even with the coins, before the missing coins', () => {
    expect(shopOffer(shield, 500, 2)).toEqual({ state: 'max', missing: 0, balanceAfter: null });
    expect(shopOffer(shield, 10, 2)).toEqual({ state: 'max', missing: 0, balanceAfter: null });
  });

  it('rejects coins or quantities that are not valid', () => {
    expect(() => shopOffer(potion, -1, 0)).toThrow(RangeError);
    expect(() => shopOffer(potion, 10, 1.5)).toThrow(RangeError);
  });
});
