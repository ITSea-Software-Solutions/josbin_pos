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

export interface ReceiptBitmap { bits: Uint8Array; width: number; height: number }
export interface ReceiptMarks { stamp: ReceiptBitmap | null; logo: ReceiptBitmap | null }

function unpack(d: { b64?: string; width: number; height: number } | null | undefined): ReceiptBitmap | null {
  if (!d?.b64) return null
  const bin = atob(d.b64)
  const bits = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i)
  return { bits, width: d.width, height: d.height }
}

/**
 * The store's printed marks — header logo and footer stamp — already packed
 * to 1 bit per dot by the server (it has the image pipeline; the three till
 * platforms do not, and would each need their own).
 *
 * Returns nulls on 204 (nothing configured) AND on any error: a till that
 * cannot reach its server must still print, just without the artwork.
 */
export async function getReceiptMarks(storeId: string): Promise<ReceiptMarks> {
  try {
    const res = await apiClient.get(`/stores/${storeId}/receipt-stamp`)
    const d = res.data?.data
    return { stamp: unpack(d?.stamp), logo: unpack(d?.logo) }
  } catch {
    return { stamp: null, logo: null }
  }
}
