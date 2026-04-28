import apiClient from './client'
import type { Store } from '@/types/models'

export async function getMyStores(): Promise<Store[]> {
  const { data } = await apiClient.get<{ data: Store[] }>('/stores')
  return data.data
}

export async function getStore(storeId: string): Promise<Store> {
  const { data } = await apiClient.get<{ data: Store }>(`/stores/${storeId}`)
  return data.data
}
