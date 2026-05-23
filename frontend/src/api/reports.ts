import apiClient from './client'

export interface BtwBreakdownLine {
  rate: string
  base_srd: string
  btw_srd: string
  exempt: boolean
}

export interface TopProduct {
  product_name: string
  quantity: string
  revenue_srd: string
}

export interface ReportSummary {
  date_from: string
  date_to: string
  total_sales_srd: string
  transaction_count: number
  avg_basket_srd: string
  total_btw_srd: string
  total_discount_srd: string
  cash_total_srd: string
  card_total_srd: string
  mixed_total_srd: string
  btw_breakdown: BtwBreakdownLine[]
  top_products: TopProduct[]
  type?: string
}

export interface ZReportRecord {
  id: string
  store_id: string
  report_date: string
  total_sales_srd: string
  transaction_count: number
  total_btw_srd: string
  cash_total_srd: string
  card_total_srd: string
  expected_cash_srd: string
  actual_cash_srd: string | null
  cash_discrepancy_srd: string | null
  discrepancy_note: string | null
  top_products: TopProduct[]
  btw_breakdown: BtwBreakdownLine[]
  sync_status: 'pending' | 'sent' | 'failed'
  synced_at: string | null
  closed_by: string
  closed_at: string
}

export async function getDailyReport(storeId: string, date?: string): Promise<ReportSummary> {
  const { data } = await apiClient.get<{ data: ReportSummary }>('/reports/daily', {
    params: { store_id: storeId, date },
  })
  return data.data
}

export async function getMonthlyReport(
  storeId: string,
  year: number,
  month: number
): Promise<ReportSummary> {
  const { data } = await apiClient.get<{ data: ReportSummary }>('/reports/monthly', {
    params: { store_id: storeId, year, month },
  })
  return data.data
}

export async function getCustomReport(
  storeId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportSummary> {
  const { data } = await apiClient.get<{ data: ReportSummary }>('/reports/custom', {
    params: { store_id: storeId, date_from: dateFrom, date_to: dateTo },
  })
  return data.data
}

export async function getXReport(storeId: string): Promise<ReportSummary> {
  const { data } = await apiClient.get<{ data: ReportSummary }>('/reports/x-report', {
    params: { store_id: storeId },
  })
  return data.data
}

export async function closeZReport(
  storeId: string,
  actualCashSrd: string,
  discrepancyNote?: string
): Promise<ZReportRecord> {
  const { data } = await apiClient.post<{ data: ZReportRecord }>('/reports/z-report', {
    store_id: storeId,
    actual_cash_srd: actualCashSrd,
    discrepancy_note: discrepancyNote,
  })
  return data.data
}

export async function getZReportHistory(storeId: string): Promise<ZReportRecord[]> {
  const { data } = await apiClient.get<{ data: ZReportRecord[] }>('/reports/z-report/history', {
    params: { store_id: storeId },
  })
  return data.data
}

/** Manual "Submit to Headquarters" — sync option C. */
export async function submitZReport(zReportId: string): Promise<ZReportRecord> {
  const { data } = await apiClient.post<{ data: ZReportRecord }>(
    `/reports/z-report/${zReportId}/submit`
  )
  return data.data
}

export async function getBtwReport(
  storeId: string,
  dateFrom: string,
  dateTo: string
): Promise<ReportSummary> {
  const { data } = await apiClient.get<{ data: ReportSummary }>('/reports/btw', {
    params: { store_id: storeId, date_from: dateFrom, date_to: dateTo },
  })
  return data.data
}

export function getReportExportUrl(
  storeId: string,
  type: string,
  params: Record<string, string>
): string {
  const token = localStorage.getItem('josbin_pos_token') ?? ''
  const searchParams = new URLSearchParams({ store_id: storeId, type, ...params, token })
  return `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/reports/export?${searchParams}`
}
