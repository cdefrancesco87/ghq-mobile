import { useLocalSearchParams } from 'expo-router';

import { CompanionScreen } from '@/features/companion/CompanionScreen';
import { useCompanionView } from '@/features/companion/useCompanionView';
import { useShopView } from '@/features/shop/useShopView';

/**
 * The companion sheet, from the hero card in Today and from the Profile (design-sezioni.md 6.1);
 * with `?cheer=1` from «Dona» in the inventory, which opens it with the cheer (7.5).
 */
export default function Companion() {
  const view = useCompanionView();
  const shop = useShopView();
  const { cheer } = useLocalSearchParams<{ cheer?: string }>();
  return view === null || shop === null ? null : (
    <CompanionScreen view={view} gifts={shop.gifts} cheerOnOpen={cheer === '1'} />
  );
}
