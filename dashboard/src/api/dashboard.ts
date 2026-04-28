import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreOverview {
  store_id: string
  store_name: string
  city: string
  organisation_id: string
  organisation_name: string
  is_online: boolean
  last_seen_at: string | null
  today_revenue_srd: string
  today_transaction_count: number
  today_avg_basket_srd: string
  today_btw_srd: string
  top_product_name: string | null
  sync_status: 'synced' | 'pending' | 'failed' | 'never'
  last_z_report_date: string | null
  last_sync_at: string | null
}

export interface OrgOverview {
  organisation_id: string
  organisation_name: string
  type: string
  store_count: number
  online_stores: number
  today_revenue_srd: string
  today_transaction_count: number
  today_btw_srd: string
  stores: StoreOverview[]
}

export interface PlatformSummary {
  total_organisations: number
  total_stores: number
  online_stores: number
  today_revenue_srd: string
  today_transactions: number
  today_btw_srd: string
  orgs: OrgOverview[]
}

export interface ConsolidatedReport {
  date_from: string
  date_to: string
  transaction_count: number
  total_sales: string
  total_btw: string
  total_discounts: string
  avg_basket: string
  payment_breakdown: { cash: string; card: string; mixed: string }
  per_store: Array<{
    store_id: string
    store_name: string
    city: string | null
    organisation_id: string
    transaction_count: number
    total_sales: string
    total_btw: string
  }>
  top_products: Array<{
    name: string
    qty: string
    revenue: string
  }>
}

export interface BtwBreakdownLine {
  btw_rate: string
  btw_exempt: boolean
  gross_incl_btw: string
  btw_amount: string
  net_excl_btw: string
  sale_count: number
}

export interface ConsolidatedBtwReport {
  date_from: string
  date_to: string
  breakdown: BtwBreakdownLine[]
  total_btw: string
  total_gross: string
  format: string
}

export interface ZReportSummary {
  id: string
  store_id: string
  report_date: string
  total_sales_srd: string
  transaction_count: number
  total_btw_srd: string
  cash_total_srd: string
  card_total_srd: string
  cash_discrepancy_srd: string
  sync_status: 'pending' | 'synced' | 'failed' | 'never'
  synced_at: string | null
  closed_at: string
  store: { id: string; name: string; city: string; organisation_id: string } | null
  closed_by: { id: string; name: string } | null
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getPlatformSummary(): Promise<PlatformSummary> {
  const res = await apiClient.get<{ data: PlatformSummary }>('/dashboard/summary')
  return res.data.data
}

export async function getStoreDetail(storeId: string): Promise<StoreOverview> {
  const res = await apiClient.get<{ data: StoreOverview }>(`/dashboard/stores/${storeId}`)
  return res.data.data
}

export async function getConsolidatedReport(params: {
  date_from: string
  date_to: string
  org_id?: string
}): Promise<ConsolidatedReport> {
  const res = await apiClient.get<ConsolidatedReport>('/dashboard/reports/consolidated', { params })
  return res.data
}

export async function getConsolidatedBtwReport(params: {
  date_from: string
  date_to: string
  org_id?: string
}): Promise<ConsolidatedBtwReport> {
  const res = await apiClient.get<ConsolidatedBtwReport>('/dashboard/reports/btw', { params })
  return res.data
}

export async function getDashboardZReports(params: {
  date_from?: string
  date_to?: string
  sync_status?: string
  per_page?: number
  page?: number
}): Promise<{ data: ZReportSummary[]; total: number; per_page: number; current_page: number }> {
  const res = await apiClient.get('/dashboard/z-reports', { params })
  return res.data
}

export async function exportReport(
  type: 'consolidated' | 'btw',
  params: Record<string, string>,
): Promise<void> {
  const query = new URLSearchParams({ ...params, format: 'pdf' }).toString()
  const res = await apiClient.get(`/dashboard/reports/${type}/export?${query}`, {
    responseType: 'blob',
  })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `josbin-${type}-report.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
