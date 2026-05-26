import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getInspectorDashboard } from '@/api/btwSubmissions'
import { useDashboardAuthStore } from '@/store/authStore'

/**
 * Task #82 — proper dashboard landing screen for tax_inspector.
 *
 * Network-wide KPIs across all organisations:
 *   - BTW collected this month vs last month (with % delta)
 *   - Pending review count (with click-through hint)
 *   - Open disputes count
 *   - 30-day BTW trend (sparkline)
 *   - Top 10 orgs by BTW this month
 *   - Late filings alert — orgs that haven't filed in >7 days
 *
 * Also rendered for OA (scope=own_org) so they get a useful "my own BTW
 * health" view of the same data shape. The late_filings list is empty for
 * OA — that's a cross-org-only signal.
 */

function fmtSrd(s: string): string {
  return Number(s).toLocaleString('nl-SR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pctDelta(curr: string, prev: string): { value: number; label: string; color: string } | null {
  const c = Number(curr)
  const p = Number(prev)
  if (p === 0) return null
  const pct = ((c - p) / p) * 100
  const sign = pct >= 0 ? '+' : ''
  return {
    value: pct,
    label: `${sign}${pct.toFixed(1)}%`,
    color: pct >= 0 ? '#16a34a' : '#dc2626',
  }
}

const TILE: React.CSSProperties = {
  background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '18px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
}

interface Props {
  onNavigateToSubmissions?: (filter?: { status?: 'filed' | 'disputed'; organisation_id?: string }) => void
}

export default function TaxInspectorDashboard({ onNavigateToSubmissions }: Props) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user = useDashboardAuthStore((s) => s.user)
  const isInspector = user?.role === 'tax_inspector'

  const { data, isLoading } = useQuery({
    queryKey: ['btw-inspector-dashboard'],
    queryFn:  getInspectorDashboard,
    refetchInterval: 60_000,
  })

  if (isLoading || !data) {
    return <div style={{ padding: 40, color: '#9090a0', textAlign: 'center' }}>{isNl ? 'Laden…' : 'Loading…'}</div>
  }

  const delta = pctDelta(data.totals.btw_this_month_srd, data.totals.btw_last_month_srd)
  const peakBtw = Math.max(1, ...data.trend_30d.map((p) => Number(p.btw_srd)))

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1280 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isInspector
            ? (isNl ? 'Belastingdienst Dashboard' : 'Belastingdienst Dashboard')
            : (isNl ? 'BTW Dashboard' : 'BTW Dashboard')}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {data.scope === 'platform'
            ? (isNl ? 'Netwerk-brede BTW-cijfers en aangiftestatus over alle organisaties.' : 'Network-wide BTW figures and filing status across all organisations.')
            : (isNl ? 'BTW-cijfers en aangiftestatus voor uw organisatie.' : 'BTW figures and filing status for your organisation.')}
        </p>
      </div>

      {/* Headline KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={TILE}>
          <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
            {isNl ? 'BTW deze maand' : 'BTW this month'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#1c1c2e' }}>SRD {fmtSrd(data.totals.btw_this_month_srd)}</div>
          {delta && (
            <div style={{ fontSize: 12, marginTop: 6, color: delta.color, fontWeight: 600 }}>
              {delta.label} <span style={{ color: '#9090a0', fontWeight: 400 }}>{isNl ? 'vs vorige maand' : 'vs last month'}</span>
            </div>
          )}
          {!delta && (
            <div style={{ fontSize: 11, color: '#9090a0', marginTop: 6 }}>
              {isNl ? 'Vorige maand:' : 'Last month:'} SRD {fmtSrd(data.totals.btw_last_month_srd)}
            </div>
          )}
        </div>

        <div style={{ ...TILE, cursor: onNavigateToSubmissions ? 'pointer' : 'default' }}
          onClick={() => onNavigateToSubmissions?.({ status: 'filed' })}>
          <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
            {isNl ? 'Wacht op review' : 'Pending review'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: data.totals.pending_review > 0 ? '#a16207' : '#9ca3af' }}>
            {data.totals.pending_review}
          </div>
          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 6 }}>
            {isInspector
              ? (isNl ? 'Aangiftes die u kunt accepteren of betwisten' : 'Submissions for you to accept or dispute')
              : (isNl ? 'Aangiftes in afwachting van inspecteur' : 'Submissions awaiting inspector')}
          </div>
        </div>

        <div style={{ ...TILE, cursor: onNavigateToSubmissions ? 'pointer' : 'default' }}
          onClick={() => onNavigateToSubmissions?.({ status: 'disputed' })}>
          <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
            {isNl ? 'Open disputen' : 'Open disputes'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: data.totals.disputed_open > 0 ? '#dc2626' : '#9ca3af' }}>
            {data.totals.disputed_open}
          </div>
          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 6 }}>
            {isInspector
              ? (isNl ? 'Wacht op correctie door belastingplichtige' : 'Awaiting taxpayer correction')
              : (isNl ? 'Uw aangiftes met disputen' : 'Your disputed submissions')}
          </div>
        </div>

        <div style={TILE}>
          <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
            {isNl ? 'Geaccepteerd deze maand' : 'Accepted this month'}
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a' }}>
            {data.totals.this_month_by_status.accepted ?? 0}
          </div>
          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 6 }}>
            {isNl ? 'Aangiftes formeel bevestigd' : 'Submissions formally acknowledged'}
          </div>
        </div>
      </div>

      {/* 30-day trend chart (CSS-only sparkline — no chart lib required) */}
      <div style={{ ...TILE, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 14 }}>
          {isNl ? 'BTW-trend (30 dagen)' : 'BTW trend (30 days)'}
        </div>
        {data.trend_30d.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9090a0', textAlign: 'center', margin: '24px 0' }}>
            {isNl ? 'Geen gegevens in de afgelopen 30 dagen.' : 'No data in the last 30 days.'}
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, paddingBottom: 4 }}>
              {data.trend_30d.map((p) => {
                const h = (Number(p.btw_srd) / peakBtw) * 100
                return (
                  <div key={p.date}
                    title={`${p.date}: SRD ${fmtSrd(p.btw_srd)}`}
                    style={{
                      flex: 1, height: `${Math.max(2, h)}%`,
                      background: 'linear-gradient(180deg,#7c3aed,#4f46e5)',
                      borderRadius: '3px 3px 0 0', minWidth: 4,
                    }} />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9090a0', marginTop: 6 }}>
              <span>{data.trend_30d[0]?.date}</span>
              <span>{data.trend_30d[data.trend_30d.length - 1]?.date}</span>
            </div>
          </>
        )}
      </div>

      {/* Top orgs + Late filings side by side (late_filings empty for OA) */}
      <div style={{ display: 'grid', gridTemplateColumns: data.late_filings.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>
        <div style={TILE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            {data.scope === 'platform'
              ? (isNl ? 'Top organisaties (BTW deze maand)' : 'Top organisations (BTW this month)')
              : (isNl ? 'Uw aangiftes deze maand' : 'Your submissions this month')}
          </div>
          {data.top_orgs_month.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9090a0', margin: 0 }}>{isNl ? 'Nog geen aangiftes deze maand.' : 'No submissions yet this month.'}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.top_orgs_month.map((o, idx) => (
                <li key={o.organisation_id}
                  onClick={() => onNavigateToSubmissions?.({ organisation_id: o.organisation_id })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: idx < data.top_orgs_month.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: onNavigateToSubmissions ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => { if (onNavigateToSubmissions) e.currentTarget.style.background = 'rgba(124,58,237,.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c2e' }}>{o.organisation_name}</div>
                    <div style={{ fontSize: 11, color: '#9090a0' }}>{o.filings} {isNl ? 'aangifte(s)' : 'filing(s)'}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>SRD {fmtSrd(o.total_btw_srd)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.late_filings.length > 0 && (
          <div style={TILE}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
              ⚠️ {isNl ? 'Late aangiftes (>7 dagen)' : 'Late filings (>7 days)'}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.late_filings.map((o, idx) => (
                <li key={o.organisation_id}
                  onClick={() => onNavigateToSubmissions?.({ organisation_id: o.organisation_id })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: idx < data.late_filings.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: onNavigateToSubmissions ? 'pointer' : 'default',
                  }}
                  onMouseEnter={(e) => { if (onNavigateToSubmissions) e.currentTarget.style.background = 'rgba(220,38,38,.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1c1c2e' }}>{o.organisation_name}</div>
                    <div style={{ fontSize: 11, color: '#9090a0' }}>
                      {o.last_submission_at
                        ? `${isNl ? 'Laatste:' : 'Last:'} ${new Date(o.last_submission_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}`
                        : (isNl ? 'Nooit ingediend' : 'Never filed')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                    {o.days_since ? `${o.days_since}d` : '—'}
                  </div>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: '#9090a0', marginTop: 10, lineHeight: 1.4 }}>
              {isNl
                ? 'Organisaties die >7 dagen geen aangifte hebben ingediend. Mogelijk wachten op gegevens, in vakantie, of vergeten.'
                : 'Organisations that haven\'t filed in >7 days. May be awaiting data, on holiday, or forgotten.'}
            </p>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#9090a0', textAlign: 'right', marginTop: 14 }}>
        {isNl ? 'Bijgewerkt:' : 'Updated:'} {new Date(data.generated_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })} · {isNl ? 'auto-ververst elke 60s' : 'auto-refresh 60s'}
      </p>
    </div>
  )
}
