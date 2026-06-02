import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { getStoreDetail, type StoreOverview } from '@/api/dashboard'
import { useOrgChannel } from '@/hooks/useEcho'
import { formatSRD } from '@/utils/currency'
import { useDashboardAuthStore } from '@/store/authStore'

/**
 * Store detail screen — the page you land on when you click a store
 * card from the org dashboard.
 *
 * What it shows (top to bottom):
 *   - HERO: store name + status pill, address, manager, BTW number,
 *           register count, last-seen timestamp
 *   - KPI strip: 6 tiles (revenue, txns, avg basket, BTW, registers
 *                open right now, low-stock count) with delta arrows
 *                vs yesterday where applicable
 *   - Alert strip: pending bank-transfer confirmations + low stock
 *                  warnings — only shown when count > 0
 *   - Chart row: hourly sales today (bars) + last-7-days revenue (line)
 *   - Top 5 products today + Active register sessions (two columns)
 *   - Recent sales table (last 10)
 *   - Sync + Z-Report status footer
 *
 * Reverb live updates: SaleCompleted → bump today's KPIs + prepend
 * to recent sales; StoreStatusChanged → flip online pill.
 */
export default function StoreDetailScreen({ storeId }: { storeId: string }) {
  const { i18n } = useTranslation()
  const qc = useQueryClient()
  const user = useDashboardAuthStore((s) => s.user)
  const isNl = i18n.language === 'nl'

  const { data, isLoading } = useQuery({
    queryKey: ['store-detail', storeId],
    queryFn: () => getStoreDetail(storeId),
    refetchInterval: 60_000,
  })

  // Real-time: SaleCompleted bumps the KPIs without a refetch.
  useOrgChannel(user?.organisation_id ?? null, {
    onSaleCompleted: (payload) => {
      const p = payload as { store_id: string; total_srd: string }
      if (p.store_id !== storeId) return
      qc.setQueryData(['store-detail', storeId], (old: StoreOverview | undefined) => {
        if (!old) return old
        return {
          ...old,
          today_revenue_srd: (parseFloat(old.today_revenue_srd) + parseFloat(p.total_srd)).toFixed(2),
          today_transaction_count: old.today_transaction_count + 1,
        }
      })
    },
    onStoreStatusChanged: (payload) => {
      const p = payload as { store_id: string; is_online: boolean }
      if (p.store_id !== storeId) return
      qc.setQueryData(['store-detail', storeId], (old: StoreOverview | undefined) =>
        old ? { ...old, is_online: p.is_online } : old
      )
    },
  })

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <div style={{ width: 24, height: 24, border: '2.5px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!data) return null

  const locale = isNl ? 'nl-SR' : 'en-US'
  const fmtTime = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'
  const fmtRelHour = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—'

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>

      {/* ══ HERO ═════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8f7ff 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 20,
        border: '1px solid #eeeef8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 14,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff', flexShrink: 0,
            boxShadow: '0 8px 24px rgba(124,58,237,0.25)',
          }}>
            {data.store_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1c1c2e', margin: 0 }}>{data.store_name}</h2>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: data.is_online ? '#dcfce7' : '#f3f4f6',
                color:      data.is_online ? '#15803d' : '#6b7280',
                border: `1px solid ${data.is_online ? '#bbf7d0' : '#e5e7eb'}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: data.is_online ? '#22c55e' : '#9ca3af' }} />
                {data.is_online ? 'Online' : 'Offline'}
              </span>
              {!data.is_online && data.last_seen_at && (
                <span style={{ fontSize: 11.5, color: '#9090a0' }}>
                  {isNl ? 'Laatst gezien' : 'Last seen'}: {fmtTime(data.last_seen_at)}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13.5, color: '#6b7280', marginTop: 4 }}>
              {data.organisation_name} · {data.city || (isNl ? 'Stad onbekend' : 'City unknown')}
              {data.address && ` · ${data.address}`}
            </p>
            <div style={{ display: 'flex', gap: 24, marginTop: 14, fontSize: 12.5, color: '#4b5563', flexWrap: 'wrap' }}>
              {data.manager_name && (
                <span><strong style={{ color: '#6b7280' }}>{isNl ? 'Manager' : 'Manager'}:</strong> {data.manager_name}</span>
              )}
              {data.btw_number && (
                <span><strong style={{ color: '#6b7280' }}>BTW:</strong> <code style={{ fontFamily: 'monospace', fontSize: 12 }}>{data.btw_number}</code></span>
              )}
              {data.register_count != null && (
                <span><strong style={{ color: '#6b7280' }}>{isNl ? 'Kassa\'s' : 'Registers'}:</strong> {data.register_count}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ALERT STRIP (only when there are active issues) ═════════════════ */}
      {((data.pending_payments_count ?? 0) > 0 || (data.low_stock_count ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {(data.pending_payments_count ?? 0) > 0 && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12,
              padding: '12px 18px', fontSize: 13, color: '#92400e', flex: '1 1 280px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>🏦</span>
              <span>
                <strong>{data.pending_payments_count}</strong>{' '}
                {isNl ? 'openstaande overschrijvingen' : 'pending transfers'}
                {' — '}
                <strong>{formatSRD(data.pending_payments_total ?? '0')}</strong>
              </span>
            </div>
          )}
          {(data.low_stock_count ?? 0) > 0 && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 12,
              padding: '12px 18px', fontSize: 13, color: '#991b1b', flex: '1 1 280px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>📦</span>
              <span>
                <strong>{data.low_stock_count}</strong>{' '}
                {isNl ? 'producten onder voorraaddrempel' : 'products below stock threshold'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ══ KPI STRIP (6 tiles with deltas) ═════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <KpiTile
          label={isNl ? 'Omzet vandaag' : "Today's revenue"}
          value={formatSRD(data.today_revenue_srd)}
          delta={data.delta_revenue_pct}
          accent="#7c3aed"
        />
        <KpiTile
          label={isNl ? 'Transacties' : 'Transactions'}
          value={data.today_transaction_count.toString()}
          delta={data.delta_transactions_pct}
          accent="#4f46e5"
        />
        <KpiTile
          label={isNl ? 'Gem. bon' : 'Avg. basket'}
          value={formatSRD(data.today_avg_basket_srd)}
          accent="#0891b2"
        />
        <KpiTile
          label="BTW"
          value={formatSRD(data.today_btw_srd)}
          accent="#0d9488"
        />
        <KpiTile
          label={isNl ? 'Kassa\'s open nu' : 'Registers open now'}
          value={(data.active_sessions?.length ?? 0).toString()}
          accent="#16a34a"
        />
        <KpiTile
          label={isNl ? 'Lage voorraad' : 'Low stock'}
          value={(data.low_stock_count ?? 0).toString()}
          accent={(data.low_stock_count ?? 0) > 0 ? '#dc2626' : '#9ca3af'}
        />
      </div>

      {/* ══ CHART ROW: hourly today + 7-day trend ═══════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title={isNl ? 'Verkopen per uur (vandaag)' : 'Sales by hour (today)'}>
          {(data.hourly_sales_today?.length ?? 0) === 0
            ? <EmptyPanel hint={isNl ? 'Nog geen verkopen vandaag.' : 'No sales today yet.'} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.hourly_sales_today} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" vertical={false} />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} fontSize={11} stroke="#9090a0" />
                  <YAxis fontSize={11} stroke="#9090a0" />
                  <Tooltip
                    formatter={(v: number | string, key) => key === 'revenue' ? formatSRD(String(v)) : v}
                    labelFormatter={(h) => `${h}:00`}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name={isNl ? 'Verkopen' : 'Sales'} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </Card>
        <Card title={isNl ? 'Omzet — laatste 7 dagen' : 'Revenue — last 7 days'}>
          {(data.daily_sales_last_7?.length ?? 0) === 0
            ? <EmptyPanel hint={isNl ? 'Geen data.' : 'No data.'} />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.daily_sales_last_7} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f8" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' })}
                    fontSize={11} stroke="#9090a0" />
                  <YAxis fontSize={11} stroke="#9090a0" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toString()} />
                  <Tooltip
                    formatter={(v: number | string) => formatSRD(String(v))}
                    labelFormatter={(d) => new Date(d).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' })}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5' }} />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </Card>
      </div>

      {/* ══ TOP PRODUCTS + ACTIVE SESSIONS ══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title={isNl ? 'Top 5 producten vandaag' : 'Top 5 products today'}>
          {(data.top_products_today?.length ?? 0) === 0
            ? <EmptyPanel hint={isNl ? 'Nog geen verkopen vandaag.' : 'No sales today yet.'} />
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {data.top_products_today?.map((p, i) => (
                    <tr key={i} style={{ borderBottom: i < (data.top_products_today!.length - 1) ? '1px solid #f3f3f8' : 'none' }}>
                      <td style={{ padding: '10px 4px', fontSize: 13.5, color: '#1c1c2e', fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 20, fontWeight: 700, color: '#9090a0', fontSize: 12 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                        </span>
                        {p.name}
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: 12, color: '#6b7280', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {parseFloat(p.qty).toFixed(0)} {isNl ? 'st.' : 'units'}
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: 13, fontWeight: 700, color: '#7c3aed', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatSRD(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </Card>
        <Card title={isNl ? 'Kassiers in dienst' : 'Cashiers on shift'} subtitle={(data.active_sessions?.length ?? 0) === 0 ? (isNl ? 'Niemand op dit moment.' : 'Nobody on shift right now.') : undefined}>
          {(data.active_sessions?.length ?? 0) === 0
            ? <EmptyPanel hint="" icon="💤" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.active_sessions?.map((s) => (
                  <div key={s.session_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    background: '#f9fafb', borderRadius: 10, border: '1px solid #f3f3f8',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: '#dcfce7', color: '#15803d',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, flexShrink: 0,
                    }}>
                      {(s.cashier_name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1c1c2e' }}>{s.cashier_name ?? '—'}</div>
                      <div style={{ fontSize: 11.5, color: '#9090a0' }}>
                        {s.register_name} · {isNl ? 'sinds' : 'since'} {fmtRelHour(s.opened_at)} · {isNl ? 'beginsaldo' : 'opening float'} {formatSRD(s.opening_float_srd)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </Card>
      </div>

      {/* ══ RECENT SALES TABLE ══════════════════════════════════════════════ */}
      <Card title={isNl ? 'Recente verkopen' : 'Recent sales'}>
        {(data.recent_sales?.length ?? 0) === 0
          ? <EmptyPanel hint={isNl ? 'Nog geen verkopen.' : 'No sales yet.'} />
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f3f8' }}>
                  {[isNl ? 'Tijd' : 'Time', isNl ? 'Bon' : 'Sale #', isNl ? 'Kassier' : 'Cashier', isNl ? 'Betaling' : 'Payment', isNl ? 'Totaal' : 'Total'].map((h) => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recent_sales?.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < (data.recent_sales!.length - 1) ? '1px solid #f3f3f8' : 'none' }}>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtRelHour(s.occurred_at)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#4338ca' }}>{s.sale_number}</td>
                    <td style={{ padding: '10px 12px', color: '#1c1c2e' }}>{s.cashier_name ?? '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>
                        {s.payment_method}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{formatSRD(s.total_srd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </Card>

      {/* ══ SYNC + Z-REPORT FOOTER ══════════════════════════════════════════ */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: '#fafbff', borderRadius: 12, border: '1px solid #eeeef8', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#6b7280' }}>
        <span><strong style={{ color: '#4b5563' }}>Sync:</strong>
          <span style={{
            marginLeft: 6, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: data.sync_status === 'synced' ? '#dcfce7' : data.sync_status === 'pending' ? '#fef3c7' : data.sync_status === 'failed' ? '#fee2e2' : '#f3f4f6',
            color:      data.sync_status === 'synced' ? '#15803d' : data.sync_status === 'pending' ? '#92400e' : data.sync_status === 'failed' ? '#991b1b' : '#6b7280',
          }}>{data.sync_status}</span>
        </span>
        {data.last_sync_at && <span><strong style={{ color: '#4b5563' }}>{isNl ? 'Laatste sync' : 'Last sync'}:</strong> {fmtTime(data.last_sync_at)}</span>}
        {data.last_z_report_date && <span><strong style={{ color: '#4b5563' }}>{isNl ? 'Laatste Z-rapport' : 'Last Z-report'}:</strong> {data.last_z_report_date}</span>}
      </div>
    </div>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function KpiTile({ label, value, delta, accent }: { label: string; value: string; delta?: string | null; accent: string }) {
  const deltaNum = delta != null ? parseFloat(delta) : null
  const deltaUp  = deltaNum != null && deltaNum >= 0
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #eeeef8', boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: accent }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#1c1c2e' }}>{value}</div>
        {delta != null && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: deltaUp ? '#15803d' : '#dc2626',
          }}>
            {deltaUp ? '▲' : '▼'} {delta.replace('+', '')}%
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #eeeef8', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 11.5, color: '#9090a0', marginTop: 3 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function EmptyPanel({ hint, icon = '📊' }: { hint: string; icon?: string }) {
  return (
    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#9090a0' }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      {hint && <div style={{ fontSize: 12.5 }}>{hint}</div>}
    </div>
  )
}
