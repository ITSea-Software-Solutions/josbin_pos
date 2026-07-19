import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCartStore } from '@/store/cartStore'
import { useRegisterStore } from '@/store/registerStore'
import { getDailyReport } from '@/api/reports'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import CustomerModal from './CustomerModal'
import HeldBillsPanel from './HeldBillsPanel'
import CashMovementModal from './CashMovementModal'
import CloseRegisterModal from '@/screens/CloseRegisterModal'
import HelpButton from '@/components/shared/HelpButton'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

interface TopBarProps {
  storeId: string
  onNavigate: (screen: 'pos' | 'reports' | 'exchange-rate' | 'settings' | 'end-of-day' | 'labels' | 'history') => void
  activeScreen: string
  keyboardOpen: boolean
  onToggleKeyboard: () => void
}

export default function TopBar({ storeId, onNavigate, activeScreen, keyboardOpen, onToggleKeyboard }: TopBarProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const clearStoreId = useSettingsStore((s) => s.setStoreId)

  const customer = useCartStore((s) => s.customer)
  const cartItemCount = useCartStore((s) => s.items.length)

  const session = useRegisterStore((s) => s.session)
  const isOnline = useOnlineStatus()

  const [customerOpen, setCustomerOpen]         = useState(false)
  const [heldBillsOpen, setHeldBillsOpen]       = useState(false)
  const [closeRegisterOpen, setCloseRegisterOpen] = useState(false)
  const [cashMovementOpen, setCashMovementOpen] = useState(false)
  // Guard logout / store-switch when the cart still has unsold items.
  const [pendingExit, setPendingExit]           = useState<'logout' | 'switch' | null>(null)

  function requestLogout() {
    // Guard when the cart has unsold items OR the register is still open —
    // leaving with an open drawer is exactly how the "yesterday was never
    // closed" morning starts.
    if (cartItemCount > 0 || session) setPendingExit('logout')
    else logout()
  }
  function requestSwitchStore() {
    if (cartItemCount > 0) setPendingExit('switch')
    else clearStoreId(null)
  }

  // Closing-time nudge: past the store's configured closing hour with the
  // session still open → persistent amber strip under the top bar.
  const { data: storeData } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => import('@/api/stores').then(m => m.getStore(storeId)),
    staleTime: 5 * 60_000,
  })
  const closingTime = (storeData?.settings?.closing_time as string | undefined) ?? null
  const nowHHMM = new Date().toTimeString().slice(0, 5)
  const pastClosing = !!(session && closingTime && nowHHMM >= closingTime)

  const { data: todaySummary } = useQuery({
    queryKey: ['today-summary', storeId],
    queryFn: () => getDailyReport(storeId),
    refetchInterval: 1000 * 60 * 2, // refresh every 2 min
  })

  function toggleLanguage() {
    const next = i18n.language === 'nl' ? 'en' : 'nl'
    i18n.changeLanguage(next)
    localStorage.setItem('josbin_pos_locale', next)
  }

  // End-of-Day Z-Report is a store-level day-close — a manager task in every
  // commercial POS. The cashier's end-of-shift task is the Close Register
  // modal on the right (which uses register-session-close, not z_report.close).
  const isManagerPlus = ['store_manager', 'organisation_admin', 'super_admin'].includes(user?.role ?? '')

  const navItems = [
    { key: 'pos',           label: t('nav.pos') },
    { key: 'history',       label: i18n.language === 'nl' ? 'Transacties' : 'Transactions' },
    { key: 'reports',       label: t('nav.reports') },
    { key: 'labels',        label: t('nav.labels') },
    { key: 'exchange-rate', label: t('nav.exchangeRate') },
    ...(isManagerPlus ? [{ key: 'end-of-day', label: t('nav.endOfDay') }] : []),
    { key: 'settings',      label: t('nav.settings') },
  ]

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          height: 52,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '0 18px',
          fontWeight: 800,
          fontSize: 'var(--font-size-md)',
          color: 'var(--color-primary)',
          flexShrink: 0,
          borderRight: '1px solid var(--border-color)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}>
          Josbin POS
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', height: '100%', flex: 1 }}>
          {navItems.map((nav) => (
            <button
              key={nav.key}
              onClick={() => onNavigate(nav.key as 'pos' | 'reports' | 'exchange-rate' | 'settings' | 'end-of-day' | 'labels' | 'history')}
              style={{
                height: '100%',
                padding: '0 16px',
                background: 'none',
                border: 'none',
                borderBottom: activeScreen === nav.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeScreen === nav.key ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: activeScreen === nav.key ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {nav.label}
            </button>
          ))}
        </nav>

        {/* Right side: today totals + customer + held bills + lang + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0 }}>
          {/* Network / sync status — sources from navigator.onLine (no client
              outbox count exists yet, so we do not fabricate a queued figure) */}
          <div
            title={isOnline ? t('pos.sync.onlineTip') : t('pos.sync.offlineTip')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 9px', borderRadius: 20,
              background: isOnline ? 'rgba(34,197,94,.1)' : 'rgba(220,38,38,.1)',
              border: `1px solid ${isOnline ? 'rgba(34,197,94,.25)' : 'rgba(220,38,38,.25)'}`,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isOnline ? '#22c55e' : '#dc2626', display: 'inline-block',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: isOnline ? '#15803d' : '#b91c1c' }}>
              {isOnline ? t('pos.sync.online') : t('pos.sync.offline')}
            </span>
          </div>

          {/* Today's sales */}
          {todaySummary && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
              padding: '0 10px', borderRight: '1px solid var(--border-color)',
            }}>
              <span className="currency-srd" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-accent)' }}>
                SRD {parseFloat(todaySummary.total_sales_srd).toFixed(2)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {todaySummary.transaction_count} {t('pos.todaySales').toLowerCase()}
              </span>
            </div>
          )}

          {/* Customer */}
          <button
            onClick={() => setCustomerOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 34, padding: '0 12px',
              background: customer ? 'rgba(79,142,247,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${customer ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--border-radius)',
              color: customer ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 500,
            }}
          >
            👤 {customer ? customer.name : t('pos.customer.walkIn')}
          </button>

          {/* Held bills */}
          <button
            onClick={() => setHeldBillsOpen(true)}
            style={{
              height: 34, padding: '0 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            }}
          >
            📋 {t('pos.openBills')}
          </button>

          {/* Cash in/out — only while a register session is open */}
          {session && (
            <button
              onClick={() => setCashMovementOpen(true)}
              title={t('pos.cashMovement.title')}
              style={{
                height: 34, padding: '0 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              💵 {t('pos.cashMovement.short')}
            </button>
          )}

          {/* Context-aware help for the current screen */}
          <HelpButton topic={activeScreen} />

          {/* On-screen keyboard toggle */}
          <button
            onClick={onToggleKeyboard}
            title={i18n.language === 'nl' ? 'Schermtoetsenbord aan/uit' : 'Toggle on-screen keyboard'}
            style={{
              height: 34, padding: '0 10px',
              background: keyboardOpen ? 'rgba(41,51,113,0.12)' : 'var(--bg-elevated)',
              border: `1px solid ${keyboardOpen ? 'var(--color-primary)' : 'var(--border-color)'}`,
              borderRadius: 'var(--border-radius)',
              color: keyboardOpen ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 16,
            }}
          >
            ⌨
          </button>

          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            style={{
              height: 34, padding: '0 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600,
            }}
          >
            {i18n.language === 'nl' ? 'EN' : 'NL'}
          </button>

          {/* Register status + close button */}
          {session && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid var(--border-color)', paddingLeft: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>
                  {session.register_name ?? `#${session.register_number}`}
                </span>
              </div>
              <button
                onClick={() => setCloseRegisterOpen(true)}
                title={i18n.language === 'nl' ? 'Kassa sluiten' : 'Close register'}
                style={{
                  height: 28, padding: '0 10px',
                  background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)',
                  borderRadius: 4, color: '#dc2626',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                }}
              >
                {i18n.language === 'nl' ? 'Kassa sluiten' : 'Close register'}
              </button>
            </div>
          )}

          {/* User / logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid var(--border-color)', paddingLeft: 10 }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {user?.name}
            </span>
            <button
              onClick={requestSwitchStore}
              title={i18n.language === 'nl' ? 'Vestiging wisselen' : 'Switch store'}
              style={{
                height: 28, padding: '0 8px',
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 4, color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 11,
              }}
            >
              ⇄
            </button>
            <button
              onClick={requestLogout}
              style={{
                height: 28, padding: '0 10px',
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 4, color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Closing-time nudge: still selling past the store's closing hour */}
      {pastClosing && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '7px 14px', background: 'rgba(245,158,11,.14)',
          borderBottom: '1px solid rgba(245,158,11,.3)', color: '#b45309',
          fontSize: 12.5, fontWeight: 600, flexShrink: 0,
        }}>
          <span>⏰ {i18n.language === 'nl'
            ? `Sluitingstijd (${closingTime}) voorbij — sluit de kassa af vóór vertrek.`
            : `Past closing time (${closingTime}) — close the register before leaving.`}</span>
          <button onClick={() => setCloseRegisterOpen(true)}
            style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid rgba(180,83,9,.4)', background: 'rgba(255,255,255,.5)', color: '#92400e', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {i18n.language === 'nl' ? 'Kassa afsluiten' : 'Close register'}
          </button>
        </div>
      )}

      <CustomerModal isOpen={customerOpen} onClose={() => setCustomerOpen(false)} />
      <HeldBillsPanel isOpen={heldBillsOpen} onClose={() => setHeldBillsOpen(false)} storeId={storeId} />
      {session && (
        <CashMovementModal
          isOpen={cashMovementOpen}
          onClose={() => setCashMovementOpen(false)}
          sessionId={session.id}
        />
      )}
      {closeRegisterOpen && <CloseRegisterModal onClose={() => setCloseRegisterOpen(false)} />}

      <ConfirmDialog
        isOpen={pendingExit !== null}
        title={pendingExit === 'switch' ? t('pos.exitGuard.switchTitle') : t('pos.exitGuard.logoutTitle')}
        message={
          cartItemCount > 0
            ? t('pos.exitGuard.body', { count: cartItemCount })
            : (i18n.language === 'nl'
                ? 'De kassa staat nog open. Sluit de manager vanavond af? Zo niet, sluit de kassa nu via het menu.'
                : 'The register is still open. Is the manager closing tonight? If not, close it now from the menu.')
        }
        confirmLabel={pendingExit === 'switch' ? (i18n.language === 'nl' ? 'Wisselen' : 'Switch') : t('auth.logout')}
        onConfirm={() => {
          const action = pendingExit
          setPendingExit(null)
          if (action === 'switch') clearStoreId(null)
          else if (action === 'logout') logout()
        }}
        onCancel={() => setPendingExit(null)}
      />
    </>
  )
}
