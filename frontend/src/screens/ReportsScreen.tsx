import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getDailyReport, getMonthlyReport, getCustomReport, getXReport, getReportExportUrl } from '@/api/reports'
import type { ReportSummary } from '@/api/reports'

interface ReportsScreenProps {
  storeId: string
}

type ReportTab = 'daily' | 'monthly' | 'custom' | 'x-report'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function thisMonth() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function ReportsScreen({ storeId }: ReportsScreenProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<ReportTab>('daily')
  const [date, setDate] = useState(today())
  const [month, setMonth] = useState(thisMonth())
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(today())

  const dailyQ = useQuery({
    queryKey: ['report-daily', storeId, date],
    queryFn: () => getDailyReport(storeId, date),
    enabled: tab === 'daily',
  })

  const monthlyQ = useQuery({
    queryKey: ['report-monthly', storeId, month.year, month.month],
    queryFn: () => getMonthlyReport(storeId, month.year, month.month),
    enabled: tab === 'monthly',
  })

  const customQ = useQuery({
    queryKey: ['report-custom', storeId, dateFrom, dateTo],
    queryFn: () => getCustomReport(storeId, dateFrom, dateTo),
    enabled: tab === 'custom',
  })

  const xQ = useQuery({
    queryKey: ['report-x', storeId],
    queryFn: () => getXReport(storeId),
    enabled: tab === 'x-report',
    refetchOnMount: true,
  })

  const summary: ReportSummary | undefined = {
    daily: dailyQ.data,
    monthly: monthlyQ.data,
    custom: customQ.data,
    'x-report': xQ.data,
  }[tab]

  const isLoading = { daily: dailyQ.isLoading, monthly: monthlyQ.isLoading, custom: customQ.isLoading, 'x-report': xQ.isLoading }[tab]
  const isFetching = { daily: dailyQ.isFetching, monthly: monthlyQ.isFetching, custom: customQ.isFetching, 'x-report': xQ.isFetching }[tab]
  const refetch = { daily: dailyQ.refetch, monthly: monthlyQ.refetch, custom: customQ.refetch, 'x-report': xQ.refetch }[tab]

  const tabs: { key: ReportTab; label: string }[] = [
    { key: 'daily', label: t('reports.daily') },
    { key: 'monthly', label: t('reports.monthly') },
    { key: 'custom', label: t('reports.custom') },
    { key: 'x-report', label: t('reports.xReport') },
  ]

  function handleExport() {
    const params: Record<string, string> = {}
    if (tab === 'daily') params.date = date
    if (tab === 'monthly') { params.year = String(month.year); params.month = String(month.month) }
    if (tab === 'custom') { params.date_from = dateFrom; params.date_to = dateTo }
    const url = getReportExportUrl(storeId, tab, params)
    window.open(url, '_blank')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)', padding: '0 24px', flexShrink: 0, background: 'var(--bg-surface)' }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: '12px 18px', background: 'none', border: 'none',
              borderBottom: tab === tb.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === tb.key ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', fontWeight: tab === tb.key ? 700 : 400,
              fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {/* Date controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {tab === 'daily' && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={inputSt} />
          )}
          {tab === 'monthly' && (
            <input type="month" value={`${month.year}-${String(month.month).padStart(2,'0')}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-')
                setMonth({ year: parseInt(y), month: parseInt(m) })
              }}
              style={inputSt} />
          )}
          {tab === 'custom' && (
            <>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{t('reports.dateFrom')}</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputSt} />
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{t('reports.dateTo')}</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputSt} />
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={t('app.refresh')}
              style={{
                ...exportBtnSt,
                marginLeft: 0,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                opacity: isFetching ? 0.5 : 1,
              }}
            >
              <RefreshIcon spinning={isFetching} />
              {t('app.refresh')}
            </button>
            {tab !== 'x-report' && (
              <button onClick={handleExport} style={{ ...exportBtnSt, marginLeft: 0 }}>{t('reports.exportPdf')}</button>
            )}
          </div>
        </div>

        {/* Report body */}
        {isLoading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: 60 }}>{t('app.loading')}</div>
        ) : summary ? (
          <ReportView summary={summary} storeId={storeId} />
        ) : null}
      </div>
    </div>
  )
}

