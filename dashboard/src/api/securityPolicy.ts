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
