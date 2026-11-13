import { useCallback, useMemo, useState } from 'react';

import { listRewards, type RewardsPage } from '@/db/repositories/rewards';
import { getShopView, type ShopView } from '@/db/repositories/shop';
import { REWARDS } from '@/rules/config';
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

/**
 * The personal rewards, read a page at a time: `loadMore` asks for the next page when the list
 * reaches its end (design 7.6, no limit). Read again after every action.
 */
export function useRewards(): RewardsPage & { readonly loadMore: () => void } {
  const hero = useHeroStore((state) => state.hero);
  const [limit, setLimit] = useState<number>(REWARDS.pageSize);
  const page = useMemo(
    () =>
      hero === null ? { rewards: [], hasMore: false } : listRewards(getSession().db, { limit }),
    [hero, limit],
  );
  const { hasMore } = page;
  const loadMore = useCallback(() => {
    if (hasMore) {
      setLimit((current) => current + REWARDS.pageSize);
    }
  }, [hasMore]);
  return { ...page, loadMore };
}
