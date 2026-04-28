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
