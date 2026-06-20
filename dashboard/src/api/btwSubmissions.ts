import apiClient from './client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type BtwSubmissionStatus = 'filed' | 'accepted' | 'disputed' | 'superseded'
export type BtwSubmissionPeriodType = 'daily' | 'weekly' | 'monthly'

export interface BtwSubmission {
  id: string
  organisation_id: string
  store_id: string | null
  period_type: BtwSubmissionPeriodType
  period_start: string  // YYYY-MM-DD
  period_end: string    // YYYY-MM-DD
  sales_count: number
  total_sales_srd: string
  btw_exempt_srd: string
  btw_taxable_srd: string
  total_btw_srd: string
  status: BtwSubmissionStatus
  reference: string
  submitter_note: string | null
  inspector_note: string | null
  submitted_at: string
  submitted_by: string
  reviewed_at: string | null
  reviewed_by: string | null
  // Loaded relations
  organisation?: { id: string; name: string; btw_number?: string }
  store?:        { id: string; name: string } | null
  submitter?:    { id: string; name: string; email?: string }
  reviewer?:     { id: string; name: string; email?: string } | null
}

export interface BtwSubmissionPreview {
  period_type: BtwSubmissionPeriodType
  period_start: string
  period_end: string
  store_id: string | null
  totals: {
    sales_count: number
    total_sales_srd: string
    btw_exempt_srd: string
    btw_taxable_srd: string
    total_btw_srd: string
  }
  sale_count: number
  /** Set when an existing filing already covers this period (filed or accepted). */
  existing: { id: string; reference: string; status: BtwSubmissionStatus; submitted_at: string } | null
}

export interface BtwSubmissionFilters {
  organisation_id?: string
  status?: BtwSubmissionStatus
  period_type?: BtwSubmissionPeriodType
  from?: string
  to?: string
  page?: number
  per_page?: number
}

export interface PaginatedSubmissions {
  data: BtwSubmission[]
  current_page: number
  last_page: number
  total: number
  per_page: number
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function listBtwSubmissions(filters: BtwSubmissionFilters = {}): Promise<PaginatedSubmissions> {
  const res = await apiClient.get<PaginatedSubmissions>('/btw-submissions', { params: filters })
  return res.data
}

export async function previewBtwSubmission(payload: {
  period_type: BtwSubmissionPeriodType
  period_start: string
  period_end: string
  store_id?: string | null
}): Promise<BtwSubmissionPreview> {
  const res = await apiClient.post<BtwSubmissionPreview>('/btw-submissions/preview', payload)
  return res.data
}

export async function submitBtw(payload: {
  period_type: BtwSubmissionPeriodType
  period_start: string
  period_end: string
  store_id?: string | null
  submitter_note?: string
}): Promise<BtwSubmission> {
  const res = await apiClient.post<{ data: BtwSubmission }>('/btw-submissions', payload)
  return res.data.data
}

export async function getBtwSubmission(id: string): Promise<BtwSubmission> {
  const res = await apiClient.get<{ data: BtwSubmission }>(`/btw-submissions/${id}`)
  return res.data.data
}

export async function acceptBtwSubmission(id: string, note?: string): Promise<BtwSubmission> {
  const res = await apiClient.post<{ data: BtwSubmission }>(`/btw-submissions/${id}/accept`, { inspector_note: note })
  return res.data.data
}

export async function disputeBtwSubmission(id: string, note: string): Promise<BtwSubmission> {
  const res = await apiClient.post<{ data: BtwSubmission }>(`/btw-submissions/${id}/dispute`, { inspector_note: note })
  return res.data.data
}

/**
 * Task #80 — resubmit a correction. Marks the original superseded AND creates
 * a fresh `filed` row for the same period with recomputed totals (so any
 * voids/refunds since the original filing are reflected). Only the OA/SM of
 * the same org can supersede; SA/inspector cannot (would be forgery).
 */
export async function supersedeBtwSubmission(id: string, note?: string): Promise<BtwSubmission> {
  const res = await apiClient.post<{ data: BtwSubmission }>(`/btw-submissions/${id}/supersede`, { submitter_note: note })
  return res.data.data
}

// ─── Task #82 — inspector dashboard + detail breakdown ──────────────────────

export interface InspectorDashboardData {
  generated_at: string
  scope: 'platform' | 'own_org'
  totals: {
    btw_this_month_srd: string
    btw_last_month_srd: string
    pending_review: number
    disputed_open: number
    this_month_by_status: Record<string, number>
  }
  trend_30d: Array<{ date: string; btw_srd: string }>
  top_orgs_month: Array<{
    organisation_id: string
    organisation_name: string
    total_btw_srd: string
    filings: number
  }>
  late_filings: Array<{
    organisation_id: string
    organisation_name: string
    last_submission_at: string | null
    days_since: number | null
  }>
}

export async function getInspectorDashboard(): Promise<InspectorDashboardData> {
  const res = await apiClient.get<{ data: InspectorDashboardData }>('/btw-submissions/inspector-dashboard')
  return res.data.data
}

export interface BtwSubmissionDetail {
  submission: BtwSubmission & {
    organisation?: { id: string; name: string; btw_number?: string }
  }
  breakdown: {
    per_store: Array<{
      store_id: string; store_name: string;
      tx_count: number; total_sales_srd: string; total_btw_srd: string; btw_exempt_srd: string
    }>
    per_source: Array<{
      source: 'pos' | 'api' | 'import' | string
      source_label: string
      tx_count: number; total_sales_srd: string; total_btw_srd: string
    }>
    per_payment_method: Array<{ method: string; tx_count: number; total_srd: string }>
    per_btw_rate: Array<{ rate: string; exempt: boolean; base_srd: string; btw_srd: string }>
  }
  timeline: Array<{
    id: number; event: string; user_id: string;
    new_values: Record<string, unknown> | null;
    created_at: string
  }>
}

export async function getBtwSubmissionDetail(id: string): Promise<BtwSubmissionDetail> {
  const res = await apiClient.get<{ data: BtwSubmissionDetail }>(`/btw-submissions/${id}/detail`)
  return res.data.data
}

export interface BtwSubmissionFilters extends Record<string, unknown> {
  organisation_id?: string
  store_id?: string
  status?: BtwSubmissionStatus
  period_type?: BtwSubmissionPeriodType
  from?: string
  to?: string
  source?: 'pos' | 'api'
  search?: string
  year?: number
  min_amount?: number
  max_amount?: number
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
  per_page?: number
  page?: number
}

/** Inspector bulk action — accept many filed submissions at once. */
export async function bulkAcceptBtw(ids: string[], inspectorNote?: string): Promise<{ accepted: number; skipped: number }> {
  const res = await apiClient.post<{ accepted: number; skipped: number }>('/btw-submissions/bulk-accept', { ids, inspector_note: inspectorNote })
  return res.data
}

/** Download the filtered submission list as a CSV (auth via the bearer header). */
export async function exportBtwSubmissionsCsv(filters: BtwSubmissionFilters): Promise<void> {
  const res = await apiClient.get('/btw-submissions/export', { params: filters, responseType: 'blob' })
  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  const cd = (res.headers as Record<string, string>)['content-disposition']
  a.download = cd?.match(/filename="?([^"]+)"?/)?.[1] ?? 'btw-submissions.csv'
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

/** Wraps the existing list endpoint with the expanded filter set. */
export async function listBtwSubmissionsFiltered(filters: BtwSubmissionFilters): Promise<{ data: BtwSubmission[]; total: number; current_page: number; last_page: number }> {
  const res = await apiClient.get('/btw-submissions', { params: filters })
  return res.data
}
