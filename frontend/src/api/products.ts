import apiClient from './client'
import type { Product, Category } from '@/types/models'

export async function getPosProducts(storeId?: string): Promise<Product[]> {
  const params = storeId ? { store_id: storeId } : {}
  const { data } = await apiClient.get<{ data: Product[] }>('/products/pos', { params })
  return data.data
}

export async function getProductByBarcode(barcode: string, storeId?: string): Promise<Product> {
  const params = storeId ? { store_id: storeId } : {}
  const { data } = await apiClient.get<{ data: Product }>(`/products/barcode/${barcode}`, { params })
  return data.data
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<{ data: Category[] }>('/categories')
  return data.data
}

/**
 * Fetch the set of product IDs that are currently flagged "low stock" for
 * the given store. The POS /products/pos endpoint doesn't surface the
 * per-store low-stock threshold, so we ask the catalogue endpoint for the
 * filtered list and only keep IDs — fast, small, and avoids touching the
 * backend.
 *
 * Returns a Set for O(1) lookup in render code.
 */
export async function getLowStockProductIds(storeId?: string): Promise<Set<string>> {
  const params: Record<string, string | number | boolean> = {
    low_stock: true,
    active_only: true,
    per_page: 200,
  }
  if (storeId) params.store_id = storeId

  const { data } = await apiClient.get<{ data: Array<{ id: string }> }>('/products', { params })
  return new Set((data.data ?? []).map(p => p.id))
}

/**
 * Product ids this store sells most, ranked. Drives the "Populair" tab.
 *
 * Returns an empty list for a store with no history, which the UI treats as
 * "hide the tab" — a tab that does nothing is worse than no tab.
 */
export async function getPopularProductIds(storeId: string, days = 30): Promise<string[]> {
  try {
    const res = await apiClient.get('/products/popular', { params: { store_id: storeId, days } })
    return (res.data?.data?.product_ids as string[]) ?? []
  } catch {
    return []
  }
}
