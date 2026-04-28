import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { RegisterSession } from '@/api/registers'

interface RegisterState {
  session: RegisterSession | null
  setSession: (s: RegisterSession | null) => void
  clearSession: () => void
}

export const useRegisterStore = create<RegisterState>()(
  devtools(
    persist(
      (set) => ({
        session: null,
        setSession: (session) => set({ session }),
        clearSession: () => set({ session: null }),
      }),
      { name: 'josbin-register-session' }
    )
  )
)
