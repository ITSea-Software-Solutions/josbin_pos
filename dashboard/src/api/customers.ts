import apiClient from './client'

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  total_spend_srd: string
  visit_count: number
  /** Newest sale timestamp (ISO-8601) — null when the customer never bought. */
  last_visit_at: string | null
  created_at: string
}

/** One row of a customer's purchase history (GET /customers/{id}/history). */
export interface CustomerSale {
  id: string
  sale_number: string
  occurred_at: string | null
  store_name: string | null
  total_srd: string
  btw_srd: string
  discount_srd: string
  payment_method: string
  status: 'completed' | 'voided'
  /** Refund rows are completed sales with negative totals. */
  is_refund: boolean
}

export async function getCustomers(params?: {
  search?: string
  per_page?: number
  page?: number
}): Promise<{ data: Customer[]; current_page: number; last_page: number; total: number }> {
  const res = await apiClient.get('/customers', { params })
  return res.data
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await apiClient.get<{ data: Customer }>(`/customers/${id}`)
  return res.data.data
}

export async function getCustomerHistory(
  id: string,
  params?: { page?: number; per_page?: number },
): Promise<{ data: CustomerSale[]; current_page: number; last_page: number; total: number }> {
  const res = await apiClient.get(`/customers/${id}/history`, { params })
  return res.data
}

/**
 * Download the customer statement (PDF or CSV) for a date range.
 * Authenticated via the apiClient bearer token — no tokenless links.
 */
export async function downloadCustomerStatement(
  id: string,
  params: { from: string; to: string; format: 'pdf' | 'csv'; locale: 'nl' | 'en' },
): Promise<void> {
  const res = await apiClient.get(`/customers/${id}/statement`, {
    params,
    responseType: 'blob',
  })
  const mime = params.format === 'pdf' ? 'application/pdf' : 'text/csv'
  const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = `customer-statement-${params.from}-${params.to}.${params.format}`
  a.click()
  URL.revokeObjectURL(url)
}

export async function updateCustomer(id: string, payload: { name?: string; phone?: string; email?: string }): Promise<Customer> {
  const res = await apiClient.put<{ data: Customer }>(`/customers/${id}`, payload)
  return res.data.data
}

/**
 * WBP-S right-to-erasure. Redacts the customer's personal data on the server
 * (name tombstoned, phone/email/id_number + search hashes nulled) while
 * keeping the row + spend/visit counters so sales history stays intact.
 * OA + Super Admin only (403 otherwise).
 */
export async function redactCustomer(id: string): Promise<{ message: string }> {
  const res = await apiClient.delete<{ message: string }>(`/customers/${id}`)
  return res.data
}
