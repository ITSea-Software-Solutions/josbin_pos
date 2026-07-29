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
  // Serve from the till's own disk FIRST, then refresh behind the sale.
  //
  // These images change when a manager uploads a new one — a few times a year
  // — but they were fetched across the internet before the paper could move.
  // On a cold start that put a round trip to Suriname, plus the server's first
  // rasterisation of the day, between "sale complete" and the receipt coming
  // out. A shop should never wait on a network for artwork it already has, and
  // a shop with no internet must still print its own logo.
  const cached = readCachedMarks(storeId)
  if (cached) {
    void refreshMarks(storeId)   // fire and forget; next print gets any change
    return cached
  }
  return (await refreshMarks(storeId)) ?? { stamp: null, logo: null }
}

const MARKS_KEY = (storeId: string) => `josbin_pos_receipt_marks:${storeId}`

/** Fetch, cache to disk, return. Null on any failure — a till that cannot
 *  reach its server still prints, just without the artwork. */
async function refreshMarks(storeId: string): Promise<ReceiptMarks | null> {
  try {
    const res = await apiClient.get(`/stores/${storeId}/receipt-stamp`)
    const d = res.data?.data
    try {
      localStorage.setItem(MARKS_KEY(storeId), JSON.stringify({
        stamp: d?.stamp ?? null, logo: d?.logo ?? null,
      }))
    } catch { /* quota or private mode — the fetch still succeeded */ }
    return { stamp: unpack(d?.stamp), logo: unpack(d?.logo) }
  } catch {
    return null
  }
}

function readCachedMarks(storeId: string): ReceiptMarks | null {
  try {
    const raw = localStorage.getItem(MARKS_KEY(storeId))
    if (!raw) return null
    const d = JSON.parse(raw)
    return { stamp: unpack(d?.stamp), logo: unpack(d?.logo) }
  } catch {
    return null
  }
}
