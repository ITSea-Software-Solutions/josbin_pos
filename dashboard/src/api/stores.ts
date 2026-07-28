import apiClient from './client'
import type { Store } from '@/api/organisations'
export type { Store } from '@/api/organisations'

export async function getStores(orgId?: string): Promise<Store[]> {
  if (orgId) {
    const res = await apiClient.get<{ data: Store[] }>(`/organisations/${orgId}/stores`)
    return res.data.data
  }
  const res = await apiClient.get<{ data: Store[] }>('/stores')
  return res.data.data
}

export async function getStore(storeId: string): Promise<Store> {
  const res = await apiClient.get<{ data: Store }>(`/stores/${storeId}`)
  return res.data.data
}

export async function updateStore(storeId: string, payload: Partial<Store>): Promise<Store> {
  const res = await apiClient.put<{ data: Store }>(`/stores/${storeId}`, payload)
  return res.data.data
}

/** Any wallet name from the organisation's configured list (defaults:
 *  Mopé / Uni5Pay+) — the backend validates against that list. */
export type WalletProvider = string

/** Upload the store's static merchant QR for a wallet provider. The POS
 *  shows it full-screen during a QR payment so the customer scans from the
 *  screen. */
export async function uploadWalletQr(storeId: string, provider: WalletProvider, file: File): Promise<{ wallet_qr_path: string; wallet_qr_url: string }> {
  const form = new FormData()
  form.append('provider', provider)
  form.append('image', file)
  const res = await apiClient.post<{ data: { wallet_qr_path: string; wallet_qr_url: string } }>(
    `/stores/${storeId}/wallet-qr`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data
}

export async function deleteWalletQr(storeId: string, provider: WalletProvider): Promise<void> {
  await apiClient.delete(`/stores/${storeId}/wallet-qr`, { params: { provider } })
}

export async function uploadStoreLogo(storeId: string, file: File): Promise<{ receipt_logo_path: string; receipt_logo_url: string }> {
  const form = new FormData()
  form.append('logo', file)
  const res = await apiClient.post<{ data: { receipt_logo_path: string; receipt_logo_url: string } }>(
    `/stores/${storeId}/logo`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data
}

/**
 * Upload the image stamped at the foot of this store's printed receipts.
 *
 * The image is the SHOP's own — their logo or mark. It must not be used to
 * imply that a third party has approved, certified or verified the sale; a
 * government emblem in particular asserts an endorsement that does not exist,
 * which misleads the customer holding the receipt and is a trademark problem
 * for the agency whose mark it is.
 */
export async function uploadReceiptStamp(storeId: string, file: File): Promise<{ receipt_stamp_path: string }> {
  const fd = new FormData()
  fd.append('stamp', file)
  const res = await apiClient.post<{ data: { receipt_stamp_path: string } }>(
    `/stores/${storeId}/receipt-stamp`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data.data
}
