import { useMemo } from 'react';

import { getShopView, type ShopView } from '@/db/repositories/shop';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';

/**
 * The data of the shop, read again after every action like the companion sheet
 * (`useCompanionView`). Null before the profile exists.
 */
export function useShopView(): ShopView | null {
  const hero = useHeroStore((state) => state.hero);
  return useMemo(() => {
    if (hero === null) {
      return null;
    }
    return getShopView(getSession().db);
  }, [hero]);
}
