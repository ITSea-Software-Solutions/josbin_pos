/**
 * Licence API client.
 *
 * Extracted out of LicenseScreen so other screens (StoresScreen banner, OA
 * dashboard quick-glance) can consume the same shape without duplicating the
 * fetcher. The backend route returns a flat array under `data`.
 */
import apiClient from './client'

export interface License {
  id: string
  /** Human-readable reference for sharing with the customer, e.g. JBN-3196-69C7-A119. */
  reference: string
  organisation_id: string
  organisation_name: string
  tier: 'standard' | 'professional' | 'enterprise'
  max_stores: number
  max_terminals: number
  valid_from: string
  valid_until: string
  /** Integer days remaining; negative when expired. */
  days_remaining: number
  is_active: boolean
  issued_at: string | null
  last_validated_at: string | null
  grace_period_ends_at: string | null
  renewal_status: string | null
  urgency: 'ok' | 'medium' | 'high' | 'critical'
}

export async function getLicenses(): Promise<License[]> {
  const res = await apiClient.get<{ data: License[] }>('/licenses')
  return res.data.data
}

export async function requestRenewal(id: string, notes: string): Promise<void> {
  await apiClient.post(`/licenses/${id}/renew`, { notes })
}

export interface LicensePayload {
  organisation_id: string
  tier: License['tier']
  max_stores: number
  max_terminals: number
  valid_from: string
  valid_until: string
}

export async function createLicense(p: LicensePayload): Promise<void> {
  await apiClient.post('/licenses', p)
}

export async function updateLicense(
  id: string,
  p: Partial<LicensePayload & { is_active: boolean }>,
): Promise<void> {
  await apiClient.patch(`/licenses/${id}`, p)
}

export async function deleteLicense(id: string): Promise<void> {
  await apiClient.delete(`/licenses/${id}`)
}
