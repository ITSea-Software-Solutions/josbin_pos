import apiClient from './client'

export interface DashboardUser {
  id: string
  name: string
  email: string
  role: string
  locale: 'nl' | 'en'
  organisation_id: string
  requires_2fa: boolean
  two_factor_confirmed: boolean
}

export interface LoginResponse {
  token: string
  expires_at: string
  user: DashboardUser
}

export interface TwoFactorRequiredResponse {
  two_factor_required: true
  pre_auth_token: string
}

export interface TwoFactorSetupRequiredResponse {
  two_factor_setup_required: true
  setup_token: string
  user: DashboardUser
}

export type LoginResult = LoginResponse | TwoFactorRequiredResponse | TwoFactorSetupRequiredResponse

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await apiClient.post<LoginResult>('/auth/login', {
    email,
    password,
    device_name: 'josbin_pos-dashboard',
  })
  return res.data
}

export async function twoFactorChallenge(preAuthToken: string, code: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/two-factor-challenge', {
    pre_auth_token: preAuthToken,
    code,
  })
  return res.data
}

export async function twoFactorSetup(setupToken: string): Promise<{ secret: string; qr_code_url: string }> {
  const res = await apiClient.get<{ secret: string; qr_code_url: string }>('/auth/two-factor/setup', {
    headers: { Authorization: `Bearer ${setupToken}` },
  })
  return res.data
}

export async function twoFactorConfirm(setupToken: string, code: string): Promise<LoginResponse & { recovery_codes: string[] }> {
  const res = await apiClient.post<LoginResponse & { recovery_codes: string[] }>('/auth/two-factor/confirm', { code }, {
    headers: { Authorization: `Bearer ${setupToken}` },
  })
  return res.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function me(): Promise<DashboardUser> {
  const res = await apiClient.get<{ user: DashboardUser }>('/auth/me')
  return res.data.user
}
