import { Suspense, lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useRegisterStore } from '@/store/registerStore'
import { LicenseBanner } from '@/components/shared/LicenseBanner'

const LoginScreen       = lazy(() => import('@/screens/LoginScreen'))
const StoreSelectScreen = lazy(() => import('@/screens/StoreSelectScreen'))
const OpenRegisterGate  = lazy(() => import('@/screens/OpenRegisterGate'))
const POSScreen         = lazy(() => import('@/screens/POSScreen'))

function Loading() {
  const { t } = useTranslation()
  return (
    <div className="app-loading">
      <span>{t('app.loading')}</span>
    </div>
  )
}

export default function App() {
  const token     = useAuthStore((s) => s.token)
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const storeId   = useSettingsStore((s) => s.storeId)
  const session   = useRegisterStore((s) => s.session)

  const authed       = token !== null && (!expiresAt || new Date(expiresAt) >= new Date())
  const hasRegister  = session !== null && session.status === 'open'

  return (
    <>
      <LicenseBanner />
      <Suspense fallback={<Loading />}>
        {!authed                            && <LoginScreen />}
        {authed && !storeId                 && <StoreSelectScreen />}
        {authed && storeId && !hasRegister  && <OpenRegisterGate />}
        {authed && storeId && hasRegister   && <POSScreen />}
      </Suspense>
    </>
  )
}
