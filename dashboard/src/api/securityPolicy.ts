import apiClient from './client'

export interface TwoFactorPolicy {
  /** Roles that always require 2FA and cannot be disabled (e.g. super_admin). */
  always_roles: string[]
  /** Roles the Super Admin may opt into mandatory 2FA. */
  configurable_roles: string[]
  /** Currently enforced roles (subset of configurable_roles). */
  two_factor_required_roles: string[]
  /** Government-organisation accounts always require 2FA regardless of role. */
  government_always_required: boolean
}

export async function getTwoFactorPolicy(): Promise<TwoFactorPolicy> {
  const res = await apiClient.get<{ data: TwoFactorPolicy }>('/settings/two-factor-policy')
  return res.data.data
}

export async function updateTwoFactorPolicy(roles: string[]): Promise<TwoFactorPolicy> {
  const res = await apiClient.put<{ data: TwoFactorPolicy }>('/settings/two-factor-policy', {
    two_factor_required_roles: roles,
  })
  return res.data.data
}

// ── Platform receipt footer stamp (Super Admin only) ────────────────────────
//
// The image stamped at the foot of printed receipts for every store that has
// not uploaded one of its own. Stored in the audited app_settings table, so it
// can be changed from the dashboard without a redeploy and every change leaves
// a row naming who made it.

export interface PlatformReceiptStamp {
  path: string | null
  url: string | null
}

export async function getPlatformReceiptStamp(): Promise<PlatformReceiptStamp> {
  const res = await apiClient.get<{ data: PlatformReceiptStamp }>('/settings/receipt-stamp')
  return res.data.data
}

export async function uploadPlatformReceiptStamp(file: File): Promise<PlatformReceiptStamp> {
  const fd = new FormData()
  fd.append('stamp', file)
  const res = await apiClient.post<{ data: PlatformReceiptStamp }>('/settings/receipt-stamp', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function clearPlatformReceiptStamp(): Promise<PlatformReceiptStamp> {
  const res = await apiClient.delete<{ data: PlatformReceiptStamp }>('/settings/receipt-stamp')
  return res.data.data
}
