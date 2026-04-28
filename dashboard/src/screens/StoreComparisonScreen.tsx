import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getPlatformSummary, type StoreOverview } from '@/api/dashboard'

function Bar({ value, max, color = '#7c3aed' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 8, borderRadius: 4, background: '#f0f0f8', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  )
}

export default function StoreComparisonScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [metric, setMetric] = useState<'revenue' | 'transactions' | 'avg_basket'>('revenue')
  const [sortAsc, setSortAsc] = useState(false)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getPlatformSummary,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
  })

  const allStores: StoreOverview[] = summary?.orgs.flatMap((o) => o.stores) ?? []

  function metricValue(s: StoreOverview): number {
    if (metric === 'revenue')       return parseFloat(s.today_revenue_srd)
    if (metric === 'transactions')  return s.today_transaction_count
    return parseFloat(s.today_avg_basket_srd)
  }

  function metricLabel(v: number) {
    if (metric === 'transactions') return String(v)
    return `SRD ${v.toFixed(2)}`
  }

  const maxValue = Math.max(...allStores.map(metricValue), 0.01)

  const sorted = [...allStores].sort((a, b) => {
    const diff = metricValue(a) - metricValue(b)
    return sortAsc ? diff : -diff
  })

  const metricOptions = [
    { key: 'revenue',      nl: 'Omzet vandaag',         en: 'Today\'s revenue' },
    { key: 'transactions', nl: 'Transacties vandaag',   en: 'Today\'s transactions' },
    { key: 'avg_basket',   nl: 'Gemiddeld bonbedrag',   en: 'Average basket' },
  ] as const

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Vestigingsvergelijking' : 'Store Comparison'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? `${allStores.length} vestigingen vergeleken` : `${allStores.length} stores compared`}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', background: '#f5f5f8', borderRadius: 10, padding: 3, gap: 2 }}>
          {metricOptions.map(m => (
            <button key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: metric === m.key ? '#fff' : 'transparent',
                color: metric === m.key ? '#1c1c2e' : '#6b7280',
                boxShadow: metric === m.key ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}
            >
              {isNl ? m.nl : m.en}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortAsc(v => !v)}
          style={{ marginLeft: 'auto', height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}
        >
          {sortAsc ? '↑' : '↓'} {isNl ? 'Sorteren' : 'Sort'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : allStores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏪</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>{isNl ? 'Geen vestigingen gevonden' : 'No stores found'}</p>
        </div>
      ) : (
        <>
          {/* Bar chart view */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', padding: '24px 28px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sorted.map((s, i) => {
                const v = metricValue(s)
                const rank = i + 1
                const isTop = rank === 1
                return (
                  <div key={s.store_id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: isTop ? 'linear-gradient(135deg,#f59e0b,#d97706)' : '#f0f0f8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        color: isTop ? '#fff' : '#6b7280',
                      }}>
                        {isTop ? '🥇' : rank}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e' }}>{s.store_name}</span>
                            <span style={{ fontSize: 11, color: '#9090a0' }}>{s.city}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                              background: s.is_online ? '#f0fdf4' : '#f9fafb',
                              color: s.is_online ? '#15803d' : '#9090a0',
                              border: `1px solid ${s.is_online ? '#bbf7d0' : '#e5e7eb'}`,
                            }}>
                              {s.is_online ? (isNl ? 'Online' : 'Online') : (isNl ? 'Offline' : 'Offline')}
                            </span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: isTop ? '#f59e0b' : '#7c3aed' }}>
                            {metricLabel(v)}
                          </span>
                        </div>
                        <Bar value={v} max={maxValue} color={isTop ? '#f59e0b' : '#7c3aed'} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Side-by-side detail table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f3f8', fontWeight: 800, fontSize: 14, color: '#1c1c2e' }}>
              {isNl ? 'Gedetailleerd overzicht' : 'Detailed comparison'}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f7ff', borderBottom: '1px solid #eeeef8' }}>
                    {[
                      isNl ? 'Vestiging' : 'Store',
                      isNl ? 'Organisatie' : 'Organisation',
                      isNl ? 'Omzet' : 'Revenue',
                      isNl ? 'Trans.' : 'Trans.',
                      isNl ? 'Gem. bon' : 'Avg basket',
                      'BTW',
                      isNl ? 'Topprod.' : 'Top product',
                      isNl ? 'Status' : 'Status',
                    ].map((h, i) => (
                      <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <tr key={s.store_id}
                      style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f3f3f8' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1c1c2e' }}>{s.store_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9090a0' }}>{s.city}</p>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{s.organisation_name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                        SRD {parseFloat(s.today_revenue_srd).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                        {s.today_transaction_count}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                        SRD {parseFloat(s.today_avg_basket_srd).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                        SRD {parseFloat(s.today_btw_srd).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                        {s.top_product_name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 12,
                          background: s.is_online ? '#f0fdf4' : '#f9fafb',
                          color: s.is_online ? '#15803d' : '#6b7280',
                          border: `1px solid ${s.is_online ? '#bbf7d0' : '#e5e7eb'}`,
                        }}>
                          {s.is_online ? '● Online' : '○ Offline'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
