import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'

const DashboardOverview   = lazy(() => import('@/screens/DashboardOverview'))
const StoreDetailScreen   = lazy(() => import('@/screens/StoreDetailScreen'))
const ReportsScreen       = lazy(() => import('@/screens/ReportsScreen'))
const OrganisationsScreen = lazy(() => import('@/screens/OrganisationsScreen'))
const UsersScreen         = lazy(() => import('@/screens/UsersScreen'))
const ApiKeysScreen       = lazy(() => import('@/screens/ApiKeysScreen'))
const ZReportScreen       = lazy(() => import('@/screens/ZReportScreen'))
const AuditLogScreen      = lazy(() => import('@/screens/AuditLogScreen'))
const LicenseScreen       = lazy(() => import('@/screens/LicenseScreen'))
const CatalogueScreen       = lazy(() => import('@/screens/CatalogueScreen'))
const RegistersScreen       = lazy(() => import('@/screens/RegistersScreen'))
const CustomersScreen       = lazy(() => import('@/screens/CustomersScreen'))
const StockScreen           = lazy(() => import('@/screens/StockScreen'))
const AiInsightsScreen      = lazy(() => import('@/screens/AiInsightsScreen'))
const PriceOverridesScreen  = lazy(() => import('@/screens/PriceOverridesScreen'))
const DiscountRulesScreen   = lazy(() => import('@/screens/DiscountRulesScreen'))
const StoreComparisonScreen = lazy(() => import('@/screens/StoreComparisonScreen'))
const StoreSettingsScreen          = lazy(() => import('@/screens/StoreSettingsScreen'))
const CatalogueImportExportScreen  = lazy(() => import('@/screens/CatalogueImportExportScreen'))
const MyAccountScreen              = lazy(() => import('@/screens/MyAccountScreen'))
const PosLauncherScreen            = lazy(() => import('@/screens/PosLauncherScreen'))

type Screen =
  | 'overview' | 'store' | 'reports' | 'organisations' | 'users' | 'api-keys'
  | 'z-reports' | 'audit-log' | 'licenses' | 'catalogue' | 'registers'
  | 'customers' | 'stock' | 'ai-insights' | 'price-overrides' | 'discount-rules' | 'compare' | 'store-settings' | 'import-export'
  | 'my-account' | 'pos-launcher'

// ─── Icons ────────────────────────────────────────────────────────────────────
const IC = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  zreports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M3 3v18h18" /><path d="M7 16l4-5 4 3 4-7" />
    </svg>
  ),
  organisations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5M9 10h1m4 0h1M9 14h1m4 0h1" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  apikeys: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  ),
  license: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h2M12 15h5" />
    </svg>
  ),
  catalogue: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  registers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M8 4v4M16 4v4M2 12h20M7 16h2M12 16h2M17 16h2" />
    </svg>
  ),
  customers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v4M10 14h4" />
    </svg>
  ),
  ai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M12 2a4 4 0 014 4c0 1.5-.7 2.8-1.8 3.6L16 21H8l1.8-11.4A4 4 0 0112 2z" />
      <path d="M8.5 21h7M6 12H4M20 12h-2M7.5 6.5L6 5M17 5l-1.5 1.5" />
    </svg>
  ),
  prices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
    </svg>
  ),
  discounts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  ),
  compare: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  ),
  importExport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  storeSettings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
}

function ScreenLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-[3px] border-violet-100 border-t-violet-600 animate-spin" />
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const { i18n } = useTranslation()
  const user       = useDashboardAuthStore((s) => s.user)
  const logout     = useDashboardAuthStore((s) => s.logout)

  // Cashier (and any role without overview access) lands on My Account first.
  const defaultScreen: Screen = user?.role === 'cashier' ? 'my-account' : 'overview'
  const [screen, setScreen]               = useState<Screen>(defaultScreen)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const isNl = i18n.language === 'nl'

  // Machine accounts (API integrations) have no business in the dashboard UI.
  if (user?.role === 'api_integration') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f8', padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: 36, maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,.12)', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>{isNl ? 'API-account' : 'API account'}</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            {isNl ? 'Dit account heeft geen toegang tot de dashboard-UI.' : 'This account has no access to the dashboard UI.'}
          </p>
          <button onClick={logout} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isNl ? 'Uitloggen' : 'Log out'}
          </button>
        </div>
      </div>
    )
  }

  function go(s: Screen) { setScreen(s) }
  function openStore(id: string) { setSelectedStoreId(id); setScreen('store') }

  // Every nav item declares the roles allowed to see it. Filter below denies
  // by default for any role not listed. Cashier is never granted any dashboard
  // nav — they're redirected to the POS app at the layout root.
  const SA = 'super_admin', OA = 'organisation_admin', SM = 'store_manager', AU = 'auditor', CA = 'cashier'
  const nav: { id: Screen; nl: string; en: string; icon: React.ReactNode; roles: string[] }[] = [
    // Mijn Profiel — everyone gets self-service: own stats, shifts, password.
    { id: 'my-account',     nl: 'Mijn Profiel',           en: 'My Account',      icon: IC.users,          roles: [SA, OA, SM, AU, CA] },
    { id: 'pos-launcher',   nl: 'POS-app openen',         en: 'Open POS app',    icon: IC.registers,      roles: [SA, OA, SM] },
    { id: 'overview',       nl: 'Dashboard',              en: 'Dashboard',       icon: IC.overview,       roles: [SA, OA, SM, AU] },
    { id: 'z-reports',      nl: 'Z-Rapporten',            en: 'Z-Reports',       icon: IC.zreports,       roles: [SA, OA, SM, AU] },
    { id: 'reports',        nl: 'Rapporten',              en: 'Reports',         icon: IC.reports,        roles: [SA, OA, SM, AU] },
    { id: 'catalogue',      nl: 'Catalogus',              en: 'Catalogue',       icon: IC.catalogue,      roles: [SA, OA, SM] },
    // Bulk import/export is HQ-level — Store Manager edits individual products,
    // not the whole catalogue (matches the backend `products.import` permission).
    { id: 'import-export',  nl: 'Import / Export',        en: 'Import / Export', icon: IC.importExport,   roles: [SA, OA] },
    { id: 'registers',      nl: 'Kassabeheer',            en: 'Registers',       icon: IC.registers,      roles: [SA, OA, SM] },
    { id: 'customers',      nl: 'Klanten',                en: 'Customers',       icon: IC.customers,      roles: [SA, OA, SM] },
    { id: 'stock',          nl: 'Voorraad',               en: 'Stock',           icon: IC.stock,          roles: [SA, OA, SM] },
    // Per-store pricing is HQ-managed.
    { id: 'price-overrides',nl: 'Prijsoverschrijvingen',  en: 'Price Overrides', icon: IC.prices,         roles: [SA, OA] },
    { id: 'discount-rules', nl: 'Kortingsregels',         en: 'Discount Rules',  icon: IC.discounts,      roles: [SA, OA, SM] },
    { id: 'compare',        nl: 'Vergelijking',           en: 'Comparison',      icon: IC.compare,        roles: [SA, OA] },
    { id: 'ai-insights',    nl: 'AI-inzichten',           en: 'AI Insights',     icon: IC.ai,             roles: [SA, OA, SM] },
    { id: 'store-settings', nl: 'Vestigingsinstellingen', en: 'Store Settings',  icon: IC.storeSettings,  roles: [SA, OA, SM] },
    { id: 'organisations',  nl: 'Organisaties',           en: 'Organisations',   icon: IC.organisations,  roles: [SA] },
    { id: 'users',          nl: 'Gebruikers',             en: 'Users',           icon: IC.users,          roles: [SA, OA, SM] },
    // API integration keys are sensitive — HQ only (matches backend gate).
    { id: 'api-keys',       nl: 'API-sleutels',           en: 'API Keys',        icon: IC.apikeys,        roles: [SA, OA] },
    { id: 'audit-log',      nl: 'Auditlogboek',           en: 'Audit Log',       icon: IC.audit,          roles: [SA, OA, AU] },
    { id: 'licenses',       nl: 'Licenties',              en: 'Licenses',        icon: IC.license,        roles: [SA] },
  ]

  const initials = (user?.name ?? 'SA').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const roleBadge: Record<string, string> = {
    super_admin: 'Super Admin', organisation_admin: isNl ? 'Org. Beheerder' : 'Org. Admin',
    store_manager: isNl ? 'Winkelbeheerder' : 'Store Manager', auditor: isNl ? 'Controleur' : 'Auditor',
  }
  const currentLabel = screen === 'store'
    ? (isNl ? 'Winkeldetails' : 'Store Details')
    : (nav.find(n => n.id === screen)?.[isNl ? 'nl' : 'en'] ?? '')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f8' }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#1c1c2e',
        boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
        zIndex: 20,
      }}>

        {/* Logo area */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 20, height: 20 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>Josbin POS</p>
              <p style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {isNl ? 'Beheerportaal' : 'Management Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', padding: '0 8px', marginBottom: 8 }}>
            {isNl ? 'NAVIGATIE' : 'MAIN MENU'}
          </p>

          {nav.filter(item => item.roles.includes(user?.role ?? '')).map(item => {
            const active = screen === item.id
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  marginBottom: 2, textAlign: 'left', fontSize: 13.5, fontWeight: active ? 600 : 500,
                  transition: 'all 0.15s ease',
                  background: active ? 'linear-gradient(90deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))' : 'transparent',
                  color: active ? '#a78bfa' : 'rgba(255,255,255,0.55)',
                  borderLeft: active ? '3px solid #7c3aed' : '3px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                  }
                }}
              >
                <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0, color: active ? '#a78bfa' : 'inherit' }}>
                  {item.icon}
                </span>
                {isNl ? item.nl : item.en}
              </button>
            )
          })}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '12px 0' }} />
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', padding: '0 8px', marginBottom: 8 }}>
            {isNl ? 'TAAL' : 'LANGUAGE'}
          </p>
          <div style={{ display: 'flex', gap: 6, padding: '0 8px' }}>
            {(['nl', 'en'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                  background: i18n.language === lang ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(255,255,255,0.07)',
                  color: i18n.language === lang ? '#fff' : 'rgba(255,255,255,0.4)',
                  boxShadow: i18n.language === lang ? '0 2px 8px rgba(124,58,237,0.4)' : 'none',
                }}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
            }}>{initials}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 }}>{roleBadge[user?.role ?? ''] ?? user?.role}</p>
            </div>
            <button
              title={isNl ? 'Uitloggen' : 'Logout'}
              onClick={async () => logout()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, borderRadius: 6, flexShrink: 0, transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
            >{IC.logout}</button>
          </div>
        </div>
      </aside>

      {/* ══ MAIN ═════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          background: '#fff', flexShrink: 0, height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px',
          boxShadow: '0 1px 0 #e9e9ef',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {screen === 'store' && (
              <button
                onClick={() => go('overview')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6d6d80', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: '6px 10px', borderRadius: 8, marginRight: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f8'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                {isNl ? 'Terug' : 'Back'}
              </button>
            )}
            {/* Breadcrumb */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#9090a0', fontSize: 12 }}>Josbin POS</span>
                <span style={{ color: '#c0c0cc', fontSize: 12 }}>/</span>
                <span style={{ color: '#1c1c2e', fontSize: 14, fontWeight: 700 }}>{currentLabel}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Live dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#ecfdf5', padding: '5px 12px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px rgba(34,197,94,0.3)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Live</span>
            </div>
            {/* Date */}
            <span style={{ fontSize: 12, color: '#9090a0', display: 'none' }} className="sm:!inline">
              {new Date().toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {/* User chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 6px', borderRadius: 24, background: '#f5f5f8', border: '1px solid #e9e9ef', cursor: 'default' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                {initials}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3d3d50' }}>{user?.name?.split(' ')[0]}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Suspense fallback={<ScreenLoading />}>
            {screen === 'overview'      && <DashboardOverview onStoreSelect={openStore} />}
            {screen === 'store' && selectedStoreId && <StoreDetailScreen storeId={selectedStoreId} />}
            {screen === 'reports'       && <ReportsScreen />}
            {screen === 'organisations' && <OrganisationsScreen />}
            {screen === 'users'         && <UsersScreen />}
            {screen === 'api-keys'      && <ApiKeysScreen />}
            {screen === 'z-reports'     && <ZReportScreen />}
            {screen === 'audit-log'     && <AuditLogScreen />}
            {screen === 'licenses'      && <LicenseScreen />}
            {screen === 'catalogue'     && <CatalogueScreen />}
            {screen === 'registers'     && <RegistersScreen />}
            {screen === 'customers'     && <CustomersScreen />}
            {screen === 'stock'         && <StockScreen />}
            {screen === 'ai-insights'   && <AiInsightsScreen />}
            {screen === 'price-overrides' && <PriceOverridesScreen />}
            {screen === 'discount-rules'  && <DiscountRulesScreen />}
            {screen === 'compare'       && <StoreComparisonScreen />}
            {screen === 'store-settings'  && <StoreSettingsScreen />}
            {screen === 'import-export'   && <CatalogueImportExportScreen />}
            {screen === 'my-account'      && <MyAccountScreen />}
            {screen === 'pos-launcher'    && <PosLauncherScreen />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
