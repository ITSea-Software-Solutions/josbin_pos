import apiClient from './client'

/* ── Analytics series (drives every report chart) ─────────────────────────── */

export interface SeriesTrend { date: string; sales: number; btw: number; txns: number; basket: number }
export interface SeriesRow   { name: string; total: number; txns: number; basket?: number; btw?: number }
export interface SeriesBtw   { rate: string; base: number; btw: number }
export interface SeriesProd  { name: string; qty: number; revenue: number }
export interface SeriesPay   { method: string; total: number; txns: number }

export interface ReportSeries {
  date_from: string
  date_to: string
  trend: SeriesTrend[]
  payments: SeriesPay[]
  btw: SeriesBtw[]
  products: SeriesProd[]
  cashiers: SeriesRow[]
  stores: SeriesRow[]
}

/**
 * One request for every chart on the screen.
 *
 * Scope follows the caller: pass store_id for one store, omit it for the
 * caller's whole organisation. A tax inspector reads across organisations and
 * may narrow with organisation_id.
 */
export async function getReportSeries(params: {
  store_id?: string
  organisation_id?: string
  date_from?: string
  date_to?: string
}): Promise<ReportSeries> {
  const res = await apiClient.get('/reports/series', { params })
  return res.data.data as ReportSeries
}
