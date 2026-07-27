import apiClient from './client'

export interface StockMovement {
  id: number
  product_id: string
  qty_change: number
  qty_after: number
  reason: 'sale' | 'void' | 'refund' | 'adjustment' | 'import' | 'initial'
  notes: string | null
  created_at: string
  user?: { id: string; name: string }
  sale?: { id: string; sale_number: string; occurred_at: string } | null
}

export async function getStockMovements(productId: string, params?: { per_page?: number; page?: number }) {
  const res = await apiClient.get<{ data: StockMovement[]; current_page: number; last_page: number; total: number }>(
    `/products/${productId}/stock-history`, { params }
  )
  return res.data
}

export async function adjustStock(productId: string, payload: {
  qty_change: number
  reason: 'adjustment' | 'import' | 'initial'
  notes?: string
  store_id?: string
}) {
  const res = await apiClient.post<{ data: { id: string; stock_qty: string } }>(`/products/${productId}/stock-adjust`, payload)
  return res.data.data
}

export interface LowStockProduct {
  id: string
  name_nl: string
  name_en: string
  barcode: string | null
  stock_qty: string
  low_stock_threshold: string
  category?: { name_nl: string; name_en: string } | null
}

export interface LowStockPage {
  data: LowStockProduct[]
  total: number
  last_page: number
}

export async function getLowStockProducts(params?: { per_page?: number; store_id?: string }): Promise<LowStockPage> {
  const res = await apiClient.get<{ data: LowStockProduct[]; total?: number; last_page?: number }>('/products', {
    params: {
      low_stock: true,
      per_page: params?.per_page ?? 50,
      active_only: true,
      ...(params?.store_id ? { store_id: params.store_id } : {}),
    },
  })
  const rows = res.data.data ?? []
  return {
    data: rows,
    total: res.data.total ?? rows.length,
    last_page: res.data.last_page ?? 1,
  }
}

/**
 * Tiny stock-alert summary used by the dashboard overview tile.
 *
 * We can't ask the backend for an out-of-stock count directly (no dedicated
 * filter exists and the brief explicitly forbids adding endpoints), so we
 * fetch up to `per_page` low-stock rows and split them client-side:
 *   - out  → stock_qty <= 0
 *   - low  → 0 < stock_qty <= threshold
 *
 * Payload stays small (under ~30 KB even at 200 rows) and lets one query
 * power both badges without a second round-trip.
 */
export async function getStockAlertSummary(storeId?: string): Promise<{
  low_count: number
  out_count: number
  total_count: number
}> {
  const res = await apiClient.get<{
    data: LowStockProduct[]
    total?: number
  }>('/products', {
    params: {
      low_stock: true,
      per_page: 200,
      active_only: true,
      ...(storeId ? { store_id: storeId } : {}),
    },
  })
  const rows = res.data.data ?? []
  let out = 0
  let low = 0
  for (const r of rows) {
    if (parseFloat(r.stock_qty) <= 0) out += 1
    else low += 1
  }
  // `total` from Laravel pagination is the authoritative combined figure,
  // fall back to the row count if it's missing.
  const total = typeof res.data.total === 'number' ? res.data.total : rows.length
  return { low_count: low, out_count: out, total_count: total }
}
