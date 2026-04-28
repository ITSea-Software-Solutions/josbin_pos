import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getConsolidatedReport, getConsolidatedBtwReport, exportReport } from '@/api/dashboard'
import { formatSRD } from '@/utils/currency'
import { format, subDays, startOfMonth } from 'date-fns'

type ReportTab = 'consolidated' | 'btw'

function today() { return format(new Date(), 'yyyy-MM-dd') }
function monthStart() { return format(startOfMonth(new Date()), 'yyyy-MM-dd') }

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '16px 20px' }}>
          <div style={{ height: 13, borderRadius: 6, background: '#f0f0f8', maxWidth: i === 0 ? 180 : 100 }} />
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

  const {
    data: consolidated,
    isLoading: cLoading,
    isFetching: cFetching,
    refetch: cRefetch,
  } = useQuery({
    queryKey: ['consolidated-report', dateFrom, dateTo],
    queryFn: () => getConsolidatedReport({ date_from: dateFrom, date_to: dateTo }),
    enabled: tab === 'consolidated',
  })

  const {
    data: btwReport,
    isLoading: bLoading,
    isFetching: bFetching,
    refetch: bRefetch,
  } = useQuery({
    queryKey: ['btw-report', dateFrom, dateTo],
    queryFn: () => getConsolidatedBtwReport({ date_from: dateFrom, date_to: dateTo }),
    enabled: tab === 'btw',
  })

  const isLoading  = tab === 'consolidated' ? cLoading  : bLoading
  const isFetching = tab === 'consolidated' ? cFetching : bFetching
  const refetch    = tab === 'consolidated' ? cRefetch  : bRefetch

  const [exporting, setExporting] = useState(false)

  async function handleExportPdf() {
    setExporting(true)
    try {
      await exportReport(
        tab === 'btw' ? 'btw' : 'consolidated',
        { date_from: dateFrom, date_to: dateTo, locale: i18n.language },
      )
    } finally {
      setExporting(false)
    }
  }

  const tabs = [
    { id: 'consolidated' as const, nl: 'Geconsolideerd', en: 'Consolidated' },
    { id: 'btw'          as const, nl: 'BTW-overzicht',  en: 'BTW Report'   },
  ]

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
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
                ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                : '#fff',
              color: tab === t.id ? '#fff' : '#6b7280',
              boxShadow: tab === t.id
                ? '0 2px 10px rgba(124,58,237,.35)'
                : '0 1px 4px rgba(0,0,0,.06)',
              border: tab === t.id ? 'none' : '1px solid #e9e9ef',
            }}
          >
            {isNl ? t.nl : t.en}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef',
        padding: '16px 20px', marginBottom: 24,
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}>
        {/* Date From */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Van' : 'From'}
          </label>
          <input
            type="date" value={dateFrom} max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0ed',
              fontSize: 13, color: '#1c1c2e', outline: 'none',
            }}
          />
        </div>

        {/* Date To */}
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Tot' : 'To'}
          </label>
          <input
            type="date" value={dateTo} min={dateFrom} max={today()}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0ed',
              fontSize: 13, color: '#1c1c2e', outline: 'none',
            }}
          />
        </div>

        {/* Quick range pills */}
        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          {[
            { label: isNl ? 'Vandaag'      : 'Today',      fn: () => { setDateFrom(today()); setDateTo(today()) } },
            { label: isNl ? 'Gisteren'     : 'Yesterday',  fn: () => { const d = format(subDays(new Date(), 1), 'yyyy-MM-dd'); setDateFrom(d); setDateTo(d) } },
            { label: isNl ? 'Deze maand'   : 'This month', fn: () => { setDateFrom(monthStart()); setDateTo(today()) } },
          ].map((r) => (
            <button key={r.label} onClick={r.fn} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: '#f5f5fb', color: '#6d6d80', border: '1px solid #eeeef8',
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
              background: '#f5f5fb', color: '#7c3aed',
              border: '1px solid #ddd6fe', fontSize: 12, fontWeight: 600,
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
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
              cursor: exporting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(124,58,237,.35)',
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
                { label: isNl ? 'Totale omzet'  : 'Total revenue',  value: formatSRD(consolidated.total_sales),        color: '#7c3aed' },
                { label: isNl ? 'Transacties'   : 'Transactions',   value: consolidated.transaction_count.toString(),   color: '#2563eb' },
                { label: isNl ? 'Gemiddelde bon' : 'Avg basket',     value: formatSRD(consolidated.avg_basket),          color: '#0891b2' },
                { label: 'BTW',                                       value: formatSRD(consolidated.total_btw),           color: '#059669' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
                  padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#9090a0', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Payment breakdown */}
          {!cLoading && consolidated && (
            <div style={{
              background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
              padding: '18px 24px', marginBottom: 24,
              display: 'flex', gap: 32, alignItems: 'center',
              boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 8 }}>
                {isNl ? 'Betaalmethoden' : 'Payment methods'}
              </span>
              {[
                { label: isNl ? 'Contant'    : 'Cash',     value: consolidated.payment_breakdown.cash,  color: '#16a34a' },
                { label: isNl ? 'PIN/Kaart'  : 'Card/PIN', value: consolidated.payment_breakdown.card,  color: '#2563eb' },
                { label: isNl ? 'Gemengd'    : 'Mixed',    value: consolidated.payment_breakdown.mixed, color: '#9333ea' },
              ].map((p) => (
                <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{p.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{formatSRD(p.value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Per-store table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eeeef8' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
                {isNl ? 'Per vestiging' : 'By store'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                  {[
                    isNl ? 'Vestiging' : 'Store',
                    isNl ? 'Stad' : 'City',
                    isNl ? 'Omzet' : 'Revenue',
                    'BTW',
                    isNl ? 'Transacties' : 'Transactions',
                  ].map((h) => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                  : (consolidated?.per_store ?? []).map((row, i) => (
                    <tr
                      key={row.store_id}
                      style={{ borderBottom: i < (consolidated?.per_store.length ?? 0) - 1 ? '1px solid #f3f3f8' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1c1c2e', fontSize: 14 }}>{row.store_name}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13, color: '#6b7280' }}>{row.city ?? '—'}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: '#7c3aed' }}>{formatSRD(row.total_sales)}</td>
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
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #eeeef8' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
                  {isNl ? 'Top producten' : 'Top products'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                    {['#', isNl ? 'Product' : 'Product', isNl ? 'Aantal' : 'Qty', isNl ? 'Omzet' : 'Revenue'].map((h) => (
                      <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consolidated!.top_products.map((p, i) => (
                    <tr
                      key={p.name}
                      style={{ borderBottom: i < consolidated!.top_products.length - 1 ? '1px solid #f3f3f8' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
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
                      <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1c1c2e', fontSize: 14 }}>{p.name}</td>
                      <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#6b7280', fontWeight: 600 }}>{parseFloat(p.qty).toFixed(0)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>{formatSRD(p.revenue)}</td>
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
                { label: isNl ? 'Totale bruto omzet'   : 'Total gross revenue',  value: formatSRD(btwReport.total_gross), sub: btwReport.format,           color: '#7c3aed' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
                  padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: s.color, letterSpacing: '-1px' }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#9090a0', marginTop: 6 }}>{s.sub}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eeeef8' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
                {isNl ? 'Uitgesplitst per BTW-tarief' : 'Breakdown by BTW rate'}
              </span>
              <span style={{ fontSize: 12, color: '#9090a0', marginLeft: 10 }}>
                {isNl ? 'Belastingdienst Suriname formaat' : 'Belastingdienst Suriname format'}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                  {[
                    isNl ? 'Tarief' : 'Rate',
                    isNl ? 'Vrijgesteld' : 'Exempt',
                    isNl ? 'Bruto incl. BTW' : 'Gross incl. BTW',
                    isNl ? 'Netto excl. BTW' : 'Net excl. BTW',
                    'BTW',
                    isNl ? 'Verkopen' : 'Sales',
                  ].map((h) => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : (btwReport?.breakdown ?? []).map((row, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: i < (btwReport?.breakdown.length ?? 0) - 1 ? '1px solid #f3f3f8' : 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', fontWeight: 800, fontSize: 15, color: '#1c1c2e' }}>{row.btw_rate}%</td>
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

      <style>{`@keyframes spin-r { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
