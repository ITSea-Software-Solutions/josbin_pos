import apiClient from './client'

/**
 * Pending-payments queue — bank_transfer / mobile_transfer sales that the OA
 * hasn't yet confirmed funds for. Powered by the backend's partial index
 * `sales_pending_payment_idx`.
 */
export interface PendingPaymentSale {
  id: string
  sale_number: string
  store_id: string
  occurred_at: string
  total_srd: string
  payment_method: 'bank_transfer' | 'mobile_transfer'
  payment_provider: string | null      // bank / app name
  payment_reference: string | null     // sender's payment ref
  payment_sender_name: string | null
  payment_confirmed_at: string | null
  store?:    { id: string; name: string }
  cashier?:  { id: string; name: string }
  customer?: { id: string; name: string } | null
}

export interface PendingPaymentsPage {
  data: PendingPaymentSale[]
  current_page: number
  last_page: number
  total: number
}

export async function listPendingPayments(params: { store_id?: string; per_page?: number } = {}): Promise<PendingPaymentsPage> {
  const res = await apiClient.get<PendingPaymentsPage>('/sales/pending-payments', { params })
  return res.data
}

export async function confirmPendingPayment(saleId: string, note?: string): Promise<PendingPaymentSale> {
  const res = await apiClient.post<{ data: PendingPaymentSale }>(`/sales/${saleId}/confirm-payment`, { note })
  return res.data.data
}
