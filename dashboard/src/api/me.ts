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

// ─── Task #72 — Activity log + Sessions for org-scoped roles ────────────────

export interface MyActivityRow {
  id: number
  event: string
  auditable_type: string
  auditable_id: string
  old_values: unknown
  new_values: unknown
  ip_address: string | null
  created_at: string
}

export async function getMyActivity(limit = 50): Promise<MyActivityRow[]> {
  const { data } = await apiClient.get<{ data: MyActivityRow[] }>('/me/activity', { params: { limit } })
  return data.data
}

export interface MySession {
  id: number
  name: string
  abilities_count: number
  last_used_at: string | null
  expires_at: string | null
  created_at: string | null
  is_current: boolean
}

export async function getMySessions(): Promise<MySession[]> {
  const { data } = await apiClient.get<{ data: MySession[] }>('/me/sessions')
  return data.data
}

export async function revokeMySession(tokenId: number): Promise<void> {
  await apiClient.delete(`/me/sessions/${tokenId}`)
}
