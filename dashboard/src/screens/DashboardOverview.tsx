import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getPlatformSummary, type StoreOverview } from '@/api/dashboard'
import { useDashboardAuthStore } from '@/store/authStore'
import { useOrgChannel, usePlatformChannel } from '@/hooks/useEcho'
import { formatSRD } from '@/utils/currency'
import { getWeeklySummary, getAnomalies, type AnomalyEntry } from '@/api/ai'
import { getStockAlertSummary } from '@/api/stock'
import { getUsers } from '@/api/users'
import { getProducts } from '@/api/catalogue'
import { getStores } from '@/api/stores'
import PlatformOverviewPanel from '@/screens/PlatformOverviewPanel'

/** Screens the onboarding card can deep-link to. Kept as a literal union so
 *  the parent's `go(screen: Screen)` is assignable without a wider `string`. */
type OnboardingScreen = 'stores' | 'users' | 'catalogue' | 'pos-launcher'

// ─── First-run onboarding checklist ───────────────────────────────────────────
// Nudges a new Org Admin through setup (Stores → Users → Catalogue → first sale).
// Self-fetches cheap counts; hides once the org is set up or the user dismisses.
const ONBOARDING_DISMISS_KEY = 'josbin_onboarding_dismissed'

function OnboardingCard({ isNl, onNavigate }: { isNl: boolean; onNavigate?: (s: OnboardingScreen) => void }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(ONBOARDING_DISMISS_KEY) === '1')

  const { data: stores } = useQuery({ queryKey: ['onb-stores'], queryFn: () => getStores(), staleTime: 60_000 })
  const { data: users } = useQuery({ queryKey: ['onb-users'], queryFn: () => getUsers(), staleTime: 60_000 })
  const { data: products } = useQuery({ queryKey: ['onb-products'], queryFn: () => getProducts(), staleTime: 60_000 })

  if (dismissed) return null
  // Wait for all three before deciding, to avoid a flash / premature hide.
  if (!stores || !users || !products) return null

  const hasStores = stores.length > 0
  const hasUsers = users.length > 1          // the admin themselves always exists
  const hasProducts = products.length > 0

  // Once the org is genuinely set up, retire the card automatically.
  if (hasStores && hasUsers && hasProducts) return null

  const steps: { done: boolean; label: string; screen: OnboardingScreen }[] = [
    { done: hasStores,   label: isNl ? 'Voeg een vestiging toe' : 'Add a store',        screen: 'stores' },
    { done: hasUsers,    label: isNl ? 'Maak gebruikers aan'    : 'Create users',        screen: 'users' },
    { done: hasProducts, label: isNl ? 'Vul de catalogus'       : 'Add products',        screen: 'catalogue' },
    { done: false,       label: isNl ? 'Verkoop testen in de kassa' : 'Ring a test sale', screen: 'pos-launcher' },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div style={{ background: 'linear-gradient(135deg,#faf9ff,#f3f0ff)', border: '1px solid #e3dcff', borderRadius: 16, padding: '20px 24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(124,58,237,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#4c1d95' }}>
            {isNl ? '🚀 Aan de slag' : '🚀 Get started'}
          </div>
          <div style={{ fontSize: 12.5, color: '#7c6ba8', marginTop: 2 }}>
            {isNl ? `${doneCount} van ${steps.length} stappen voltooid` : `${doneCount} of ${steps.length} steps done`}
          </div>
        </div>
        <button onClick={() => { localStorage.setItem(ONBOARDING_DISMISS_KEY, '1'); setDismissed(true) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8cc0', fontSize: 12, fontWeight: 600 }}>
          {isNl ? 'Verbergen' : 'Dismiss'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        {steps.map((s) => (
          <button key={s.screen} onClick={() => onNavigate?.(s.screen)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', background: '#fff', border: `1px solid ${s.done ? '#bbf7d0' : '#e5e0f5'}`, borderRadius: 10, padding: '11px 13px', cursor: 'pointer' }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: s.done ? '#22c55e' : '#ede9fe', color: s.done ? '#fff' : '#7c3aed' }}>
              {s.done ? '✓' : ''}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: s.done ? '#15803d' : '#3d3d50', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, gradient, icon,
}: {
  label: string; value: string; sub: string
  gradient: [string, string]; icon: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: '1px solid rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', gap: 18,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 6px 18px ${gradient[0]}44`,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9090a0', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#1c1c2e', lineHeight: 1.1, letterSpacing: '-0.5px' }}>{value}</p>
        <p style={{ fontSize: 12, color: '#9090a0', marginTop: 3 }}>{sub}</p>
      </div>
    </div>
  )
}

// ─── Store card ───────────────────────────────────────────────────────────────
function StoreCard({ store, onClick }: { store: StoreOverview; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const syncColor: Record<string, string> = { synced: '#22c55e', pending: '#f59e0b', failed: '#ef4444', never: '#9ca3af' }
  const syncLabel: Record<string, string> = { synced: 'Synced', pending: 'Pending', failed: 'Failed', never: 'Never' }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        border: hovered ? '1px solid #7c3aed' : '1px solid #ebebf0',
        boxShadow: hovered ? '0 8px 32px rgba(124,58,237,0.15)' : '0 2px 8px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease',
        outline: 'none',
      }}
    >
      {/* Gradient header strip */}
      <div style={{
        height: 4,
        background: store.is_online
          ? 'linear-gradient(90deg, #7c3aed, #4f46e5, #06b6d4)'
          : '#e5e7eb',
      }} />

      <div style={{ padding: 20 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: store.is_online ? 'rgba(124,58,237,0.08)' : '#f5f5f8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} style={{ width: 20, height: 20, stroke: store.is_online ? '#7c3aed' : '#9090a0' }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M9 22V12h6v10" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{store.store_name}</p>
              <p style={{ fontSize: 12, color: '#9090a0', marginTop: 1 }}>{store.city}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20,
              fontSize: 11, fontWeight: 700,
              background: store.is_online ? '#ecfdf5' : '#f5f5f8',
              color: store.is_online ? '#15803d' : '#9090a0',
              border: `1px solid ${store.is_online ? '#bbf7d0' : '#e5e7eb'}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: store.is_online ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
              {store.is_online ? 'Online' : 'Offline'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20,
              fontSize: 11, fontWeight: 600,
              color: syncColor[store.sync_status] ?? '#9ca3af',
              background: `${syncColor[store.sync_status] ?? '#9ca3af'}15`,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: syncColor[store.sync_status], display: 'inline-block' }} />
              {syncLabel[store.sync_status] ?? store.sync_status}
            </span>
          </div>
        </div>

        {/* Revenue */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 26, fontWeight: 800, color: '#1c1c2e', letterSpacing: '-0.5px', lineHeight: 1 }}>
            {formatSRD(store.today_revenue_srd)}
          </p>
          <p style={{ fontSize: 12, color: '#9090a0', marginTop: 4 }}>
            {isNl ? 'Omzet vandaag' : "Today's revenue"}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: isNl ? 'Transacties' : 'Txns', value: store.today_transaction_count.toString() },
            { label: isNl ? 'Gem. bon' : 'Avg', value: formatSRD(store.today_avg_basket_srd) },
            { label: 'BTW', value: formatSRD(store.today_btw_srd) },
          ].map(item => (
            <div key={item.label} style={{ background: '#f8f8fb', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1c1c2e' }}>{item.value}</p>
              <p style={{ fontSize: 10, color: '#9090a0', marginTop: 2, fontWeight: 500 }}>{item.label}</p>
            </div>
          ))}
        </div>

        {/* Top product */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
          background: store.top_product_name ? 'rgba(124,58,237,0.05)' : '#f8f8fb',
          border: `1px solid ${store.top_product_name ? 'rgba(124,58,237,0.12)' : 'transparent'}`,
        }}>
          <span style={{ fontSize: 14 }}>⭐</span>
          <p style={{ fontSize: 12, fontWeight: 600, color: store.top_product_name ? '#7c3aed' : '#c0c0cc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {store.top_product_name ?? (isNl ? 'Geen verkopen vandaag' : 'No sales yet today')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardOverview({
  onStoreSelect,
  onOpenStockAlerts,
  onNavigate,
}: {
  onStoreSelect: (id: string) => void
  /** Called when the manager clicks the "Stock alerts" tile — should jump to the Stock screen with the low-stock filter on. */
  onOpenStockAlerts?: () => void
  /** Deep-link the onboarding card's steps to their screens. */
  onNavigate?: (screen: OnboardingScreen) => void
}) {
  const { t, i18n } = useTranslation()
  const qc     = useQueryClient()
  const user   = useDashboardAuthStore((s) => s.user)
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null)
  const isNl = i18n.language === 'nl'

  // Stock-alert tile — refreshed every couple of minutes so a manager who
  // adjusts stock from another screen sees the counter update on the way back.
  const { data: stockAlerts } = useQuery({
    queryKey: ['stock-alerts-summary'],
    queryFn: () => getStockAlertSummary(),
    refetchInterval: 120_000,
    staleTime: 30_000,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-summary'],
    queryFn: getPlatformSummary,
    refetchInterval: 120_000,
  })

  usePlatformChannel({
    onStoreStatusChanged: (payload) => {
      const p = payload as { store_id: string; is_online: boolean }
      qc.setQueryData(['platform-summary'], (old: typeof data) => {
        if (!old) return old
        return { ...old, orgs: old.orgs.map(org => ({ ...org, stores: org.stores.map(s => s.store_id === p.store_id ? { ...s, is_online: p.is_online } : s) })) }
      })
    },
  })

  useOrgChannel(user?.role === 'organisation_admin' ? user.organisation_id : null, {
    onSaleCompleted: (payload) => {
      const p = payload as { store_id: string; total_srd: string }
      qc.setQueryData(['platform-summary'], (old: typeof data) => {
        if (!old) return old
        return {
          ...old,
          orgs: old.orgs.map(org => ({
            ...org,
            stores: org.stores.map(s => {
              if (s.store_id !== p.store_id) return s
              return { ...s, today_revenue_srd: (parseFloat(s.today_revenue_srd) + parseFloat(p.total_srd)).toFixed(2), today_transaction_count: s.today_transaction_count + 1 }
            }),
          })),
        }
      })
    },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="#ef4444" style={{ width: 24, height: 24 }}>
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{isNl ? 'Fout bij laden' : 'Failed to load data'}</p>
      </div>
    )
  }

  const orgsToShow = selectedOrg ? data.orgs.filter(o => o.organisation_id === selectedOrg) : data.orgs
  const hour = new Date().getHours()
  const greeting = isNl
    ? (hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond')
    : (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')

  const isSuperAdmin = user?.role === 'super_admin'

  return (
    <div style={{ padding: '28px 32px', maxWidth: '100%' }}>

      {/* Task #73 — Super Admin sees the platform-pulse panel above the
          per-store cards. OA / SM / Auditor see only the existing org view. */}
      {isSuperAdmin && <PlatformOverviewPanel />}

      {/* First-run onboarding — Org Admin (and Super Admin, who can still be
          setting up an org). Hidden for cashier / auditor / tax_inspector. */}
      {(user?.role === 'organisation_admin' || isSuperAdmin) && (
        <OnboardingCard isNl={isNl} onNavigate={onNavigate} />
      )}

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1c1c2e', letterSpacing: '-0.3px' }}>
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ fontSize: 13, color: '#9090a0', marginTop: 4 }}>
          {isNl
            ? `Hier is een overzicht van al uw winkels voor vandaag, ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}`
            : `Here's your platform overview for ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        <KpiCard
          label={isNl ? 'Omzet vandaag' : "Today's Revenue"}
          value={formatSRD(data.today_revenue_srd)}
          sub={`BTW: ${formatSRD(data.today_btw_srd)}`}
          gradient={['#7c3aed', '#4f46e5']}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 24, height: 24 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5 14.5v1h-1v-1.07c-.99-.21-1.87-.8-2.32-1.77l1.1-.63c.27.56.78.96 1.43.96.66 0 1.3-.35 1.3-1.08 0-.64-.37-1-1.53-1.35-1.45-.43-2.2-1.07-2.2-2.33 0-1.03.7-1.85 1.72-2.1V7h1v1.12c.97.24 1.65.95 1.9 1.84l-1.08.6c-.2-.64-.69-1.06-1.32-1.06-.59 0-1.12.3-1.12.95 0 .56.33.9 1.49 1.24 1.52.46 2.25 1.14 2.25 2.46 0 1.18-.82 2.07-1.92 2.35z" /></svg>}
        />
        <KpiCard
          label={isNl ? 'Transacties' : 'Transactions'}
          value={data.today_transactions.toString()}
          sub={isNl ? 'verkopen vandaag' : 'sales today'}
          gradient={['#059669', '#10b981']}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 24, height: 24 }}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
        />
        <KpiCard
          label="BTW"
          value={formatSRD(data.today_btw_srd)}
          sub="Belastingdienst Suriname"
          gradient={['#d97706', '#f59e0b']}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 24, height: 24 }}><path d="M9 14l6-6M14 14l.01 0M10 10l.01 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KpiCard
          label={isNl ? 'Winkels online' : 'Stores Online'}
          value={`${data.online_stores} / ${data.total_stores}`}
          sub={`${data.total_organisations} ${isNl ? 'organisaties' : 'organisations'}`}
          gradient={data.online_stores === data.total_stores ? ['#0891b2', '#06b6d4'] : ['#b45309', '#f59e0b']}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 24, height: 24 }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path d="M9 22V12h6v10" /></svg>}
        />
      </div>

      {/* Stock alerts tile — clickable, deep-links into Stock screen filtered
         to low-stock only. Always rendered: the "all OK" state acts as a
         reassuring green confirmation for managers on quiet mornings. */}
      {stockAlerts && (
        <StockAlertTile
          summary={stockAlerts}
          onClick={onOpenStockAlerts}
          t={t}
        />
      )}

      {/* Org filter tabs */}
      {data.orgs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {[{ id: null, label: isNl ? 'Alle organisaties' : 'All organisations' }, ...data.orgs.map(o => ({ id: o.organisation_id, label: o.organisation_name }))].map(tab => (
            <button
              key={tab.id ?? 'all'}
              onClick={() => setSelectedOrg(tab.id)}
              style={{
                padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s',
                background: selectedOrg === tab.id ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : '#fff',
                color: selectedOrg === tab.id ? '#fff' : '#6d6d80',
                boxShadow: selectedOrg === tab.id ? '0 3px 10px rgba(124,58,237,0.35)' : '0 1px 4px rgba(0,0,0,0.07)',
              }}
            >{tab.label}</button>
          ))}
        </div>
      )}

      {/* Org sections */}
      {orgsToShow.map(org => (
        <div key={org.organisation_id} style={{ marginBottom: 40 }}>

          {/* Org header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff', borderRadius: 14, padding: '14px 20px', marginBottom: 20,
            border: '1px solid #ebebf0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth={2} style={{ width: 18, height: 18 }}>
                  <path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5" />
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1c1c2e' }}>{org.organisation_name}</p>
                <p style={{ fontSize: 12, color: '#9090a0', marginTop: 1 }}>
                  {org.online_stores}/{org.store_count} {isNl ? 'winkels online' : 'stores online'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: isNl ? 'Omzet' : 'Revenue', value: formatSRD(org.today_revenue_srd), color: '#7c3aed' },
                { label: 'BTW', value: formatSRD(org.today_btw_srd), color: '#d97706' },
                { label: isNl ? 'Transacties' : 'Txns', value: org.today_transaction_count.toString(), color: '#1c1c2e' },
              ].map(stat => (
                <div key={stat.label} style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: stat.color }}>{stat.value}</p>
                  <p style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Store grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {org.stores.map(store => (
              <StoreCard key={store.store_id} store={store} onClick={() => onStoreSelect(store.store_id)} />
            ))}
          </div>
        </div>
      ))}

      {/* AI Widgets row */}
      <AiWidgets isNl={isNl} />

    </div>
  )
}

// ─── Stock alert tile ─────────────────────────────────────────────────────────
function StockAlertTile({
  summary, onClick, t,
}: {
  summary: { low_count: number; out_count: number; total_count: number }
  onClick?: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const hasAlerts = summary.total_count > 0
  const clickable = hasAlerts && !!onClick

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } } : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: hasAlerts ? '#fffbeb' : '#f0fdf4',
        border: hasAlerts ? '1px solid #fde68a' : '1px solid #bbf7d0',
        borderRadius: 14, padding: '14px 20px', marginBottom: 24,
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        if (clickable) {
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.18)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        if (clickable) {
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'none'
        }
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: hasAlerts ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #16a34a, #15803d)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: hasAlerts ? '0 4px 14px rgba(245,158,11,0.35)' : '0 4px 14px rgba(22,163,74,0.3)',
      }}>
        <span style={{ fontSize: 20 }} aria-hidden>{hasAlerts ? '⚠️' : '✓'}</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: hasAlerts ? '#92400e' : '#15803d', marginBottom: 2 }}>
          {t('stock.alerts.tileTitle')}
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: hasAlerts ? '#1c1c2e' : '#15803d' }}>
          {hasAlerts
            ? t('stock.alerts.tileSub', { low: summary.low_count, out: summary.out_count })
            : t('stock.alerts.tileNone')}
        </p>
      </div>

      {hasAlerts && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {summary.out_count > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.5px',
              background: '#dc2626', color: '#fff',
              padding: '4px 10px', borderRadius: 6,
            }}>
              {summary.out_count} {t('stock.alerts.outBadge')}
            </span>
          )}
          {clickable && (
            <span style={{
              fontSize: 12.5, fontWeight: 700, color: '#92400e',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {t('stock.alerts.reviewNow')}
              <span aria-hidden style={{ fontSize: 14 }}>→</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AI Widgets ───────────────────────────────────────────────────────────────
function AiWidgets({ isNl }: { isNl: boolean }) {
  const { data: summary } = useQuery({
    queryKey: ['ai-weekly-summary'],
    queryFn: getWeeklySummary,
    staleTime: 1000 * 60 * 60, // 1hr
  })

  const { data: anomalies = [] } = useQuery({
    queryKey: ['ai-anomalies'],
    queryFn: () => getAnomalies(7),
    staleTime: 1000 * 60 * 5,
  })

  const recentAnomalies = (anomalies as AnomalyEntry[]).slice(0, 5)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
      {/* Weekly AI summary */}
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #ebebf0', padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>✨</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{isNl ? 'Weekoverzicht' : 'Weekly Summary'}</p>
            {summary && <p style={{ fontSize: 11, color: '#9090a0' }}>{summary.week_start}</p>}
          </div>
        </div>

        {summary ? (
          <>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, fontStyle: summary.narrative ? 'normal' : 'italic' }}>
              {summary.narrative ?? (isNl ? 'Geen narratief beschikbaar.' : 'No narrative available.')}
            </p>
            {summary.stats?.revenue_change_pct !== null && summary.stats?.revenue_change_pct !== undefined && (
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <Chip
                  label={isNl ? 'Omzetwijziging' : 'Revenue change'}
                  value={(summary.stats.revenue_change_pct >= 0 ? '+' : '') + summary.stats.revenue_change_pct + '%'}
                  color={summary.stats.revenue_change_pct >= 0 ? '#059669' : '#ef4444'}
                />
                {summary.stats.this_week && (
                  <Chip label={isNl ? 'Transacties' : 'Transactions'} value={String(summary.stats.this_week.count)} color="#7c3aed" />
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#9090a0', fontStyle: 'italic' }}>
            {isNl ? 'Beschikbaar elke maandag om 08:00 AST.' : 'Available every Monday at 08:00 AST.'}
          </p>
        )}
      </div>

      {/* Anomaly alerts */}
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #ebebf0', padding: '22px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #dc2626, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{isNl ? 'Anomalieën (7 dagen)' : 'Anomalies (7 days)'}</p>
            <p style={{ fontSize: 11, color: recentAnomalies.length > 0 ? '#ef4444' : '#9090a0' }}>
              {recentAnomalies.length} {isNl ? 'gemarkeerd' : 'flagged'}
            </p>
          </div>
        </div>

        {recentAnomalies.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9090a0', fontStyle: 'italic' }}>
            {isNl ? 'Geen verdachte transacties in de afgelopen 7 dagen.' : 'No suspicious transactions in the last 7 days.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentAnomalies.map(a => (
              <div key={a.id} style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1c2e', fontFamily: 'monospace' }}>{a.sale_number}</span>
                  <span style={{ fontSize: 11, color: '#9090a0' }}>{a.store} · {a.cashier}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {a.flags.slice(0, 2).map((f, i) => (
                    <span key={i} style={{ fontSize: 10, background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: `${color}10`, borderRadius: 8, padding: '6px 10px' }}>
      <p style={{ fontSize: 10, color: '#9090a0', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}
