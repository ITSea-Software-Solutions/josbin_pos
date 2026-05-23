import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  login as apiLogin,
  logout as apiLogout,
  twoFactorChallenge as apiChallenge,
  twoFactorSetup as apiSetup,
  twoFactorConfirm as apiConfirm,
  type DashboardUser,
} from '@/api/auth'

type TwoFactorState =
  | { type: 'none' }
  | { type: 'challenge'; preAuthToken: string }
  | { type: 'setup'; setupToken: string; user: DashboardUser }

interface AuthState {
  user: DashboardUser | null
  token: string | null
  expiresAt: string | null
  isLoading: boolean
  error: string | null
  twoFactor: TwoFactorState

  login: (email: string, password: string) => Promise<void>
  submitChallenge: (code: string) => Promise<void>
  submitSetupConfirm: (code: string) => Promise<{ recovery_codes: string[] }>
  fetchSetupQr: () => Promise<{ secret: string; qr_code_url: string }>
  logout: () => Promise<void>
  clearError: () => void
  isSuperAdmin: () => boolean
  isOrgAdmin: () => boolean
}

export const useDashboardAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      expiresAt: null,
      isLoading: false,
      error: null,
      twoFactor: { type: 'none' },

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await apiLogin(email, password)

          // `in` checks alone discriminate the union — keep them un-compounded
          // so TypeScript narrows `res` to LoginResponse after both early returns.
          if ('two_factor_required' in res) {
            set({ isLoading: false, twoFactor: { type: 'challenge', preAuthToken: res.pre_auth_token } })
            return
          }

          if ('two_factor_setup_required' in res) {
            localStorage.setItem('josbin_pos_dashboard_token', res.setup_token)
            set({
              isLoading: false,
              twoFactor: { type: 'setup', setupToken: res.setup_token, user: res.user },
            })
            return
          }

          // Normal login — res is now narrowed to LoginResponse
          localStorage.setItem('josbin_pos_dashboard_token', res.token)
          set({
            user: res.user as DashboardUser,
            token: res.token,
            expiresAt: res.expires_at,
            isLoading: false,
            twoFactor: { type: 'none' },
          })
        } catch (err: unknown) {
          type ErrShape = { response?: { data?: { errors?: { email?: string[] }; message?: string } } }
          const data = (err as ErrShape)?.response?.data
          const msg =
            data?.errors?.email?.[0] ??
            data?.message ??
            'Login failed. Please check your credentials.'
          set({ isLoading: false, error: msg })
          throw err
        }
      },

      submitChallenge: async (code: string) => {
        const { twoFactor } = get()
        if (twoFactor.type !== 'challenge') return

        set({ isLoading: true, error: null })
        try {
          const res = await apiChallenge(twoFactor.preAuthToken, code)
          localStorage.setItem('josbin_pos_dashboard_token', res.token)
          set({
            user: res.user as DashboardUser,
            token: res.token,
            expiresAt: res.expires_at,
            isLoading: false,
            twoFactor: { type: 'none' },
          })
        } catch (err: unknown) {
          type ErrShape = { response?: { data?: { message?: string } } }
          const msg = (err as ErrShape)?.response?.data?.message ?? 'Invalid code. Please try again.'
          set({ isLoading: false, error: msg })
          throw err
        }
      },

      fetchSetupQr: async () => {
        const { twoFactor } = get()
        if (twoFactor.type !== 'setup') throw new Error('No setup token')
        return apiSetup(twoFactor.setupToken)
      },

      submitSetupConfirm: async (code: string) => {
        const { twoFactor } = get()
        if (twoFactor.type !== 'setup') throw new Error('No setup token')

        set({ isLoading: true, error: null })
        try {
          const res = await apiConfirm(twoFactor.setupToken, code)
          localStorage.setItem('josbin_pos_dashboard_token', res.token)
          set({
            user: res.user as DashboardUser,
            token: res.token,
            expiresAt: res.expires_at,
            isLoading: false,
            twoFactor: { type: 'none' },
          })
          return { recovery_codes: res.recovery_codes }
        } catch (err: unknown) {
          type ErrShape = { response?: { data?: { message?: string } } }
          const msg = (err as ErrShape)?.response?.data?.message ?? 'Invalid code. Please try again.'
          set({ isLoading: false, error: msg })
          throw err
        }
      },

      logout: async () => {
        try {
          await apiLogout()
        } catch {
          // fire and forget
        }
        localStorage.removeItem('josbin_pos_dashboard_token')
        set({ user: null, token: null, expiresAt: null, twoFactor: { type: 'none' } })
      },

      clearError: () => set({ error: null }),

      isSuperAdmin: () => get().user?.role === 'super_admin',
      isOrgAdmin: () => {
        const role = get().user?.role
        return role === 'super_admin' || role === 'organisation_admin'
      },
    }),
    {
      name: 'josbin_pos-dashboard-auth',
      partialize: (s) => ({ user: s.user, token: s.token, expiresAt: s.expiresAt }),
    },
  ),
)
