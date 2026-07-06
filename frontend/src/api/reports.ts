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
  bank_transfer_total_srd?: string
  mobile_transfer_total_srd?: string
  foreign_cash_total_srd?: string
  qr_payment_total_srd?: string
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

/**
 * Open a report PDF in a new tab WITHOUT putting a token in the URL.
 *
 * Mirrors openReceiptPdf in api/sales.ts. The old implementation built a
 * `?token=<session token>` URL for window.open — the backend (rightly, P0-5)
 * ignores broad session tokens in query strings, so the request 401'd, and
 * the token leaked into history/logs/Referer. Fetch over the authenticated
 * XHR (Bearer header) instead and open the local blob URL. The blank tab is
 * opened synchronously inside the click handler so the pop-up blocker
 * doesn't swallow it.
 */
export async function openReportPdf(
  storeId: string,
  type: string,
  params: Record<string, string>
): Promise<void> {
  const win = window.open('', '_blank')
  try {
    const res = await apiClient.get('/reports/export', {
      params: { store_id: storeId, type, ...params },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    if (win) win.location.href = url
    else window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    if (win) win.close()
    throw e
  }
}
