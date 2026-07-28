import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'

/**
 * Task #73 — Platform-level overview for Super Admin.
 *
 * Renders the vendor-side pulse across every tenant on the platform:
 *   - Org licence health buckets (active / expiring / grace / lock)
 *   - Network-wide revenue (today / week / month)
 *   - Active terminals in last 24h
 *   - BTW filings pending inspector review
 *   - Next 5 expiring licences
 *   - Recent SA actions (last 10)
 *
 * Mounted at the top of the SA's DashboardOverview, above the existing
 * store-card grid. OA / SM / Auditor never see it (Component caller gates).
 */

interface PlatformData {
  generated_at: string
  orgs: {
    total: number
    active: number
    inactive: number
    license_health: {
      no_license:  number
      active:      number
      expiring_30: number
      expiring_14: number
      grace:       number
      soft_lock:   number
      hard_lock:   number
    }
  }
  revenue_srd: { today: string; week: string; month: string }
  transactions_today: number
  terminals: { active_24h: number; total: number }
  btw: { filings_pending_inspector_review: number }
  next_expiring_licenses: Array<{
    id: string
    organisation_id: string
    tier: string
    valid_until: string
    organisation?: { id: string; name: string }
  }>
  recent_sa_actions: Array<{
    id: number
    event: string
    user_id: string
    auditable_type: string
    auditable_id: string
    created_at: string
  }>
}

