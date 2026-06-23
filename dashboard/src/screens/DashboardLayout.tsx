import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import HelpButton from '@/components/shared/HelpButton'
import NotificationBell from '@/components/shared/NotificationBell'

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
const StoresScreen                 = lazy(() => import('@/screens/StoresScreen'))
const CatalogueImportExportScreen  = lazy(() => import('@/screens/CatalogueImportExportScreen'))
const MyAccountScreen              = lazy(() => import('@/screens/MyAccountScreen'))
const PosLauncherScreen            = lazy(() => import('@/screens/PosLauncherScreen'))
const BtwSubmissionsScreen         = lazy(() => import('@/screens/BtwSubmissionsScreen'))
const BtwSubmissionDetailScreen    = lazy(() => import('@/screens/BtwSubmissionDetailScreen'))
const TaxInspectorDashboard        = lazy(() => import('@/screens/TaxInspectorDashboard'))
const PendingPaymentsScreen        = lazy(() => import('@/screens/PendingPaymentsScreen'))

type Screen =
  | 'overview' | 'store' | 'reports' | 'organisations' | 'stores' | 'users' | 'api-keys'
  | 'z-reports' | 'audit-log' | 'licenses' | 'catalogue' | 'registers'
  | 'customers' | 'stock' | 'ai-insights' | 'price-overrides' | 'discount-rules' | 'compare' | 'store-settings' | 'import-export'
  | 'my-account' | 'pos-launcher' | 'btw-submissions' | 'btw-submission-detail' | 'tax-dashboard' | 'pending-payments'

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

  // Default landing screen by role:
  //   - Cashier        → My Account (no dashboard ops; they live in the POS)
  //   - Tax Inspector  → Tax Inspector Dashboard (KPI overview; can click into list)
  //   - Everyone else  → Overview (the daily KPI screen)
  const defaultScreen: Screen =
    user?.role === 'cashier'       ? 'my-account' :
    user?.role === 'tax_inspector' ? 'tax-dashboard' :
    'overview'
  const [screen, setScreen]               = useState<Screen>(defaultScreen)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  // Task #82 — BTW submission detail navigation. The list screen calls
  // openSubmissionDetail(id) which routes to the detail screen.
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  // Pre-applied filter when the user click-throughs from Tax Inspector
  // Dashboard's tiles into the list ("pending review" → status=filed).
  const [btwListInitialFilter, setBtwListInitialFilter] = useState<{ status?: 'filed' | 'disputed'; organisation_id?: string } | undefined>(undefined)
  // When the dashboard deep-links into the stock screen (e.g. via the
  // "Stock alerts" tile on the overview) we use this to pre-select the
  // low-stock tab. Cleared whenever the user navigates anywhere else.
  const [stockInitialTab, setStockInitialTab] = useState<'all' | 'low'>('all')
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

  function go(s: Screen) {
    // Any nav move that isn't an explicit "open Stock with low-only" should
    // reset the deep-link flag, so a later click on the sidebar lands on the
    // normal "all products" tab.
    if (s !== 'stock') setStockInitialTab('all')
    // Reset BTW list pre-filter when sidebar nav fires — only Tax Inspector
    // Dashboard's tile clicks should land with a filter.
    if (s !== 'btw-submissions') setBtwListInitialFilter(undefined)
    setScreen(s)
  }
  function openStore(id: string) { setSelectedStoreId(id); setScreen('store') }
  function openStockLowOnly() {
    setStockInitialTab('low')
    setScreen('stock')
  }
  // Task #82 — open the BTW detail screen for a specific submission.
  function openSubmissionDetail(id: string) {
    setSelectedSubmissionId(id)
    setScreen('btw-submission-detail')
  }
  // Task #82 — landing-screen tile click jumps to the list with a filter pre-set.
  function openBtwListWithFilter(f?: { status?: 'filed' | 'disputed'; organisation_id?: string }) {
    setBtwListInitialFilter(f)
    setScreen('btw-submissions')
  }

  // Nav is sectioned per role following industry-standard SaaS B2B layouts
  // (Stripe / Shopify Plus / Datadog org-admin). Each item declares which
  // section it sits under per role — same screen lives under "Platform" for
  // SA (governance work) and under "Operations" for OA (daily ops).
  //
  // Section rules:
  //   • PLATFORM        — SA's core job: tenants, licences, governance, users,
  //                       audit, AI at platform level. The only daily home.
  //   • OPERATIONS      — daily ops (overview, reports, Z-reports, AI insights,
  //                       comparison, customers) where an OA / SM lives.
  //   • CATALOGUE       — product / price / discount / stock management.
  //   • ORGANISATION    — org wiring: stores, users, API keys, audit log,
  //                       registers, store settings.
  //   • SUPPORT TOOLS   — SA-only: operational tenant data they CAN reach for
  //                       client support, but isn't their daily job. Clearly
  //                       labelled so SA doesn't browse a client's BTW reports
  //                       for fun. Industry convention: tenant data lives
  //                       behind an "impersonate" or clearly-marked section.
  //   • COMPLIANCE      — Auditor's read-only home: Z-reports + audit log.
  //   • ACCOUNT         — self-service. Always last in every role's nav.
  //
  // Cashier never gets dashboard nav (redirected to POS at layout root);
  // api_integration is shut out above this block.
  const SA = 'super_admin', OA = 'organisation_admin', SM = 'store_manager', AU = 'auditor', CA = 'cashier'
  // Belastingdienst Suriname tax inspector. Cross-org read-only access, lives
  // entirely in COMPLIANCE — they don't need Platform, Operations, or anything
  // else. Two items: BTW Submissions + My Account.
  const TI = 'tax_inspector'
  type Section = 'platform' | 'operations' | 'catalogue' | 'organisation' | 'support_tools' | 'compliance' | 'account'

  // Per-role section order. A section absent from this list never renders for
  // that role even if a nav item is tagged for it.
  const SECTION_ORDER: Record<string, Section[]> = {
    [SA]: ['platform', 'support_tools', 'account'],
    [OA]: ['operations', 'catalogue', 'organisation', 'account'],
    [SM]: ['operations', 'catalogue', 'organisation', 'account'],
    [AU]: ['operations', 'compliance', 'account'],
    [TI]: ['compliance', 'account'],
    [CA]: ['account'],
  }

  const SECTION_LABEL: Record<Section, { nl: string; en: string }> = {
    platform:      { nl: 'Platform',              en: 'Platform' },
    operations:    { nl: 'Operaties',             en: 'Operations' },
    catalogue:     { nl: 'Catalogus',             en: 'Catalogue' },
    organisation:  { nl: 'Organisatie',           en: 'Organisation' },
    support_tools: { nl: 'Support — tenant data', en: 'Support — tenant data' },
    compliance:    { nl: 'Compliance',            en: 'Compliance' },
    account:       { nl: 'Account',               en: 'Account' },
  }

  type NavItem = {
    id: Screen; nl: string; en: string; icon: React.ReactNode
    sections: Partial<Record<string, Section>>
  }
  const nav: NavItem[] = [
    // ── Overview / dashboard ────────────────────────────────────────────────
    // SA: platform-wide pulse. OA/SM/Auditor: daily ops KPI screen.
    { id: 'overview', nl: 'Dashboard', en: 'Dashboard', icon: IC.overview,
      sections: { [SA]: 'platform', [OA]: 'operations', [SM]: 'operations', [AU]: 'operations' } },

    // ── Tenant governance — SA's core job ───────────────────────────────────
    { id: 'organisations', nl: 'Organisaties', en: 'Organisations', icon: IC.organisations,
      sections: { [SA]: 'platform' } },
    { id: 'licenses', nl: 'Licenties', en: 'Licenses', icon: IC.license,
      sections: { [SA]: 'platform' } },

    // ── Users ───────────────────────────────────────────────────────────────
    // SA: platform-wide user mgmt (other SAs + OAs across orgs). OA/SM: org users.
    { id: 'users', nl: 'Gebruikers', en: 'Users', icon: IC.users,
      sections: { [SA]: 'platform', [OA]: 'organisation', [SM]: 'organisation' } },

    // ── Audit log ───────────────────────────────────────────────────────────
    // SA: platform governance. OA: own-org compliance. Auditor: home tab.
    // Tax inspector also gets it under Compliance — limited to their own
    // review actions (the audit log controller scopes for them).
    { id: 'audit-log', nl: 'Auditlogboek', en: 'Audit Log', icon: IC.audit,
      sections: { [SA]: 'platform', [OA]: 'organisation', [AU]: 'compliance', [TI]: 'compliance' } },

    // ── Tax / BTW Dashboard (the new KPI landing for TI; also OA's own-org view) ──
    // Renders cross-tenant KPIs for TI/SA, scoped-to-own-org for OA.
    { id: 'tax-dashboard', nl: 'BTW Dashboard', en: 'BTW Dashboard', icon: IC.overview,
      sections: { [TI]: 'compliance', [OA]: 'operations' } },

    // ── BTW Submissions (Belastingdienst Suriname filings) ──────────────────
    // OA/SM: daily / monthly filing flow → Operations (their daily work).
    // SA: support drill-in into customer compliance → Platform.
    // Tax inspector: secondary to the dashboard above — list view of all filings.
    { id: 'btw-submissions', nl: 'BTW-aangiftes', en: 'BTW Submissions', icon: IC.zreports,
      sections: { [SA]: 'platform', [OA]: 'operations', [SM]: 'operations', [TI]: 'compliance' } },

    // ── Pending Payments (bank/mobile transfers awaiting confirmation) ──────
    // OA owns confirming that funds landed; SA can also act for support.
    { id: 'pending-payments', nl: 'Openstaande betalingen', en: 'Pending Payments', icon: IC.zreports,
      sections: { [SA]: 'support_tools', [OA]: 'operations' } },

    // ── AI insights ─────────────────────────────────────────────────────────
    // SA: cross-tenant patterns. OA/SM: org-scoped insights.
    { id: 'ai-insights', nl: 'AI-inzichten', en: 'AI Insights', icon: IC.ai,
      sections: { [SA]: 'platform', [OA]: 'operations', [SM]: 'operations' } },

    // ── API keys ────────────────────────────────────────────────────────────
    // SA: external-integration governance. OA: their integration setup.
    { id: 'api-keys', nl: 'API-sleutels', en: 'API Keys', icon: IC.apikeys,
      sections: { [SA]: 'platform', [OA]: 'organisation' } },

    // ── Stores ──────────────────────────────────────────────────────────────
    // SA: drill-in for support. OA: org-mgmt home (add/edit stores).
    // Store Manager is intentionally excluded — only SA/OA create or edit
    // stores (backend StorePolicy/OrganisationPolicy already enforce this);
    // showing the menu only led an SM to a screen where every action 403s.
    { id: 'stores', nl: 'Vestigingen', en: 'Stores', icon: IC.organisations,
      sections: { [SA]: 'support_tools', [OA]: 'organisation' } },

    // ── Operational reports ─────────────────────────────────────────────────
    { id: 'reports', nl: 'Rapporten', en: 'Reports', icon: IC.reports,
      sections: { [SA]: 'support_tools', [OA]: 'operations', [SM]: 'operations', [AU]: 'operations' } },
    { id: 'z-reports', nl: 'Z-Rapporten', en: 'Z-Reports', icon: IC.zreports,
      sections: { [SA]: 'support_tools', [OA]: 'operations', [SM]: 'operations', [AU]: 'compliance' } },
    { id: 'compare', nl: 'Vergelijking', en: 'Comparison', icon: IC.compare,
      sections: { [SA]: 'support_tools', [OA]: 'operations' } },

    // ── Catalogue & pricing ─────────────────────────────────────────────────
    { id: 'catalogue', nl: 'Catalogus', en: 'Catalogue', icon: IC.catalogue,
      sections: { [SA]: 'support_tools', [OA]: 'catalogue', [SM]: 'catalogue' } },
    // import-export: OA + SM. Single-shop managers often own the catalogue.
    { id: 'import-export', nl: 'Import / Export', en: 'Import / Export', icon: IC.importExport,
      sections: { [SA]: 'support_tools', [OA]: 'catalogue', [SM]: 'catalogue' } },
    { id: 'price-overrides', nl: 'Prijsoverschrijvingen', en: 'Price Overrides', icon: IC.prices,
      sections: { [SA]: 'support_tools', [OA]: 'catalogue' } },
    { id: 'discount-rules', nl: 'Kortingsregels', en: 'Discount Rules', icon: IC.discounts,
      sections: { [SA]: 'support_tools', [OA]: 'catalogue', [SM]: 'catalogue' } },
    { id: 'stock', nl: 'Voorraad', en: 'Stock', icon: IC.stock,
      sections: { [SA]: 'support_tools', [OA]: 'catalogue', [SM]: 'catalogue' } },

    // ── Registers / customers / store settings ──────────────────────────────
    { id: 'registers', nl: 'Kassabeheer', en: 'Registers', icon: IC.registers,
      sections: { [SA]: 'support_tools', [OA]: 'organisation', [SM]: 'organisation' } },
    { id: 'customers', nl: 'Klanten', en: 'Customers', icon: IC.customers,
      sections: { [SA]: 'support_tools', [OA]: 'operations', [SM]: 'operations' } },
    { id: 'store-settings', nl: 'Vestigingsinstellingen', en: 'Store Settings', icon: IC.storeSettings,
      sections: { [SA]: 'support_tools', [OA]: 'organisation', [SM]: 'organisation' } },

    // ── Account (self-service) — always last ────────────────────────────────
    { id: 'my-account', nl: 'Mijn Profiel', en: 'My Account', icon: IC.users,
      sections: { [SA]: 'account', [OA]: 'account', [SM]: 'account', [AU]: 'account', [TI]: 'account', [CA]: 'account' } },
    // POS launcher: only roles that actually ring up sales. SA + Auditor
    // never ring up — removed from their nav (was a footgun).
    { id: 'pos-launcher', nl: 'POS-app openen', en: 'Open POS app', icon: IC.registers,
      sections: { [OA]: 'account', [SM]: 'account', [CA]: 'account' } },
  ]

  // Group nav items by section for the current role, preserving the order
  // items appear in the `nav` array above.
  const role = user?.role ?? ''
  const visibleByGroup: Array<{ section: Section; items: NavItem[] }> = (SECTION_ORDER[role] ?? [])
    .map((sec) => ({
      section: sec,
      items: nav.filter((item) => item.sections[role] === sec),
    }))
    .filter((g) => g.items.length > 0)

  const initials = (user?.name ?? 'SA').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const roleBadge: Record<string, string> = {
    super_admin: 'Super Admin', organisation_admin: isNl ? 'Org. Beheerder' : 'Org. Admin',
    store_manager: isNl ? 'Winkelbeheerder' : 'Store Manager', auditor: isNl ? 'Controleur' : 'Auditor',
    tax_inspector: isNl ? 'Belastinginspecteur' : 'Tax Inspector',
  }
  const currentLabel = screen === 'store'
    ? (isNl ? 'Winkeldetails' : 'Store Details')
    : (nav.find(n => n.id === screen)?.[isNl ? 'nl' : 'en'] ?? '')

  // Chrome palette is role-aware: the Belastingdienst (tax_inspector) gets an
  // official deep-green + gold government skin; everyone else keeps the
  // commercial indigo "Management Portal" look.
  const isTaxInspector = user?.role === 'tax_inspector'
  const chrome = isTaxInspector
    ? {
        sidebarBg: '#0c3a22',
        logoGrad: 'linear-gradient(135deg,#1f6b3b,#0e4429)',
        logoShadow: '0 4px 14px rgba(15,58,34,.5)',
        brand: 'Belastingdienst',
        portal: isNl ? 'BTW-inspectieportaal' : 'BTW Inspection Portal',
        portalColor: '#f4c430',
        activeBg: 'linear-gradient(90deg, rgba(31,107,59,.45), rgba(14,68,41,.2))',
        activeText: '#f4c430',
        activeBar: '#f4c430',
        toggleGrad: 'linear-gradient(135deg,#1f6b3b,#0e4429)',
        toggleShadow: '0 2px 8px rgba(15,58,34,.5)',
      }
    : {
        sidebarBg: '#1c1c2e',
        logoGrad: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        logoShadow: '0 4px 14px rgba(124,58,237,0.45)',
        brand: 'Josbin POS',
        portal: isNl ? 'Beheerportaal' : 'Management Portal',
        portalColor: '#7c3aed',
        activeBg: 'linear-gradient(90deg, rgba(124,58,237,0.25), rgba(79,70,229,0.15))',
        activeText: '#a78bfa',
        activeBar: '#7c3aed',
        toggleGrad: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
        toggleShadow: '0 2px 8px rgba(124,58,237,0.4)',
      }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f8' }}>

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: chrome.sidebarBg,
        boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
        zIndex: 20,
      }}>

        {/* Logo area */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: chrome.logoGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: chrome.logoShadow,
            }}>
              {isTaxInspector ? (
                <span style={{ fontSize: 22, color: '#f4c430', lineHeight: 1 }}>★</span>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 20, height: 20 }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                </svg>
              )}
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px', fontFamily: isTaxInspector ? "Georgia,'Times New Roman',serif" : 'inherit' }}>{chrome.brand}</p>
              <p style={{ color: chrome.portalColor, fontSize: 11, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {chrome.portal}
              </p>
            </div>
          </div>
        </div>

        {/* Nav — sectioned per role.
            Each section gets a small caps label so SA can tell "this is my
            day job" (Platform) from "this is tenant data, only here for
            support" (Support Tools). OA/SM/Auditor see their own sections;
            see SECTION_ORDER above. */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {visibleByGroup.map((group, idx) => (
            <div key={group.section} style={{ marginBottom: idx === visibleByGroup.length - 1 ? 0 : 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', padding: '0 8px', marginBottom: 8, marginTop: idx === 0 ? 0 : 0 }}>
                {SECTION_LABEL[group.section][isNl ? 'nl' : 'en']}
              </p>
              {group.items.map((item) => {
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
                      background: active ? chrome.activeBg : 'transparent',
                      color: active ? chrome.activeText : 'rgba(255,255,255,0.55)',
                      borderLeft: active ? `3px solid ${chrome.activeBar}` : '3px solid transparent',
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
                    <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0, color: active ? chrome.activeText : 'inherit' }}>
                      {item.icon}
                    </span>
                    {isNl ? item.nl : item.en}
                  </button>
                )
              })}
            </div>
          ))}

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
                  background: i18n.language === lang ? chrome.toggleGrad : 'rgba(255,255,255,0.07)',
                  color: i18n.language === lang ? '#fff' : 'rgba(255,255,255,0.4)',
                  boxShadow: i18n.language === lang ? chrome.toggleShadow : 'none',
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
              background: chrome.logoGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
              boxShadow: chrome.logoShadow,
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
            {/* In-app notification bell — BTW disputes/accepts/resubmits */}
            <NotificationBell
              accent={isTaxInspector ? '#1f6b3b' : '#6366f1'}
              onNavigate={(n) => {
                if (n.data.submission_id) openSubmissionDetail(n.data.submission_id)
                else go('btw-submissions')
              }}
            />
            {/* Context-aware help for the current screen */}
            <HelpButton topic={
              screen === 'btw-submission-detail' ? 'btw-submissions'
              : screen === 'store' ? 'overview'
              : screen
            } />
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
            {screen === 'overview'      && <DashboardOverview onStoreSelect={openStore} onOpenStockAlerts={openStockLowOnly} />}
            {screen === 'store' && selectedStoreId && (
              <StoreDetailScreen
                storeId={selectedStoreId}
                onBack={() => { setScreen('overview'); setSelectedStoreId(null) }}
              />
            )}
            {screen === 'reports'       && <ReportsScreen />}
            {screen === 'organisations' && <OrganisationsScreen />}
            {screen === 'stores'        && <StoresScreen />}
            {screen === 'users'         && <UsersScreen />}
            {screen === 'api-keys'      && <ApiKeysScreen />}
            {screen === 'z-reports'     && <ZReportScreen />}
            {screen === 'audit-log'     && <AuditLogScreen />}
            {screen === 'licenses'      && <LicenseScreen />}
            {screen === 'catalogue'     && <CatalogueScreen />}
            {screen === 'registers'     && <RegistersScreen />}
            {screen === 'customers'     && <CustomersScreen />}
            {screen === 'stock'         && <StockScreen initialActiveTab={stockInitialTab} />}
            {screen === 'ai-insights'   && <AiInsightsScreen />}
            {screen === 'price-overrides' && <PriceOverridesScreen />}
            {screen === 'discount-rules'  && <DiscountRulesScreen />}
            {screen === 'compare'       && <StoreComparisonScreen />}
            {screen === 'store-settings'  && <StoreSettingsScreen />}
            {screen === 'import-export'   && <CatalogueImportExportScreen />}
            {screen === 'my-account'      && <MyAccountScreen />}
            {screen === 'pos-launcher'    && <PosLauncherScreen />}
            {screen === 'btw-submissions' && (
              <BtwSubmissionsScreen
                onOpenDetail={openSubmissionDetail}
                initialFilter={btwListInitialFilter}
              />
            )}
            {screen === 'btw-submission-detail' && selectedSubmissionId && (
              <BtwSubmissionDetailScreen
                submissionId={selectedSubmissionId}
                onBack={() => setScreen('btw-submissions')}
              />
            )}
            {screen === 'tax-dashboard' && (
              <TaxInspectorDashboard onNavigateToSubmissions={openBtwListWithFilter} />
            )}
            {screen === 'pending-payments' && <PendingPaymentsScreen />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
