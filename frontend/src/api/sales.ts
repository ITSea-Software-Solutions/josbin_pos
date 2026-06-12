import apiClient from './client'
import type { Sale, HeldBill } from '@/types/models'

export type PaymentMethodSlug = 'cash' | 'card' | 'mixed' | 'bank_transfer' | 'mobile_transfer' | 'foreign_cash'

export interface CreateSalePayload {
  store_id: string
  customer_id?: string | null
  payment_method: PaymentMethodSlug
  cash_tendered?: number
  card_amount?: number
  // Optional card reconciliation — copied from the bank's PIN terminal slip
  // so the OA can match card sales against the bank settlement statement.
  // Backend nulls these on cash-only sales even if accidentally sent.
  card_bank?: string
  card_approval_code?: string
  card_terminal_ref?: string
  card_last_four?: string
  // Phase 2 — bank_transfer / mobile_transfer / foreign_cash. See backend
  // migration 2026_05_26_050001_extend_payment_methods_for_suriname.php.
  payment_provider?: string       // bank name (transfer) OR app name (mobile)
  payment_reference?: string      // sender's payment ref / TX ID
  payment_sender_name?: string    // optional payer name (B2B / govt)
  foreign_currency?: 'USD' | 'EUR'
  foreign_amount?: number
  sale_discount_srd?: number
  sale_discount_pct?: number
  // Client-side idempotency key: send the same value on retries so the backend
  // returns the existing sale instead of creating a duplicate.
  external_sale_ref?: string
  items: Array<{
    product_id?: string | null
    product_name: string
    unit_price: number
    quantity: number
    btw_rate: number
    btw_exempt?: boolean
    discount_srd?: number
  }>
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const { data } = await apiClient.post<{ data: Sale }>('/sales', payload)
  return data.data
}

export async function holdBill(payload: {
  store_id: string
  label?: string
  customer_id?: string | null
  cart_data: unknown[]
  total_srd: number
}): Promise<HeldBill> {
  const { data } = await apiClient.post<{ data: HeldBill }>('/sales/hold', payload)
  return data.data
}

export async function getHeldBills(storeId: string): Promise<HeldBill[]> {
  const { data } = await apiClient.get<{ data: HeldBill[] }>('/sales/held', {
    params: { store_id: storeId },
  })
  return data.data
}

export async function restoreHeldBill(heldBillId: string): Promise<HeldBill> {
  const { data } = await apiClient.delete<{ data: HeldBill }>(`/sales/held/${heldBillId}`)
  return data.data
}

export async function voidSale(saleId: string, reason: string): Promise<Sale> {
  const { data } = await apiClient.post<{ data: Sale }>(`/sales/${saleId}/void`, {
    void_reason: reason,
  })
  return data.data
}

export interface RefundItemPayload {
  sale_item_id: string
  quantity: number
}

export async function refundSale(
  saleId: string,
  reason: string,
  items: RefundItemPayload[],
): Promise<Sale> {
  const { data } = await apiClient.post<{ data: Sale }>(`/sales/${saleId}/refund`, {
    reason,
    items,
  })
  return data.data
}

export async function getSales(params: {
  store_id: string
  date?: string
  search?: string
  status?: string
  per_page?: number
  page?: number
}): Promise<{ data: Sale[]; current_page: number; last_page: number; total: number }> {
  const { data } = await apiClient.get('/sales', { params })
  return data
}

export async function getSale(saleId: string): Promise<Sale> {
  const { data } = await apiClient.get<{ data: Sale }>(`/sales/${saleId}`)
  return data.data
}

export async function sendReceiptEmail(saleId: string, email: string, locale: string): Promise<void> {
  // The backend requires `email` (POST /sales/{id}/receipt/email validates
  // ['required','email']) — omitting it always 422'd, so the button never sent.
  await apiClient.post(`/sales/${saleId}/receipt/email`, { email, locale })
}

/**
 * Open a sale's receipt PDF in a new tab WITHOUT putting a token in the URL.
 *
 * Previously this returned a `?token=<session token>` URL — which leaked the
 * full token into browser history, server logs, and Referer headers (P0-5).
 * Instead we fetch the PDF over the authenticated XHR (Bearer header) as a
 * blob and open the local blob URL. A blank tab is opened synchronously inside
 * the click handler first, so the pop-up blocker doesn't swallow it.
 */
export async function openReceiptPdf(
  saleId: string, locale: string, cashTendered?: number, change?: number,
): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const params: Record<string, string> = { locale }
    if (cashTendered !== undefined) params.cash_tendered = String(cashTendered)
    if (change !== undefined) params.change = String(change)

    const res = await apiClient.get(`/sales/${saleId}/receipt/pdf`, { params, responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    if (win) win.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    if (win) win.close()
    throw e
  }
}
