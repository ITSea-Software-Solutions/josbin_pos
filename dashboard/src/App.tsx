import { lazy, Suspense } from 'react'
import { useDashboardAuthStore } from '@/store/authStore'
import { useTranslation } from 'react-i18next'

const LoginScreen      = lazy(() => import('@/screens/LoginScreen'))
const DashboardLayout  = lazy(() => import('@/screens/DashboardLayout'))
const TwoFactorScreen  = lazy(() => import('@/screens/TwoFactorScreen'))

function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  )
}

export default function App() {
  // Subscribe to primitives so React re-renders on change
  const token      = useDashboardAuthStore((s) => s.token)
  const expiresAt  = useDashboardAuthStore((s) => s.expiresAt)
  const twoFactor  = useDashboardAuthStore((s) => s.twoFactor)
  const { i18n }   = useTranslation()

  document.documentElement.lang = i18n.language

  const authed = token !== null && (!expiresAt || new Date(expiresAt) >= new Date())
  const needs2fa = twoFactor.type === 'challenge' || twoFactor.type === 'setup'

  return (
    <Suspense fallback={<Loading />}>
      {needs2fa         ? <TwoFactorScreen />   :
       authed           ? <DashboardLayout />   :
                          <LoginScreen />}
    </Suspense>
  )
}
