import { ShopScreen } from '@/features/shop/ShopScreen';
import { useShopView } from '@/features/shop/useShopView';

/** Negozio e inventario, from the coins of the hero card in Today and from the Profile (7.1). */
export default function Shop() {
  const view = useShopView();
  return view === null ? null : <ShopScreen view={view} />;
}
