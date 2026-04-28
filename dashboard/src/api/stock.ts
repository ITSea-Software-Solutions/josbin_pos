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

export async function getLowStockProducts(params?: { per_page?: number }): Promise<LowStockProduct[]> {
  const res = await apiClient.get<{ data: LowStockProduct[] }>('/products', {
    params: { low_stock: true, per_page: params?.per_page ?? 50, active_only: true },
  })
  return res.data.data ?? []
}
