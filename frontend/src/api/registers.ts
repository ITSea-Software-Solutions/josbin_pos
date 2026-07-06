import apiClient from './client'

export interface Register {
  id: string
  name: string
  number: number
  /** 'open' = session active; 'closed_today' = sealed for the day per
   *  Z-Report semantics; 'available' = ready to open. */
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

export interface SessionReport {
  session: RegisterSession
  transaction_count: number
  refund_count: number
  void_count: number
  void_total: string
  items_sold: string
  gross_sales: string
  discounts_total: string
  refunds_total: string
  net_sales: string
  /** @deprecated use net_sales */
  total_sales: string
  total_btw: string
  payment_breakdown: {
    cash: string; card: string; mixed: string
    bank_transfer?: string; mobile_transfer?: string; foreign_cash?: string; qr_payment?: string
  }
  cash_drawer: {
    opening_float: string
    cash_in: string
    cash_out: string
    expected: string
  }
  opening_float: string
  expected_cash: string | null
  closing_cash_counted: string | null
  discrepancy: string | null
}

export async function getRegisters(storeId: string): Promise<Register[]> {
  const res = await apiClient.get<{ data: Register[] }>('/registers', { params: { store_id: storeId } })
  return res.data.data
}

export async function getMySession(storeId: string): Promise<RegisterSession | null> {
  const res = await apiClient.get<{ data: RegisterSession | null }>('/registers/my-session', { params: { store_id: storeId } })
  return res.data.data
}

export async function openRegister(registerId: string, openingFloat: number): Promise<RegisterSession> {
  const res = await apiClient.post<{ data: RegisterSession }>(`/registers/${registerId}/open`, { opening_float: openingFloat })
  return res.data.data
}

export async function closeRegister(sessionId: string, closingCashCounted: number, closingNote?: string): Promise<RegisterSession> {
  const res = await apiClient.post<{ data: RegisterSession }>(`/registers/sessions/${sessionId}/close`, {
    closing_cash_counted: closingCashCounted,
    closing_note: closingNote,
  })
  return res.data.data
}

export interface CashMovementResult {
  id: string
  direction: 'in' | 'out'
  amount: string
  reason: string
  created_at: string
  expected_cash: string
}

export async function recordCashMovement(
  sessionId: string,
  direction: 'in' | 'out',
  amount: number,
  reason: string,
): Promise<CashMovementResult> {
  const res = await apiClient.post<{ data: CashMovementResult }>(
    `/registers/sessions/${sessionId}/cash-movements`,
    { direction, amount, reason },
  )
  return res.data.data
}

export async function requestReopen(sessionId: string, reason: string): Promise<RegisterSession> {
  const res = await apiClient.post<{ data: RegisterSession }>(`/registers/sessions/${sessionId}/request-reopen`, { reopen_reason: reason })
  return res.data.data
}

export async function getSessionReport(sessionId: string): Promise<SessionReport> {
  const res = await apiClient.get<{ data: SessionReport }>(`/registers/sessions/${sessionId}/report`)
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
