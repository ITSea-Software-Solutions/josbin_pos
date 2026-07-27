import apiClient from './client'

export interface Register {
  id: string
  name: string
  number: number
  /** 'open' = active session; 'closed_today' = sealed for the day per
   *  Z-Report semantics (manager must clear); 'available' = ready. */
  status: 'open' | 'closed_today' | 'available' | 'reopen_requested'
  session: RegisterSession | null
  closed_today: {
    session_id: string
    cashier_id: string
    cashier_name: string | null
    closed_at: string
  } | null
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

export async function createRegister(storeId: string, name: string, note?: string): Promise<Register> {
  const res = await apiClient.post<{ data: Register }>('/registers', { store_id: storeId, name, note })
  return res.data.data
}

export async function updateRegister(registerId: string, payload: { name?: string; is_active?: boolean }): Promise<Register> {
  const res = await apiClient.put<{ data: Register }>(`/registers/${registerId}`, payload)
  return res.data.data
}

export async function deleteRegister(registerId: string, note?: string): Promise<void> {
  await apiClient.delete(`/registers/${registerId}`, { data: { note } })
}

/**
 * Manager action: clear the "closed-today" lock on a register so the next
 * shift can open a new session. Reason is required; for_cashier is an
 * optional hint about who's expected to take over (free text).
 */
export async function clearClosedToday(
  registerId: string,
  reason: string,
  forCashier?: string,
): Promise<Register> {
  const res = await apiClient.post<{ data: Register }>(`/registers/${registerId}/clear-closed-today`, {
    reason,
    for_cashier: forCashier,
  })
  return res.data.data
}

/** Manager force-close of a live session — same endpoint the till uses;
 *  the backend stamps who closed it into the note when it isn't the
 *  session's own cashier. */
export async function closeSession(sessionId: string, countedCash: number, note?: string): Promise<RegisterSession> {
  const res = await apiClient.post<{ data: RegisterSession }>(`/registers/sessions/${sessionId}/close`, {
    closing_cash_counted: countedCash,
    closing_note: note || undefined,
  })
  return res.data.data
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