function ReportView({ summary }: { summary: ReportSummary; storeId: string }) {
  const { t } = useTranslation()

  const cards = [
    { label: t('reports.summary.totalSales'), value: `SRD ${parseFloat(summary.total_sales_srd).toFixed(2)}`, color: 'var(--color-total)' },
    { label: t('reports.summary.transactionCount'), value: String(summary.transaction_count), color: 'var(--text-primary)' },
    { label: t('reports.summary.avgBasket'), value: `SRD ${parseFloat(summary.avg_basket_srd).toFixed(2)}`, color: 'var(--text-primary)' },
    { label: t('reports.summary.totalBtw'), value: `SRD ${parseFloat(summary.total_btw_srd).toFixed(2)}`, color: 'var(--color-btw)' },
    { label: t('reports.summary.cashTotal'), value: `SRD ${parseFloat(summary.cash_total_srd).toFixed(2)}`, color: 'var(--text-primary)' },
    { label: t('reports.summary.cardTotal'), value: `SRD ${parseFloat(summary.card_total_srd).toFixed(2)}`, color: 'var(--text-primary)' },
    // Phase 2/3 methods — only shown when used in the period so the familiar
    // six-card layout stays uncluttered for cash/card-only stores.
    ...(parseFloat(summary.bank_transfer_total_srd ?? '0') !== 0
      ? [{ label: t('reports.summary.bankTransferTotal'), value: `SRD ${parseFloat(summary.bank_transfer_total_srd!).toFixed(2)}`, color: 'var(--text-primary)' }] : []),
    ...(parseFloat(summary.mobile_transfer_total_srd ?? '0') !== 0
      ? [{ label: t('reports.summary.mobileTransferTotal'), value: `SRD ${parseFloat(summary.mobile_transfer_total_srd!).toFixed(2)}`, color: 'var(--text-primary)' }] : []),
    ...(parseFloat(summary.foreign_cash_total_srd ?? '0') !== 0
      ? [{ label: t('reports.summary.foreignCashTotal'), value: `SRD ${parseFloat(summary.foreign_cash_total_srd!).toFixed(2)}`, color: 'var(--text-primary)' }] : []),
    ...(parseFloat(summary.qr_payment_total_srd ?? '0') !== 0
      ? [{ label: t('reports.summary.qrTotal'), value: `SRD ${parseFloat(summary.qr_payment_total_srd!).toFixed(2)}`, color: 'var(--text-primary)' }] : []),
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {summary.type === 'X-Report' && (
        <div style={{
          padding: '10px 16px', background: 'rgba(245,166,35,0.12)',
          border: '1px solid var(--color-warning)', borderRadius: 'var(--border-radius)',
          fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)',
        }}>
          {t('reports.xReport')} — {new Date().toLocaleTimeString()}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 6 }}>{c.label}</div>
            <div className="currency-srd" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* BTW breakdown */}
      {summary.btw_breakdown?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
            {t('btw.breakdown')}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {[t('btw.label'), 'Basis (SRD)', t('btw.label') + ' (SRD)'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.btw_breakdown.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                    {row.exempt ? t('btw.exempt') : `${row.rate}%`}
                  </td>
                  <td className="currency-srd" style={{ padding: '8px 12px' }}>SRD {parseFloat(row.base_srd).toFixed(2)}</td>
                  <td className="currency-srd" style={{ padding: '8px 12px', color: 'var(--color-btw)' }}>SRD {parseFloat(row.btw_srd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top products */}
      {summary.top_products?.length > 0 && (
        <div>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 10, color: 'var(--text-primary)' }}>
            {t('reports.topProducts')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {summary.top_products.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16 }}>#{i + 1}</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{p.product_name}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{parseFloat(p.quantity).toFixed(0)}×</span>
                  <span className="currency-srd" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>SRD {parseFloat(p.revenue_srd).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  height: 36,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-sm)',
  padding: '0 10px',
  outline: 'none',
}

const exportBtnSt: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 600,
  marginLeft: 'auto',
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, animation: spinning ? 'spin-r 0.8s linear infinite' : 'none' }}
    >
      <style>{`@keyframes spin-r { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
