import { Suspense, lazy, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useRegisterStore } from '@/store/registerStore'
import { getMyStores } from '@/api/stores'
import { LicenseBanner } from '@/components/shared/LicenseBanner'
import { DemoBanner } from '@/components/shared/DemoBanner'
import { ToastProvider } from '@/components/shared/Toast'

/**
 * Self-heal a stale persisted store selection. If the store_id saved in
 * localStorage isn't one the CURRENT user can access (left over from a prior
 * session, a reassignment, or a deactivated store), drop it + any register
 * session so StoreSelectScreen re-runs. Without this a sale would be sent with
 * a foreign store_id and rejected with "store does not belong to your
 * organisation".
 */
function usePersistedStoreGuard(authed: boolean) {
  const storeId = useSettingsStore((s) => s.storeId)
  const setStoreId = useSettingsStore((s) => s.setStoreId)
  const clearSession = useRegisterStore((s) => s.clearSession)

  const { data: stores } = useQuery({
    queryKey: ['my-stores'],
    queryFn: getMyStores,
    enabled: authed && !!storeId,
  })

  useEffect(() => {
    if (authed && storeId && stores && !stores.some((s) => s.id === storeId)) {
      setStoreId(null)
      clearSession()
    }
  }, [authed, storeId, stores, setStoreId, clearSession])
}

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

/**
 * Windows only: if the operator enabled printer sharing, bring the bridge
 * back up on every app start — the toggle is a standing decision, not a
 * per-session one. Silently no-ops everywhere else.
 */
function usePrinterShareAutostart() {
  const enabled = useSettingsStore((s) => s.printerShareEnabled)
  const printer = useSettingsStore((s) => s.printer)
  useEffect(() => {
    const api = (window as any).josbin_pos
    if (!enabled || !api?.printerShareStart) return
    if (printer.type !== 'usb' || !printer.printerName) return
    api.printerShareStart(printer.printerName).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, printer.type, printer.printerName])
}

export default function App() {
  // Paint the chosen theme onto <html> so the CSS variables under
  // :root[data-theme='day'] take over. Done here, once, rather than in each
  // screen — the ground colour is a property of the terminal, not of whatever
  // happens to be on screen.
  const theme = useSettingsStore((st) => st.theme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  usePrinterShareAutostart()
  const token     = useAuthStore((s) => s.token)
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const storeId   = useSettingsStore((s) => s.storeId)
  const session   = useRegisterStore((s) => s.session)

  const authed       = token !== null && (!expiresAt || new Date(expiresAt) >= new Date())
  const hasRegister  = session !== null && session.status === 'open'

  // Drop a persisted store the current user can't actually access.
  usePersistedStoreGuard(authed)

  return (
    <ToastProvider>
      <DemoBanner />
      <LicenseBanner />
      <Suspense fallback={<Loading />}>
        {!authed                            && <LoginScreen />}
        {authed && !storeId                 && <StoreSelectScreen />}
        {authed && storeId && !hasRegister  && <OpenRegisterGate />}
        {authed && storeId && hasRegister   && <POSScreen />}
      </Suspense>
    </ToastProvider>
  )
}
