import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User } from '@/types/models'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'

interface AuthState {
  user: User | null
  token: string | null
  expiresAt: string | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  isAuthenticated: () => boolean
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        expiresAt: null,
        isLoading: false,
        error: null,

        login: async (email, password) => {
          set({ isLoading: true, error: null })
          try {
            const res = await apiLogin(email, password, 'pos-electron')
            localStorage.setItem('josbin_pos_token', res.token)
            set({
              user: res.user,
              token: res.token,
              expiresAt: res.expires_at,
              isLoading: false,
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

        logout: async () => {
          try {
            await apiLogout()
          } catch {
            // fire and forget — still clear local state
          }
          localStorage.removeItem('josbin_pos_token')
          set({ user: null, token: null, expiresAt: null })
        },

        clearError: () => set({ error: null }),

        isAuthenticated: () => {
          const { token, expiresAt } = get()
          if (!token) return false
          if (expiresAt && new Date(expiresAt) < new Date()) return false
          return true
        },

        hasPermission: (permission: string) => {
          const { user } = get()
          if (!user) return false
          return (user.permissions as string[])?.includes(permission) ?? false
        },
      }),
      {
        name: 'josbin_pos-auth',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          expiresAt: state.expiresAt,
        }),
      },
    ),
    { name: 'AuthStore' },
  ),
)
