import apiClient from './client'

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  total_spend_srd: string
  visit_count: number
  created_at: string
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
