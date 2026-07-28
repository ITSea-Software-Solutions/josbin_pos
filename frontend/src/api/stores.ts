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

export interface ReceiptStamp { bits: Uint8Array; width: number; height: number }

/**
 * The store's own stamp for the foot of the thermal receipt, already packed
 * to 1 bit per dot by the server (it has the image pipeline; the tills do not,
 * and three platforms would otherwise need three of them).
 *
 * Returns null on 204 (nothing configured) AND on any error — a till that
 * cannot reach its server must still print, falling back to the Josbin mark
 * compiled into the app.
 */
export async function getReceiptStamp(storeId: string): Promise<ReceiptStamp | null> {
  try {
    const res = await apiClient.get(`/stores/${storeId}/receipt-stamp`)
    const d = res.data?.data
    if (!d?.b64) return null
    const bin = atob(d.b64)
    const bits = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i)
    return { bits, width: d.width, height: d.height }
  } catch {
    return null
  }
}
