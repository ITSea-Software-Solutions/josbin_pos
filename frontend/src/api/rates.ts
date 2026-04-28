import apiClient from './client'
import type { DailyRate } from '@/types/models'

export interface RatesResponse {
  today: DailyRate | null
  history: DailyRate[]
}

export async function getRates(): Promise<RatesResponse> {
  const { data } = await apiClient.get<{ data: RatesResponse }>('/rates')
  return data.data
}

export async function overrideRate(rateSrd: string, markupPct?: string): Promise<DailyRate> {
  const { data } = await apiClient.post<{ data: DailyRate }>('/rates/override', {
    rate_srd: rateSrd,
    markup_pct: markupPct,
  })
  return data.data
}

export async function fetchLiveRate(): Promise<DailyRate> {
  const { data } = await apiClient.post<{ data: DailyRate }>('/rates/fetch')
  return data.data
}
