import apiClient from './client'

export interface WeeklySummary {
  week_start: string
  narrative: string | null
  stats: {
    this_week: { count: number; total_srd: number; avg_basket: number; void_count: number }
    last_week: { count: number; total_srd: number; avg_basket: number }
    revenue_change_pct: number | null
    transaction_change_pct: number | null
    top_products: Array<{ name: string; qty: number; revenue: number }>
    period: { from: string; to: string }
  }
  locale: string
  generated_at: string
}

export interface AnomalyEntry {
  id: number
  detected_at: string
  sale_number: string | null
  store: string | null
  cashier: string | null
  total_srd: string | null
  flags: string[]
  ai_narrative: string | null
}

export async function getWeeklySummary(): Promise<WeeklySummary | null> {
  const res = await apiClient.get<{ data: WeeklySummary | null }>('/ai/weekly-summary')
  return res.data.data
}

export async function getAnomalies(days = 30): Promise<AnomalyEntry[]> {
  const res = await apiClient.get<{ data: AnomalyEntry[] }>('/ai/anomalies', {
    params: { days, limit: 20 },
  })
  return res.data.data
}
