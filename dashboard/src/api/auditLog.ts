import apiClient from './client'

export interface AuditEntry {
  id: number
  event: 'created' | 'updated' | 'deleted' | string
  model_type: string
  model_id: string
  user: { id: string; name: string; email: string; role: string } | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditPage {
  data: AuditEntry[]
  current_page: number
  last_page: number
  total: number
  per_page: number
}

export interface AuditSummary {
  total_30d: number
  by_event: Record<string, number>
  by_model: Record<string, number>
}

export interface AuditFilters {
  event?: string
  auditable_type?: string
  user_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  per_page?: number
}

export async function getAuditLog(filters: AuditFilters = {}): Promise<AuditPage> {
  const res = await apiClient.get<AuditPage>('/audit-log', { params: filters })
  return res.data
}

export async function getAuditSummary(): Promise<AuditSummary> {
  const res = await apiClient.get<AuditSummary>('/audit-log/summary')
  return res.data
}
