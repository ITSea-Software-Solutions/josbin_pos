import { useQuery } from '@tanstack/react-query'
import { getLowStockProductIds } from '@/api/products'

/**
 * Returns a Set of product IDs that are currently flagged "low stock" for the
 * given store, used by the POS to show a yellow inline warning next to cart
 * lines / product cards.
 *
 * Why a separate query: the POS endpoint (`/api/products/pos`) returns
 * `stock_qty` per store but not `low_stock_threshold`, and the brief
 * explicitly forbids adding backend endpoints. The catalogue endpoint
 * already supports `?low_stock=1&store_id=…`, so we ask for just the IDs
 * and cache them.
 *
 * `stock_qty <= 0` (true out-of-stock) is checked separately at the call
 * site — that signal lives directly on the cart item, no extra request
 * needed.
 *
 * Refresh cadence is intentionally relaxed (5 min stale time): a missed
 * warning on a freshly-depleted product is at worst a soft "review with
 * manager" prompt, never a blocked sale.
 */
export function useLowStockSet(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ['low-stock-ids', storeId ?? null],
    queryFn: () => getLowStockProductIds(storeId ?? undefined),
    staleTime: 1000 * 60 * 5,
    enabled: !!storeId,
    // Empty Set keeps render code branch-free while loading.
    placeholderData: new Set<string>(),
  })
}
