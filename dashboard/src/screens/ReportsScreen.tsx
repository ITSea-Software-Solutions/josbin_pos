import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getConsolidatedReport, getConsolidatedBtwReport, getBtwExemptionsReport, getProfitReport, exportReport } from '@/api/dashboard'
import { getStores } from '@/api/stores'
import { useTableSort } from '@/lib/useTableSort'
import { formatSRD } from '@/utils/currency'
import { format, subDays, startOfMonth } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useDashboardAuthStore } from '@/store/authStore'

type ReportTab = 'consolidated' | 'btw' | 'exemptions' | 'profit'

function today() { return format(new Date(), 'yyyy-MM-dd') }
function monthStart() { return format(startOfMonth(new Date()), 'yyyy-MM-dd') }

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '16px 20px' }}>
          <div style={{ height: 13, borderRadius: 6, background: '#eef2fb', maxWidth: i === 0 ? 180 : 100 }} />
        </td>
      ))}
    </tr>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: spinning ? 'spin-r 0.8s linear infinite' : 'none' }}
    >
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}

export default function ReportsScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const [tab, setTab] = useState<ReportTab>('consolidated')
  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(today())

  // Store filter (optional drill-down). Empty = whole org (default).
  // SM with single store sees the filter pre-selected and read-only-ish
  // (only their store appears in the list). Foreign IDs are silently
  // ignored on the backend so user can't escape their org by guessing UUIDs.
  const [storeId, setStoreId] = useState('')
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: () => getStores() })
  if (!storeId && stores.length === 1) {
    setStoreId(stores[0].id)
  }

  const {
    data: consolidated,
    isLoading: cLoading,
    isFetching: cFetching,
    refetch: cRefetch,
  } = useQuery({
    queryKey: ['consolidated-report', dateFrom, dateTo, storeId],
    queryFn: () => getConsolidatedReport({
      date_from: dateFrom, date_to: dateTo,
      ...(storeId ? { store_id: storeId } : {}),
    }),
    enabled: tab === 'consolidated',
  })

  const {
    data: btwReport,
    isLoading: bLoading,
    isFetching: bFetching,
    refetch: bRefetch,
  } = useQuery({
    queryKey: ['btw-report', dateFrom, dateTo, storeId],
    queryFn: () => getConsolidatedBtwReport({
      date_from: dateFrom, date_to: dateTo,
      ...(storeId ? { store_id: storeId } : {}),
    }),
    enabled: tab === 'btw',
  })

  const [exemptPage, setExemptPage] = useState(1)
  const {
    data: exemptions,
    isLoading: eLoading,
    isFetching: eFetching,
    refetch: eRefetch,
  } = useQuery({
    queryKey: ['btw-exemptions-report', dateFrom, dateTo, storeId, exemptPage],
    queryFn: () => getBtwExemptionsReport({
      date_from: dateFrom, date_to: dateTo, page: exemptPage, per_page: 50,
      ...(storeId ? { store_id: storeId } : {}),
    }),
    enabled: tab === 'exemptions',
    placeholderData: (prev) => prev,
  })
  // Filters changed → back to page 1 (a page number from the old result
  // set would silently show the wrong slice).
  useEffect(() => { setExemptPage(1) }, [dateFrom, dateTo, storeId])

  // Profit report — same date range + store filter as the other two tabs.
  // Requires products.view_cost on the backend (OA + SA + SM). Auditor /
  // cashier hit 403; the tab is hidden from them via the canSeeProfit gate.
  const {
    data: profitReport,
    isLoading: pLoading,
    isFetching: pFetching,
    refetch: pRefetch,
  } = useQuery({
    queryKey: ['profit-report', dateFrom, dateTo, storeId],
    queryFn: () => getProfitReport({
      date_from: dateFrom, date_to: dateTo,
      ...(storeId ? { store_id: storeId } : {}),
    }),
    enabled: tab === 'profit',
  })

  const isLoading  = tab === 'consolidated' ? cLoading  : tab === 'btw' ? bLoading  : tab === 'exemptions' ? eLoading  : pLoading
  const isFetching = tab === 'consolidated' ? cFetching : tab === 'btw' ? bFetching : tab === 'exemptions' ? eFetching : pFetching
  const refetch    = tab === 'consolidated' ? cRefetch  : tab === 'btw' ? bRefetch  : tab === 'exemptions' ? eRefetch  : pRefetch

  // Profit tab gated to roles with catalogue ownership (matches
  // products.view_cost perm seeded for SM, OA, SA).
  const actor = useDashboardAuthStore((s) => s.user)
  const canSeeProfit = ['super_admin', 'organisation_admin', 'store_manager'].includes(actor?.role ?? '')

  const [exporting, setExporting] = useState(false)

  // ── Client-side column sorting (shared hook → identical behaviour across all
  // dashboard tables). One hook call per data table; all called unconditionally
  // at top level. `?? []` guards the possibly-undefined report responses.
  const perStoreSort = useTableSort(consolidated?.per_store ?? [], {
    store:        (r) => r.store_name.toLowerCase(),
    city:         (r) => (r.city ?? '').toLowerCase(),
    revenue:      (r) => Number(r.total_sales) || 0,
    btw:          (r) => Number(r.total_btw) || 0,
    transactions: (r) => r.transaction_count || 0,
  })
  const topProductsSort = useTableSort(consolidated?.top_products ?? [], {
    product: (r) => r.name.toLowerCase(),
    qty:     (r) => Number(r.qty) || 0,
    revenue: (r) => Number(r.revenue) || 0,
  })
  const btwBreakdownSort = useTableSort(btwReport?.breakdown ?? [], {
    rate:    (r) => Number(r.btw_rate) || 0,
    exempt:  (r) => (r.btw_exempt ? 1 : 0),
    gross:   (r) => Number(r.gross_incl_btw) || 0,
    net:     (r) => Number(r.net_excl_btw) || 0,
    btw:     (r) => Number(r.btw_amount) || 0,
    sales:   (r) => r.sale_count || 0,
  })
  const profitPerStoreSort = useTableSort(profitReport?.per_store ?? [], {
    store:        (r) => r.store_name.toLowerCase(),
    revenue:      (r) => Number(r.revenue_srd) || 0,
    cost:         (r) => Number(r.cost_srd) || 0,
    profit:       (r) => Number(r.profit_srd) || 0,
    margin:       (r) => (r.margin_pct == null ? null : Number(r.margin_pct) || 0),
    transactions: (r) => r.transactions || 0,
  })
  const profitTopSort = useTableSort(profitReport?.top_products_by_profit ?? [], {
    product: (r) => r.name.toLowerCase(),
    qty:     (r) => Number(r.qty) || 0,
    revenue: (r) => Number(r.revenue_srd) || 0,
    profit:  (r) => Number(r.profit_srd) || 0,
    margin:  (r) => (r.margin_pct == null ? null : Number(r.margin_pct) || 0),
  })

  async function handleExportPdf() {
    setExporting(true)
    try {
      await exportReport(
        tab === 'btw' ? 'btw' : 'consolidated',
        {
          date_from: dateFrom, date_to: dateTo, locale: i18n.language,
          ...(storeId ? { store_id: storeId } : {}),
        },
      )
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    { id: 'consolidated' as const, nl: 'Geconsolideerd', en: 'Consolidated' },
    { id: 'btw'          as const, nl: 'BTW-overzicht',  en: 'BTW Report'   },
    { id: 'exemptions'   as const, nl: 'BTW-vrijstellingen', en: 'BTW exemptions' },
    ...(canSeeProfit
      ? [{ id: 'profit' as const, nl: 'Winst & marge', en: 'Profit & margin' }]
      : []),
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Rapporten' : 'Reports'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'Geconsolideerde omzet en BTW-overzichten voor alle vestigingen.'
            : 'Consolidated revenue and BTW reports across all stores.'}
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.12s',
              background: tab === t.id
                ? 'linear-gradient(135deg, #293371, #1f2a63)'
                : '#fff',
              color: tab === t.id ? '#fff' : '#6b7280',
              boxShadow: tab === t.id
                ? '0 2px 10px rgba(41,51,113,.35)'
                : '0 1px 4px rgba(0,0,0,.06)',
              border: tab === t.id ? 'none' : '1px solid #e6ecf5',
            }}
          >
            {isNl ? t.nl : t.en}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e6ecf5',
        padding: '16px 20px', marginBottom: 24,
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}>
        {/* Date From */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Van' : 'From'}
          </label>
          <input
            type="date" value={dateFrom} max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #d9e1f1',
              fontSize: 13, color: '#16203a', outline: 'none',
            }}
          />
        </div>

        {/* Date To */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Tot' : 'To'}
          </label>
          <input
            type="date" value={dateTo} min={dateFrom} max={today()}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #d9e1f1',
              fontSize: 13, color: '#16203a', outline: 'none',
            }}
          />
        </div>

        {/* Store drill-down — applies to all three tabs.
            Hidden when org has zero/one store (auto-selected). */}
        {stores.length > 1 && (
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
              {isNl ? 'Vestiging' : 'Store'}
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #d9e1f1',
                fontSize: 13, color: '#16203a', outline: 'none', minWidth: 200, background: '#fff',
              }}
              title={isNl ? 'Beperk rapporten tot één vestiging' : 'Limit reports to one store'}
            >
              <option value="">{isNl ? 'Alle vestigingen' : 'All stores'}</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </select>
          </div>
        )}

        {/* Quick range pills */}
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          {[
            { label: isNl ? 'Vandaag'      : 'Today',      fn: () => { setDateFrom(today()); setDateTo(today()) } },
            { label: isNl ? 'Gisteren'     : 'Yesterday',  fn: () => { const d = format(subDays(new Date(), 1), 'yyyy-MM-dd'); setDateFrom(d); setDateTo(d) } },
            { label: isNl ? 'Deze maand'   : 'This month', fn: () => { setDateFrom(monthStart()); setDateTo(today()) } },
          ].map((r) => (
            <button key={r.label} onClick={r.fn} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: '#f2f5fb', color: '#5f6a84', border: '1px solid #e9eef9',
              cursor: 'pointer',
            }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Spacer + buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: '#f2f5fb', color: '#293371',
              border: '1px solid #d5deef', fontSize: 12, fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              opacity: isFetching ? 0.6 : 1,
            }}
          >
            <RefreshIcon spinning={isFetching} />
            {isNl ? 'Vernieuwen' : 'Refresh'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 8,
              background: 'linear-gradient(135deg, #293371, #1f2a63)',
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
              cursor: exporting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(41,51,113,.35)',
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {exporting ? (
              <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            )}
            {exporting ? (isNl ? 'Bezig…' : 'Generating…') : (isNl ? 'Exporteer PDF' : 'Export PDF')}
          </button>
        </div>
      </div>

      {/* ── Consolidated Report ─────────────────────────────────────────── */}
      {tab === 'consolidated' && (
        <>
          {/* KPI cards */}
          {!cLoading && consolidated && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: isNl ? 'Totale omzet'  : 'Total revenue',  value: formatSRD(consolidated.total_sales),        color: '#293371' },
                { label: isNl ? 'Transacties'   : 'Transactions',   value: consolidated.transaction_count.toString(),   color: '#2563eb' },
                { label: isNl ? 'Gemiddelde bon' : 'Avg basket',     value: formatSRD(consolidated.avg_basket),          color: '#0891b2' },
                { label: 'BTW',                                       value: formatSRD(consolidated.total_btw),           color: '#059669' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
                  padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Payment breakdown */}
          {!cLoading && consolidated && (
            <div style={{
              background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
              padding: '18px 24px', marginBottom: 24,
              display: 'flex', gap: 32, alignItems: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 8 }}>
                {isNl ? 'Betaalmethoden' : 'Payment methods'}
              </span>
              {[
                { label: isNl ? 'Contant'    : 'Cash',     value: consolidated.payment_breakdown.cash,  color: '#16a34a' },
                { label: isNl ? 'PIN/Kaart'  : 'Card/PIN', value: consolidated.payment_breakdown.card,  color: '#2563eb' },
                { label: isNl ? 'Gemengd'    : 'Mixed',    value: consolidated.payment_breakdown.mixed, color: '#293371' },
                // Phase 2/3 methods — hidden until actually used in the
                // period so the familiar three-column layout stays clean.
                { label: isNl ? 'Overschrijving'   : 'Bank transfer',  value: consolidated.payment_breakdown.bank_transfer   ?? '0', color: '#0e7490' },
                { label: isNl ? 'Mobiel bankieren' : 'Mobile banking', value: consolidated.payment_breakdown.mobile_transfer ?? '0', color: '#7c2d92' },
                { label: isNl ? 'Vreemde valuta'   : 'Foreign cash',   value: consolidated.payment_breakdown.foreign_cash    ?? '0', color: '#a16207' },
                { label: isNl ? 'QR-wallet'        : 'QR wallet',      value: consolidated.payment_breakdown.qr_payment      ?? '0', color: '#ef6c00' },
              ].filter((p, idx) => idx < 3 || parseFloat(p.value) !== 0).map((p) => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#7e88a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{p.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{formatSRD(p.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Per-store table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>
                {isNl ? 'Per vestiging' : 'By store'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                  {[
                    { key: 'store',        label: isNl ? 'Vestiging' : 'Store' },
                    { key: 'city',         label: isNl ? 'Stad' : 'City' },
                    { key: 'revenue',      label: isNl ? 'Omzet' : 'Revenue' },
                    { key: 'btw',          label: 'BTW' },
                    { key: 'transactions', label: isNl ? 'Transacties' : 'Transactions' },
                  ].map((h) => (
                    <th key={h.key} onClick={() => perStoreSort.toggle(h.key)}
                      style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none' }}>
                      {h.label}
                      <span style={{ marginLeft: 5, fontSize: 9, color: perStoreSort.sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{perStoreSort.indicator(h.key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  : perStoreSort.sorted.map((row, i) => (
                    <tr
                      key={row.store_id}
                      style={{ borderBottom: i < perStoreSort.sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#16203a', fontSize: 14 }}>{row.store_name}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>{row.city ?? '—'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: '#293371' }}>{formatSRD(row.total_sales)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#059669', fontWeight: 600 }}>{formatSRD(row.total_btw)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, color: '#374151', fontWeight: 600 }}>{row.transaction_count}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          {/* Top products */}
          {!isLoading && (consolidated?.top_products.length ?? 0) > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>
                  {isNl ? 'Top producten' : 'Top products'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                    {[
                      { key: null,        label: '#' },
                      { key: 'product',   label: isNl ? 'Product' : 'Product' },
                      { key: 'qty',       label: isNl ? 'Aantal' : 'Qty' },
                      { key: 'revenue',   label: isNl ? 'Omzet' : 'Revenue' },
                    ].map((h) => (
                      <th key={h.label} onClick={h.key ? () => topProductsSort.toggle(h.key!) : undefined}
                        style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                        {h.label}
                        {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: topProductsSort.sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{topProductsSort.indicator(h.key)}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topProductsSort.sorted.map((p, i) => (
                    <tr
                      key={p.name}
                      style={{ borderBottom: i < topProductsSort.sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', width: 40 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 800,
                          background: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : '#f9fafb',
                          color: i === 0 ? '#92400e' : i === 1 ? '#475569' : '#9ca3af',
                        }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#16203a', fontSize: 14 }}>{p.name}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#6b7280', fontWeight: 600 }}>{parseFloat(p.qty).toFixed(0)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#293371' }}>{formatSRD(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── BTW Report ──────────────────────────────────────────────────── */}
      {tab === 'btw' && (
        <>
          {!bLoading && btwReport && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: isNl ? 'Totale BTW te betalen' : 'Total BTW payable',   value: formatSRD(btwReport.total_btw),   sub: `${dateFrom} → ${dateTo}`, color: '#dc2626' },
                { label: isNl ? 'Totale bruto omzet'   : 'Total gross revenue',  value: formatSRD(btwReport.total_gross), sub: btwReport.format,           color: '#293371' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
                  padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 6 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>
                {isNl ? 'Uitgesplitst per BTW-tarief' : 'Breakdown by BTW rate'}
              </span>
              <span style={{ fontSize: 12, color: '#7e88a0', marginLeft: 10 }}>
                {isNl ? 'Belastingdienst Suriname formaat' : 'Belastingdienst Suriname format'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                  {[
                    { key: 'rate',   label: isNl ? 'Tarief' : 'Rate' },
                    { key: 'exempt', label: isNl ? 'Vrijgesteld' : 'Exempt' },
                    { key: 'gross',  label: isNl ? 'Bruto incl. BTW' : 'Gross incl. BTW' },
                    { key: 'net',    label: isNl ? 'Netto excl. BTW' : 'Net excl. BTW' },
                    { key: 'btw',    label: 'BTW' },
                    { key: 'sales',  label: isNl ? 'Verkopen' : 'Sales' },
                  ].map((h) => (
                    <th key={h.key} onClick={() => btwBreakdownSort.toggle(h.key)}
                      style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none' }}>
                      {h.label}
                      <span style={{ marginLeft: 5, fontSize: 9, color: btwBreakdownSort.sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{btwBreakdownSort.indicator(h.key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : btwBreakdownSort.sorted.map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: i < btwBreakdownSort.sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 800, fontSize: 15, color: '#16203a' }}>{row.btw_rate}%</td>
                      <td style={{ padding: '14px 20px' }}>
                        {row.btw_exempt ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                            {isNl ? 'Ja' : 'Yes'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#d1d5db', fontWeight: 500 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#374151', fontWeight: 600 }}>{formatSRD(row.gross_incl_btw)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#374151', fontWeight: 600 }}>{formatSRD(row.net_excl_btw)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#dc2626' }}>{formatSRD(row.btw_amount)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{row.sale_count}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Profit & Margin Report ─────────────────────────────────────── */}
      {/* ── BTW exemptions (vrijstellingen) — who, why, and the forgone BTW ── */}
      {tab === 'exemptions' && (
        <>
          {!eLoading && exemptions && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                { label: isNl ? 'Vrijgestelde verkopen' : 'Exempt sales',        value: String(exemptions.summary.count),                        sub: `${dateFrom} → ${dateTo}`, color: '#293371' },
                { label: isNl ? 'Vrijgestelde omzet'    : 'Exempt turnover',     value: formatSRD(exemptions.summary.exempt_turnover_srd),       sub: isNl ? 'excl. BTW (netto geprijsd)' : 'excl. BTW (net priced)', color: '#293371' },
                { label: isNl ? 'Gederfde BTW'          : 'BTW forgone',         value: formatSRD(exemptions.summary.btw_forgone_srd),           sub: isNl ? 'wat de staat zou hebben ontvangen' : 'what the state would have received', color: '#dc2626' },
              ].map((c) => (
                <div key={c.label} style={{
                  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
                  padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7e88a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{c.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: c.color, letterSpacing: '-1px' }}>{c.value}</div>
                  <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 6 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>
                {isNl ? 'Vrijgestelde verkopen met reden' : 'Exempt sales with reason'}
              </span>
              <span style={{ fontSize: 12, color: '#7e88a0', marginLeft: 10 }}>
                {isNl ? 'De reden is verplicht vastgelegd op de kassa' : 'The reason is captured at the till, mandatorily'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafd', color: '#7e88a0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {[isNl ? 'Datum' : 'Date', isNl ? 'Bonnr.' : 'Sale #', isNl ? 'Vestiging' : 'Store', isNl ? 'Caissière' : 'Cashier', isNl ? 'Klant' : 'Customer', isNl ? 'Reden' : 'Reason', isNl ? 'Totaal' : 'Total', isNl ? 'Gederfde BTW' : 'BTW forgone'].map((h, i) => (
                      <th key={h} style={{ textAlign: i >= 6 ? 'right' : 'left', padding: '10px 14px', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {eLoading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}
                  {!eLoading && (exemptions?.rows ?? []).map((r) => (
                    <tr key={r.sale_id} style={{ borderTop: '1px solid #eef2f9' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{r.occurred_at ? format(new Date(r.occurred_at), 'dd-MM-yyyy HH:mm') : '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'ui-monospace, monospace' }}>{r.sale_number}</td>
                      <td style={{ padding: '10px 14px' }}>{r.store ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{r.cashier ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{r.customer ?? '—'}</td>
                      <td style={{ padding: '10px 14px', maxWidth: 320 }}>{r.reason ?? '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{formatSRD(r.total_srd)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#dc2626' }}>{r.btw_forgone_srd ? formatSRD(r.btw_forgone_srd) : '—'}</td>
                    </tr>
                  ))}
                  {!eLoading && (exemptions?.rows ?? []).length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '28px 14px', textAlign: 'center', color: '#7e88a0' }}>
                      {isNl ? 'Geen vrijgestelde verkopen in deze periode.' : 'No exempt sales in this period.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {exemptions && exemptions.pagination.last_page > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #e9eef9' }}>
                <span style={{ fontSize: 12, color: '#7e88a0' }}>
                  {isNl
                    ? `${exemptions.pagination.total} verkopen · pagina ${exemptions.pagination.page} van ${exemptions.pagination.last_page}`
                    : `${exemptions.pagination.total} sales · page ${exemptions.pagination.page} of ${exemptions.pagination.last_page}`}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setExemptPage((p) => Math.max(1, p - 1))}
                    disabled={exemptions.pagination.page <= 1 || eFetching}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: '1px solid #e6ecf5', background: '#fff', color: exemptions.pagination.page <= 1 ? '#c3cad9' : '#16203a', cursor: exemptions.pagination.page <= 1 ? 'not-allowed' : 'pointer' }}
                  >
                    ← {isNl ? 'Vorige' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setExemptPage((p) => Math.min(exemptions.pagination.last_page, p + 1))}
                    disabled={exemptions.pagination.page >= exemptions.pagination.last_page || eFetching}
                    style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: '1px solid #e6ecf5', background: '#fff', color: exemptions.pagination.page >= exemptions.pagination.last_page ? '#c3cad9' : '#16203a', cursor: exemptions.pagination.page >= exemptions.pagination.last_page ? 'not-allowed' : 'pointer' }}
                  >
                    {isNl ? 'Volgende' : 'Next'} →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'profit' && (
        <>
          {/* Top-line KPI cards */}
          {!pLoading && profitReport && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: isNl ? 'Omzet'           : 'Revenue',       value: formatSRD(profitReport.revenue_srd), accent: '#293371' },
                { label: isNl ? 'Inkoopkosten'    : 'Cost of goods', value: formatSRD(profitReport.cost_srd),    accent: '#dc2626' },
                { label: isNl ? 'Winst'           : 'Profit',        value: formatSRD(profitReport.profit_srd),  accent: '#16a34a', big: true },
                { label: isNl ? 'Marge %'         : 'Margin %',
                  value: profitReport.margin_pct ? `${profitReport.margin_pct}%` : '—',
                  accent: '#0891b2' },
                { label: isNl ? 'Transacties'     : 'Transactions',  value: profitReport.transactions.toString(), accent: '#6b7280' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
                  padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: s.accent }} />
                  <div style={{ fontSize: s.big ? 28 : 22, fontWeight: 900, color: s.accent, letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, color: '#7e88a0', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Items-without-cost warning — shown when any line lacks a snapshot */}
          {!pLoading && profitReport && profitReport.items_without_cost > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
              ⚠️ <strong>{profitReport.items_without_cost}</strong>{' '}
              {isNl
                ? 'verkochte regels hebben geen inkoopkosten. Winst onderschat. Stel inkoopprijs in voor die producten in Catalogus.'
                : 'sold lines have no cost recorded. Profit is understated. Set cost_price on those products in Catalogue.'}
            </div>
          )}

          {/* 30-day trend chart */}
          {!pLoading && profitReport && profitReport.daily.length > 1 && (
            <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '18px 22px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                {isNl ? 'Dagelijkse winst (trend)' : 'Daily profit (trend)'}
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={profitReport.daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2fb" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'd MMM')} fontSize={11} stroke="#7e88a0" />
                  <YAxis fontSize={11} stroke="#7e88a0" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                  <Tooltip
                    formatter={(v: number | string, key) => [formatSRD(String(v)), key === 'revenue_srd' ? (isNl ? 'Omzet' : 'Revenue') : (isNl ? 'Winst' : 'Profit')]}
                    labelFormatter={(d) => format(new Date(d), 'EEE d MMM yyyy')}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="revenue_srd" stroke="#293371" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="profit_srd"  stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-store breakdown */}
          {!pLoading && profitReport && profitReport.per_store.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{isNl ? 'Per vestiging' : 'By store'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                    {[
                      { key: 'store',        label: isNl ? 'Vestiging' : 'Store' },
                      { key: 'revenue',      label: isNl ? 'Omzet'     : 'Revenue' },
                      { key: 'cost',         label: isNl ? 'Inkoop'    : 'Cost' },
                      { key: 'profit',       label: isNl ? 'Winst'     : 'Profit' },
                      { key: 'margin',       label: isNl ? 'Marge'     : 'Margin' },
                      { key: 'transactions', label: isNl ? 'Transacties' : 'Txns' },
                    ].map((h) => (
                      <th key={h.key} onClick={() => profitPerStoreSort.toggle(h.key)}
                        style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none' }}>
                        {h.label}
                        <span style={{ marginLeft: 5, fontSize: 9, color: profitPerStoreSort.sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{profitPerStoreSort.indicator(h.key)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitPerStoreSort.sorted.map((s, i) => (
                    <tr key={s.store_id} style={{ borderBottom: i < profitPerStoreSort.sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: '#16203a' }}>{s.store_name}<div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 400 }}>{s.city}</div></td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums' }}>{formatSRD(s.revenue_srd)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{formatSRD(s.cost_srd)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: parseFloat(s.profit_srd) >= 0 ? '#16a34a' : '#dc2626' }}>{formatSRD(s.profit_srd)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', color: parseFloat(s.margin_pct ?? '0') >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{s.margin_pct ? `${s.margin_pct}%` : '—'}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{s.transactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top 10 products by PROFIT (not revenue — different ranking) */}
          {!pLoading && profitReport && profitReport.top_products_by_profit.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #e9eef9' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{isNl ? 'Top 10 producten op winst' : 'Top 10 products by profit'}</span>
                <span style={{ marginLeft: 8, fontSize: 11.5, color: '#7e88a0' }}>{isNl ? '(andere ranking dan op omzet)' : '(different ranking than by revenue)'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                    {[
                      { key: null,      label: '#' },
                      { key: 'product', label: isNl ? 'Product' : 'Product' },
                      { key: 'qty',     label: isNl ? 'Aantal' : 'Qty' },
                      { key: 'revenue', label: isNl ? 'Omzet' : 'Revenue' },
                      { key: 'profit',  label: isNl ? 'Winst' : 'Profit' },
                      { key: 'margin',  label: isNl ? 'Marge' : 'Margin' },
                    ].map((h) => (
                      <th key={h.label} onClick={h.key ? () => profitTopSort.toggle(h.key!) : undefined}
                        style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                        {h.label}
                        {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: profitTopSort.sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{profitTopSort.indicator(h.key)}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitTopSort.sorted.map((p, i) => (
                    <tr key={i} style={{ borderBottom: i < profitTopSort.sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 700, color: '#7e88a0', width: 32 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</td>
                      <td style={{ padding: '12px 20px', fontWeight: 600, color: '#16203a' }}>{p.name}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{parseFloat(p.qty).toFixed(0)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums' }}>{formatSRD(p.revenue_srd)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#16a34a' }}>{formatSRD(p.profit_srd)}</td>
                      <td style={{ padding: '12px 20px', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#16a34a' }}>{p.margin_pct ? `${p.margin_pct}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Loss-makers — sales sold below cost (over-discount, mispricing) */}
          {!pLoading && profitReport && profitReport.loss_makers.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #fecaca', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#991b1b' }}>⚠️ {isNl ? 'Verlies-verkopen' : 'Loss-making sales'}</span>
                <span style={{ marginLeft: 8, fontSize: 11.5, color: '#7e88a0' }}>{isNl ? '(verkocht onder inkoopprijs)' : '(sold below cost)'}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafbff', borderBottom: '1px solid #e9eef9' }}>
                    {[isNl ? 'Tijd' : 'Time', isNl ? 'Bon' : 'Sale #', isNl ? 'Vestiging' : 'Store', isNl ? 'Omzet' : 'Revenue', isNl ? 'Verlies' : 'Loss'].map((h) => (
                      <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profitReport.loss_makers.map((s) => (
                    <tr key={s.sale_id} style={{ borderBottom: '1px solid #f1f4fb' }}>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: '#6b7280' }}>{format(new Date(s.occurred_at), 'd MMM HH:mm')}</td>
                      <td style={{ padding: '10px 20px', fontFamily: 'monospace', fontSize: 12, color: '#1a234f' }}>{s.sale_number}</td>
                      <td style={{ padding: '10px 20px' }}>{s.store_name}</td>
                      <td style={{ padding: '10px 20px', fontVariantNumeric: 'tabular-nums' }}>{formatSRD(s.revenue_srd)}</td>
                      <td style={{ padding: '10px 20px', fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#dc2626' }}>{formatSRD(s.profit_srd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!pLoading && profitReport && profitReport.transactions === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '40px 20px', textAlign: 'center', color: '#7e88a0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
              {isNl ? 'Geen verkopen in deze periode.' : 'No sales in this period.'}
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin-r { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
