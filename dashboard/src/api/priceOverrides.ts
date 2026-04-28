import apiClient from './client'

export interface PriceOverride {
  id: string
  product_id: string
  product_name: string
  base_price: string
  price_override: string
  is_active: boolean
}

export async function getPriceOverrides(storeId: string): Promise<PriceOverride[]> {
  const res = await apiClient.get<{ data: PriceOverride[] }>(`/stores/${storeId}/price-overrides`)
  return res.data.data
}

export async function upsertPriceOverride(storeId: string, productId: string, priceOverride: number): Promise<PriceOverride> {
  const res = await apiClient.post<{ data: PriceOverride }>(`/stores/${storeId}/price-overrides`, {
    product_id: productId,
    price_override: priceOverride,
  })
  return res.data.data
}

export async function deletePriceOverride(storeId: string, productId: string): Promise<void> {
  await apiClient.delete(`/stores/${storeId}/price-overrides/${productId}`)
}

export async function pushCatalogue(): Promise<{ product_count: number }> {
  const res = await apiClient.post<{ product_count: number }>('/products/push')
  return res.data
}
