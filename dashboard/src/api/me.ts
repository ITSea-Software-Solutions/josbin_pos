import apiClient from './client'

export interface SalesWindow {
  count: number
  total_srd: string
  btw_srd: string
  avg_basket: string
}

export interface SalesSummary {
  today: SalesWindow
  week:  SalesWindow
  month: SalesWindow
  top_product_this_month: { name: string; revenue_srd: string; units: number } | null
  generated_at: string
}

export interface Shift {
  id: string
  store_name: string | null
  register_name: string
  status: 'open' | 'closed' | 'reopen_requested'
  opened_at: string | null
  closed_at: string | null
  opening_float: string | null
  closing_cash_counted: string | null
  expected_cash: string | null
  discrepancy: string | null
  closing_note: string | null
}

export async function getMySalesSummary(): Promise<SalesSummary> {
  const { data } = await apiClient.get<SalesSummary>('/me/sales-summary')
  return data
}

export async function getMyShifts(): Promise<Shift[]> {
  const { data } = await apiClient.get<{ data: Shift[] }>('/me/shifts')
  return data.data
}

export async function updateMyProfile(patch: { name?: string; email?: string; locale?: 'nl' | 'en' }) {
  const { data } = await apiClient.patch<{ data: { id: string; name: string; email: string; locale: string; role: string } }>('/me/profile', patch)
  return data.data
}

export async function changeMyPassword(payload: { current_password: string; new_password: string; new_password_confirmation: string }) {
  const { data } = await apiClient.post<{ message: string }>('/me/password', payload)
  return data
}