function fmtSrd(s: string) { return Number(s).toLocaleString('nl-SR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }) }
function daysUntil(s: string): number {
  return Math.floor((new Date(s).getTime() - Date.now()) / 86_400_000)
}

const TILE_BASE: React.CSSProperties = {
  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '18px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
}
const TILE_BIG_NUM: React.CSSProperties = { fontSize: 28, fontWeight: 900, letterSpacing: '-.5px' }
const TILE_LABEL: React.CSSProperties = { fontSize: 12, color: '#7e88a0', marginTop: 3, fontWeight: 500 }

export default function PlatformOverviewPanel() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const { data, isLoading, error } = useQuery({
    queryKey: ['platform-overview'],
    queryFn:  () => apiClient.get<{ data: PlatformData }>('/dashboard/platform-overview').then((r) => r.data.data),
    refetchInterval: 60_000, // platform-level — fresher than per-store live, slower than per-sale WS
  })

  if (isLoading) return <div style={{ padding: 24, color: '#7e88a0' }}>{isNl ? 'Platform-overzicht laden…' : 'Loading platform overview…'}</div>
  if (error || !data) return null

  const health = data.orgs.license_health
  const healthy = health.active
  const warning = health.expiring_30 + health.expiring_14
  const danger  = health.grace + health.soft_lock + health.hard_lock + health.no_license

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#16203a', margin: 0 }}>
          🌐 {isNl ? 'Platform-overzicht' : 'Platform Overview'}
        </h2>
        <span style={{ fontSize: 11, color: '#7e88a0', background: '#f2f5fb', padding: '2px 8px', borderRadius: 12 }}>
          {isNl ? 'Super Admin' : 'Super Admin'}
        </span>
      </div>

      {/* Top row — 4 headline tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        <div style={TILE_BASE}>
          <div style={{ ...TILE_BIG_NUM, color: '#003366' }}>{data.orgs.total}</div>
          <div style={TILE_LABEL}>{isNl ? 'Organisaties totaal' : 'Organisations'}</div>
          <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 4 }}>
            ✅ {data.orgs.active} {isNl ? 'actief' : 'active'}
            {data.orgs.inactive > 0 && <> · ⏸ {data.orgs.inactive} {isNl ? 'inactief' : 'inactive'}</>}
          </div>
        </div>

        <div style={TILE_BASE}>
          <div style={{ ...TILE_BIG_NUM, color: '#16a34a' }}>SRD {fmtSrd(data.revenue_srd.today)}</div>
          <div style={TILE_LABEL}>{isNl ? 'Vandaag (netwerk)' : 'Today (network)'}</div>
          <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 4 }}>
            {data.transactions_today} {isNl ? 'transacties' : 'transactions'}
          </div>
        </div>

        <div style={TILE_BASE}>
          <div style={{ ...TILE_BIG_NUM, color: '#2563eb' }}>SRD {fmtSrd(data.revenue_srd.month)}</div>
          <div style={TILE_LABEL}>{isNl ? 'Deze maand (netwerk)' : 'This month (network)'}</div>
          <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 4 }}>
            {isNl ? '7-dag:' : '7-day:'} SRD {fmtSrd(data.revenue_srd.week)}
          </div>
        </div>

        <div style={TILE_BASE}>
          <div style={{ ...TILE_BIG_NUM, color: data.terminals.active_24h === 0 ? '#dc2626' : '#16a34a' }}>
            {data.terminals.active_24h}<span style={{ fontSize: 18, color: '#7e88a0' }}> / {data.terminals.total}</span>
          </div>
          <div style={TILE_LABEL}>{isNl ? 'Actieve kassa\'s (24u)' : 'Active terminals (24h)'}</div>
          <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 4 }}>
            {Math.round(data.terminals.total > 0 ? (data.terminals.active_24h / data.terminals.total) * 100 : 0)}% {isNl ? 'in gebruik' : 'in use'}
          </div>
        </div>
      </div>

      {/* Licence health row + BTW pending */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
        <div style={TILE_BASE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            {isNl ? 'Licentiestatus over organisaties' : 'Licence health across organisations'}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <HealthBadge label={isNl ? 'Gezond' : 'Healthy'} count={healthy} color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
            <HealthBadge label={isNl ? 'Verloopt < 30d' : 'Expiring 30d'} count={health.expiring_30} color="#a16207" bg="#fefce8" border="#fde68a" />
            <HealthBadge label={isNl ? 'Verloopt < 14d' : 'Expiring 14d'} count={health.expiring_14} color="#c2410c" bg="#fff7ed" border="#fed7aa" />
            <HealthBadge label={isNl ? 'Grace' : 'Grace'} count={health.grace} color="#b91c1c" bg="#fef2f2" border="#fecaca" />
            <HealthBadge label={isNl ? 'Soft-lock' : 'Soft-lock'} count={health.soft_lock} color="#991b1b" bg="#fef2f2" border="#fca5a5" />
            <HealthBadge label={isNl ? 'Hard-lock' : 'Hard-lock'} count={health.hard_lock} color="#fff" bg="#1f1f1f" border="#7f1d1d" />
            {health.no_license > 0 && <HealthBadge label={isNl ? 'Geen licentie' : 'No licence'} count={health.no_license} color="#374151" bg="#f2f5fb" border="#d1d5db" />}
          </div>
          {(warning + danger) > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
              ⚠ {warning + danger} {isNl ? 'organisatie(s) hebben aandacht nodig.' : 'organisation(s) need attention.'}
            </div>
          )}
        </div>

        <div style={TILE_BASE}>
          <div style={{ ...TILE_BIG_NUM, color: data.btw.filings_pending_inspector_review > 0 ? '#a16207' : '#9ca3af' }}>
            {data.btw.filings_pending_inspector_review}
          </div>
          <div style={TILE_LABEL}>{isNl ? 'BTW-aangiftes wachten op inspecteur' : 'BTW filings awaiting inspector'}</div>
          <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 6, lineHeight: 1.4 }}>
            {isNl
              ? 'Belastingdienst inspecteur logt in en accepteert / betwist via BTW-aangiftes.'
              : 'Belastingdienst inspector logs in and accepts / disputes via BTW Submissions.'}
          </div>
        </div>
      </div>

      {/* Next expiring + recent SA actions side-by-side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
        <div style={TILE_BASE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            {isNl ? 'Volgende verlopende licenties' : 'Next expiring licences'}
          </div>
          {data.next_expiring_licenses.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0', margin: 0 }}>{isNl ? 'Geen verlopende licenties in de komende weken.' : 'No licences expiring soon.'}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.next_expiring_licenses.map((l) => {
                const days = daysUntil(l.valid_until)
                const color = days <= 0 ? '#dc2626' : days < 14 ? '#c2410c' : days < 30 ? '#a16207' : '#16a34a'
                return (
                  <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                    <span style={{ color: '#16203a' }}>
                      <strong>{l.organisation?.name ?? l.organisation_id.slice(0, 8) + '…'}</strong>
                      <span style={{ color: '#7e88a0', marginLeft: 6, textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>{l.tier}</span>
                    </span>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>
                      {fmtDate(l.valid_until)}
                      <span style={{ color: '#7e88a0', fontWeight: 500, marginLeft: 8 }}>
                        {days >= 0 ? `${days}d` : `${Math.abs(days)}d ${isNl ? 'verlopen' : 'overdue'}`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div style={TILE_BASE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            {isNl ? 'Recente Super Admin acties' : 'Recent Super Admin actions'}
          </div>
          {data.recent_sa_actions.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0', margin: 0 }}>{isNl ? 'Geen recente acties.' : 'No recent actions.'}</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.recent_sa_actions.map((a) => (
                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
                  <span style={{ color: '#16203a', fontFamily: 'monospace' }}>{a.event}</span>
                  <span style={{ color: '#7e88a0' }}>{new Date(a.created_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#7e88a0', margin: '4px 0 0', textAlign: 'right' }}>
        {isNl ? 'Bijgewerkt:' : 'Updated:'} {new Date(data.generated_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })} · {isNl ? 'auto-ververst elke 60s' : 'auto-refresh 60s'}
      </p>
    </section>
  )
}

function HealthBadge({ label, count, color, bg, border }: { label: string; count: number; color: string; bg: string; border: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: bg, border: `1px solid ${border}`, fontSize: 12, fontWeight: 700, color }}>
      <strong style={{ fontSize: 14 }}>{count}</strong>
      <span style={{ opacity: count === 0 ? 0.5 : 1 }}>{label}</span>
    </div>
  )
}
