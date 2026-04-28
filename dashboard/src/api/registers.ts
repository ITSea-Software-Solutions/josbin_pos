import apiClient from './client'

export interface Register {
  id: string
  name: string
  number: number
  status: 'open' | 'closed' | 'reopen_requested'
  session: RegisterSession | null
}

export interface RegisterSession {
  id: string
  register_id: string
  register_name: string | null
  register_number: number | null
  cashier_id: string
  cashier_name: string | null
  cashier_email: string | null
  status: 'open' | 'closed' | 'reopen_requested' | 'reopen_approved'
  opening_float: string
  expected_cash: string | null
  closing_cash_counted: string | null
  discrepancy: string | null
  opened_at: string
  closed_at: string | null
  closing_note: string | null
  reopen_requested_at: string | null
  reopen_reason: string | null
  reopen_approved_by: string | null
  reopen_approved_at: string | null
  reopen_denial_reason: string | null
}

export async function getRegisters(storeId: string): Promise<Register[]> {
  const res = await apiClient.get<{ data: Register[] }>('/registers', { params: { store_id: storeId } })
  return res.data.data
}

export async function createRegister(storeId: string, name: string): Promise<Register> {
  const res = await apiClient.post<{ data: Register }>('/registers', { store_id: storeId, name })
  return res.data.data
}

export async function updateRegister(registerId: string, payload: { name?: string; is_active?: boolean }): Promise<Register> {
  const res = await apiClient.put<{ data: Register }>(`/registers/${registerId}`, payload)
  return res.data.data
}

export async function deleteRegister(registerId: string): Promise<void> {
  await apiClient.delete(`/registers/${registerId}`)
}

export async function getStoreSessions(storeId: string, date?: string): Promise<RegisterSession[]> {
  const res = await apiClient.get<{ data: RegisterSession[] }>('/registers/sessions', {
    params: { store_id: storeId, date },
  })
  return res.data.data
}

export async function approveReopen(sessionId: string, approved: boolean, denialReason?: string): Promise<RegisterSession> {
  const res = await apiClient.post<{ data: RegisterSession }>(`/registers/sessions/${sessionId}/approve-reopen`, {
    approved,
    denial_reason: denialReason,
  })
  return res.data.data
}
