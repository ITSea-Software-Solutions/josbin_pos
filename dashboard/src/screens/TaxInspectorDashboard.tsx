import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { getInspectorDashboard } from '@/api/btwSubmissions'
import { useDashboardAuthStore } from '@/store/authStore'
import { BD, bdCard } from '@/theme/belastingdienst'
import { BelastingdienstHeader } from '@/components/shared/BelastingdienstHeader'

/**
 * Tax-inspector landing dashboard — network-wide BTW oversight.
 *
 * Official Belastingdienst styling for the inspector (scope=platform); also
 * rendered for OA (scope=own_org) as a "my own BTW health" view with a neutral
 * header. KPIs: BTW this vs last month, pending review, open disputes, accepted,
 * 30-day trend, top orgs, late filings.
 */

function fmtSrd(s: string): string {
  return Number(s).toLocaleString('nl-SR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function pctDelta(curr: string, prev: string): { label: string; up: boolean } | null {
  const c = Number(curr); const p = Number(prev)
  if (p === 0) return null
  const pct = ((c - p) / p) * 100
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 }
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
    return <div style={{ padding: 40, color: BD.muted, textAlign: 'center' }}>{isNl ? 'Laden…' : 'Loading…'}</div>
  }

  const delta = pctDelta(data.totals.btw_this_month_srd, data.totals.btw_last_month_srd)
  const peakBtw = Math.max(1, ...data.trend_30d.map((p) => Number(p.btw_srd)))
  const peakIdx = data.trend_30d.findIndex((p) => Number(p.btw_srd) === peakBtw)

  return (
    <div style={{ padding: '28px 32px', maxWidth: '100%', background: BD.paper, minHeight: '100%' }}>
      {isInspector ? (
        <BelastingdienstHeader
          overline={isNl ? 'Republiek Suriname · Belastingdienst' : 'Republic of Suriname · Tax Authority'}
          title={isNl ? 'BTW-toezicht' : 'BTW Oversight'}
          subtitle={data.scope === 'platform'
            ? (isNl ? 'Netwerk-brede BTW-cijfers en aangiftestatus over alle organisaties.' : 'Network-wide BTW figures and filing status across all organisations.')
            : (isNl ? 'BTW-cijfers en aangiftestatus voor uw organisatie.' : 'BTW figures and filing status for your organisation.')}
        />
      ) : (
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: BD.ink, letterSpacing: '-0.5px', margin: 0 }}>{isNl ? 'BTW-dashboard' : 'BTW Dashboard'}</h1>
          <p style={{ fontSize: 13.5, color: BD.muted, margin: '4px 0 0' }}>{isNl ? 'BTW-cijfers en aangiftestatus voor uw organisatie.' : 'BTW figures and filing status for your organisation.'}</p>
        </div>
      )}

      {/* Hero + secondary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Hero — BTW this month */}
        <div style={{
          background: `linear-gradient(140deg, ${BD.green} 0%, ${BD.greenDark} 100%)`,
          borderRadius: 16, padding: '22px 24px', color: '#fff', position: 'relative', overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(12,58,34,.24)',
        }}>
          <span aria-hidden style={{ position: 'absolute', right: -16, bottom: -28, fontSize: 150, color: 'rgba(244,196,48,.1)', lineHeight: 1 }}>★</span>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(244,196,48,.92)', marginBottom: 10 }}>
            {isNl ? 'BTW deze maand' : 'BTW this month'}
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.05 }}>
            <span style={{ fontSize: 18, fontWeight: 700, opacity: .8, marginRight: 6 }}>SRD</span>
            {fmtSrd(data.totals.btw_this_month_srd)}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
            {delta && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800,
                background: delta.up ? 'rgba(244,196,48,.22)' : 'rgba(255,255,255,.16)',
                color: delta.up ? BD.gold : '#fff', borderRadius: 20, padding: '3px 9px',
              }}>
                {delta.up ? '▲' : '▼'} {delta.label}
              </span>
            )}
            <span style={{ color: 'rgba(234,242,236,.75)' }}>
              {isNl ? 'vs vorige maand' : 'vs last month'} · SRD {fmtSrd(data.totals.btw_last_month_srd)}
            </span>
          </div>
        </div>

        <StatCard
          label={isNl ? 'Wacht op review' : 'Pending review'}
          value={data.totals.pending_review}
          tone={data.totals.pending_review > 0 ? 'amber' : 'muted'}
          icon="📥"
          hint={isInspector ? (isNl ? 'Te accepteren of betwisten' : 'To accept or dispute') : (isNl ? 'In afwachting van inspecteur' : 'Awaiting inspector')}
          onClick={onNavigateToSubmissions ? () => onNavigateToSubmissions({ status: 'filed' }) : undefined}
        />
        <StatCard
          label={isNl ? 'Open disputen' : 'Open disputes'}
          value={data.totals.disputed_open}
          tone={data.totals.disputed_open > 0 ? 'red' : 'muted'}
          icon="⚖️"
          hint={isInspector ? (isNl ? 'Wacht op correctie' : 'Awaiting correction') : (isNl ? 'Uw betwiste aangiftes' : 'Your disputed filings')}
          onClick={onNavigateToSubmissions ? () => onNavigateToSubmissions({ status: 'disputed' }) : undefined}
        />
        <StatCard
          label={isNl ? 'Geaccepteerd' : 'Accepted'}
          value={data.totals.this_month_by_status.accepted ?? 0}
          tone="green"
          icon="✓"
          hint={isNl ? 'Deze maand bevestigd' : 'Acknowledged this month'}
        />
      </div>

      {/* 30-day trend */}
      <div style={{ ...bdCard, padding: '18px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: BD.ink, textTransform: 'uppercase', letterSpacing: '.6px' }}>
            {isNl ? 'BTW-trend · 30 dagen' : 'BTW trend · 30 days'}
          </div>
          <div style={{ fontSize: 11, color: BD.muted }}>{isNl ? 'Piek' : 'Peak'}: <strong style={{ color: BD.green }}>SRD {fmtSrd(String(peakBtw))}</strong></div>
        </div>
        {data.trend_30d.length === 0 ? (
          <p style={{ fontSize: 13, color: BD.muted, textAlign: 'center', margin: '24px 0' }}>{isNl ? 'Geen gegevens in de afgelopen 30 dagen.' : 'No data in the last 30 days.'}</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96, paddingBottom: 4, borderBottom: `1px solid ${BD.border}` }}>
              {data.trend_30d.map((p, i) => {
                const h = (Number(p.btw_srd) / peakBtw) * 100
                const isPeak = i === peakIdx
                return (
                  <div key={p.date} title={`${p.date}: SRD ${fmtSrd(p.btw_srd)}`}
                    style={{
                      flex: 1, height: `${Math.max(2, h)}%`, minWidth: 4, borderRadius: '3px 3px 0 0',
                      background: isPeak ? BD.gold : `linear-gradient(180deg, ${BD.green}, ${BD.greenDark})`,
                      transition: 'opacity .15s',
                    }} />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: BD.muted, marginTop: 6 }}>
              <span>{data.trend_30d[0]?.date}</span>
              <span>{data.trend_30d[data.trend_30d.length - 1]?.date}</span>
            </div>
          </>
        )}
      </div>

      {/* Top orgs + late filings */}
      <div style={{ display: 'grid', gridTemplateColumns: data.late_filings.length > 0 ? '1fr 1fr' : '1fr', gap: 14 }}>
        <div style={{ ...bdCard, padding: '18px 22px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: BD.ink, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12 }}>
            {data.scope === 'platform'
              ? (isNl ? 'Top organisaties · BTW deze maand' : 'Top organisations · BTW this month')
              : (isNl ? 'Uw aangiftes deze maand' : 'Your submissions this month')}
          </div>
          {data.top_orgs_month.length === 0 ? (
            <p style={{ fontSize: 13, color: BD.muted, margin: 0 }}>{isNl ? 'Nog geen aangiftes deze maand.' : 'No submissions yet this month.'}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.top_orgs_month.map((o, idx) => (
                <li key={o.organisation_id}
                  onClick={() => onNavigateToSubmissions?.({ organisation_id: o.organisation_id })}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8, borderBottom: idx < data.top_orgs_month.length - 1 ? `1px solid ${BD.paper}` : 'none', cursor: onNavigateToSubmissions ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => { if (onNavigateToSubmissions) e.currentTarget.style.background = BD.greenSoft }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <span style={{
                    flexShrink: 0, width: 24, height: 24, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900,
                    background: idx === 0 ? BD.gold : BD.greenSoft, color: idx === 0 ? BD.greenDeep : BD.green,
                  }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: BD.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.organisation_name}</div>
                    <div style={{ fontSize: 11, color: BD.muted }}>{o.filings} {isNl ? 'aangifte(s)' : 'filing(s)'}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: BD.green }}>SRD {fmtSrd(o.total_btw_srd)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.late_filings.length > 0 && (
          <div style={{ ...bdCard, padding: '18px 22px', borderTop: `3px solid ${BD.red}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: BD.red, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 12 }}>
              ⚠ {isNl ? 'Late aangiftes · >7 dagen' : 'Late filings · >7 days'}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.late_filings.map((o, idx) => (
                <li key={o.organisation_id}
                  onClick={() => onNavigateToSubmissions?.({ organisation_id: o.organisation_id })}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px', borderRadius: 8, borderBottom: idx < data.late_filings.length - 1 ? `1px solid ${BD.paper}` : 'none', cursor: onNavigateToSubmissions ? 'pointer' : 'default' }}
                  onMouseEnter={(e) => { if (onNavigateToSubmissions) e.currentTarget.style.background = BD.redSoft }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: BD.ink }}>{o.organisation_name}</div>
                    <div style={{ fontSize: 11, color: BD.muted }}>
                      {o.last_submission_at
                        ? `${isNl ? 'Laatste:' : 'Last:'} ${new Date(o.last_submission_at).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}`
                        : (isNl ? 'Nooit ingediend' : 'Never filed')}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 900, color: BD.red, background: BD.redSoft, borderRadius: 20, padding: '3px 10px' }}>
                    {o.days_since ? `${o.days_since}d` : '—'}
                  </span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: BD.muted, marginTop: 10, lineHeight: 1.45 }}>
              {isNl ? 'Geen aangifte in >7 dagen. Mogelijk wachtend op gegevens, vakantie of vergeten.' : 'No filing in >7 days. May be awaiting data, on holiday, or forgotten.'}
            </p>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: BD.muted, textAlign: 'right', marginTop: 14 }}>
        {isNl ? 'Bijgewerkt:' : 'Updated:'} {new Date(data.generated_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })} · {isNl ? 'auto-ververst elke 60s' : 'auto-refresh 60s'}
      </p>
    </div>
  )
}

function StatCard({ label, value, tone, icon, hint, onClick }: {
  label: string; value: number; tone: 'amber' | 'red' | 'green' | 'muted'; icon: string; hint: string; onClick?: () => void
}) {
  const toneColor = tone === 'amber' ? '#a16207' : tone === 'red' ? BD.red : tone === 'green' ? BD.green : '#9ca3af'
  const toneBg    = tone === 'amber' ? '#fff8e6' : tone === 'red' ? BD.redSoft : tone === 'green' ? BD.greenSoft : '#f1f4f2'
  return (
    <div onClick={onClick}
      style={{ ...bdCard, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .15s, transform .12s' }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.boxShadow = '0 6px 18px rgba(12,58,34,.12)'; e.currentTarget.style.transform = 'translateY(-2px)' } }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = bdCard.boxShadow as string; e.currentTarget.style.transform = 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, color: BD.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</span>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: toneBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color: toneColor, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: 11, color: BD.muted, marginTop: 4, lineHeight: 1.35 }}>{hint}</div>
    </div>
  )
}
