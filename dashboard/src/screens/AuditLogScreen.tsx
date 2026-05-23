import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getAuditLog, getAuditSummary, type AuditEntry, type AuditFilters } from '@/api/auditLog'
import { useTranslation } from 'react-i18next'
import apiClient from '@/api/client'
import { useDashboardAuthStore } from '@/store/authStore'
import { format, subDays } from 'date-fns'

// ─── Event badge ─────────────────────────────────────────────────────────────
function EventBadge({ event }: { event: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    created: { bg: 'rgba(16,185,129,0.1)', color: '#059669', label: 'Created' },
    updated: { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', label: 'Updated' },
    deleted: { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', label: 'Deleted' },
  }
  const c = cfg[event] ?? { bg: 'rgba(100,116,139,0.1)', color: '#6b7280', label: event }
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
      {c.label}
    </span>
  )
}

// ─── Model badge ─────────────────────────────────────────────────────────────
function ModelBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Sale: '#7c3aed', Product: '#0891b2', User: '#d97706',
    Organisation: '#059669', Store: '#6366f1', ZReport: '#be185d',
  }
  const color = colors[type] ?? '#6b7280'
  return (
    <span style={{ background: `${color}15`, color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {type}
    </span>
  )
}

// ─── Values diff viewer ───────────────────────────────────────────────────────
function ValuesDiff({ old: oldV, next: newV }: { old: Record<string, unknown> | null; next: Record<string, unknown> | null }) {
  if (!oldV && !newV) return <span style={{ color: '#9090a0', fontSize: 12 }}>—</span>
  const keys = [...new Set([...Object.keys(oldV ?? {}), ...Object.keys(newV ?? {})])]
    .filter(k => !['updated_at', 'last_used_at', 'last_login_at'].includes(k))
  if (!keys.length) return <span style={{ color: '#9090a0', fontSize: 12 }}>—</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {keys.slice(0, 4).map(k => {
        const ov = String(oldV?.[k] ?? '')
        const nv = String(newV?.[k] ?? '')
        const changed = ov !== nv
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <span style={{ color: '#9090a0', fontWeight: 600, minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            {changed && ov ? <span style={{ color: '#ef4444', background: '#fef2f2', padding: '1px 5px', borderRadius: 4, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ov.slice(0, 20)}</span> : null}
            {changed && <span style={{ color: '#9090a0' }}>→</span>}
            {nv ? <span style={{ color: '#059669', background: '#f0fdf4', padding: '1px 5px', borderRadius: 4, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nv.slice(0, 20)}</span> : null}
          </div>
        )
      })}
      {keys.length > 4 && <span style={{ fontSize: 10, color: '#9090a0' }}>+{keys.length - 4} more fields</span>}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const dt = new Date(entry.created_at)
  const timeStr = dt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  const dateStr = dt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

  return (
    <>
      <tr
        style={{ borderBottom: '1px solid #f0f0f5', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1c1c2e' }}>{dateStr}</p>
          <p style={{ fontSize: 11, color: '#9090a0' }}>{timeStr}</p>
        </td>
        <td style={{ padding: '10px 16px' }}><EventBadge event={entry.event} /></td>
        <td style={{ padding: '10px 16px' }}><ModelBadge type={entry.model_type} /></td>
        <td style={{ padding: '10px 16px' }}>
          {entry.user ? (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1c1c2e' }}>{entry.user.name}</p>
              <p style={{ fontSize: 11, color: '#9090a0' }}>{entry.user.role.replace('_', ' ')}</p>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#9090a0' }}>System</span>
          )}
        </td>
        <td style={{ padding: '10px 16px', maxWidth: 320 }}>
          <ValuesDiff old={entry.old_values} next={entry.new_values} />
        </td>
        <td style={{ padding: '10px 16px' }}>
          <span style={{ fontSize: 11, color: '#9090a0', fontFamily: 'monospace' }}>
            {entry.ip_address ?? '—'}
          </span>
        </td>
        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
          <span style={{ color: '#9090a0', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: '#f8f8fb' }}>
          <td colSpan={7} style={{ padding: '12px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {entry.old_values && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Before</p>
                  <pre style={{ fontSize: 11, color: '#374151', background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(entry.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {entry.new_values && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>After</p>
                  <pre style={{ fontSize: 11, color: '#374151', background: '#fff', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb', overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(entry.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#9090a0', marginTop: 8 }}>
              Model ID: <code style={{ fontFamily: 'monospace', background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>{entry.model_id}</code>
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Rekenkamer Export Panel ──────────────────────────────────────────────────
function RekenkamerPanel({ isNl }: { isNl: boolean }) {
  const user = useDashboardAuthStore((s) => s.user)
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [locale, setLocale]     = useState(user?.locale ?? 'nl')
  const [loading, setLoading]   = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to:   dateTo,
        locale,
        ...(user?.organisation_id ? { organisation_id: user.organisation_id } : {}),
      })
      const res = await apiClient.get(`/reports/rekenkamer?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a   = document.createElement('a')
      a.href = url
      a.download = `rekenkamer_${dateFrom}_${dateTo}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // TODO: error toast
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebf0', padding: '20px 24px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e', marginBottom: 2 }}>
          Rekenkamer van Suriname — {isNl ? 'Auditexport' : 'Audit Export'}
        </p>
        <p style={{ fontSize: 12, color: '#9090a0' }}>
          {isNl ? 'Ondertekend PDF met volledige transactiegeschiedenis' : 'Signed PDF with full transaction history'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginLeft: 'auto' }}>
        <div>
          <p style={labelSt}>{isNl ? 'Van' : 'From'}</p>
          <input type="date" value={dateFrom} max={dateTo} onChange={e => setDateFrom(e.target.value)} style={inputSt} />
        </div>
        <div>
          <p style={labelSt}>{isNl ? 'Tot' : 'To'}</p>
          <input type="date" value={dateTo} min={dateFrom} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => setDateTo(e.target.value)} style={inputSt} />
        </div>
        <div>
          <p style={labelSt}>{isNl ? 'Taal' : 'Language'}</p>
          <select value={locale} onChange={e => setLocale(e.target.value as 'nl' | 'en')} style={inputSt}>
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          style={{
            height: 36, padding: '0 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #1a5276, #2471a3)',
            color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 4px 12px rgba(26,82,118,0.35)',
            opacity: loading ? 0.7 : 1,
            whiteSpace: 'nowrap' as const,
          }}
        >
          {loading ? (isNl ? 'Exporteren…' : 'Exporting…') : (isNl ? '📄 Rekenkamer PDF downloaden' : '📄 Download Rekenkamer PDF')}
        </button>
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#9090a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }
const inputSt: React.CSSProperties = { height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AuditLogScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const [filters, setFilters] = useState<AuditFilters>({ per_page: 50, page: 1 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', filters],
    queryFn: () => getAuditLog(filters),
    placeholderData: keepPreviousData,
  })

  const { data: summary } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: getAuditSummary,
    staleTime: 60_000,
  })

  function applySearch() {
    setFilters(f => ({ ...f, search: search || undefined, page: 1 }))
  }

  const EVENT_OPTS = ['', 'created', 'updated', 'deleted']
  const MODEL_OPTS = ['', 'Sale', 'Product', 'User', 'Organisation', 'Store', 'ZReport']

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1600 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1c1c2e', letterSpacing: '-0.3px' }}>
          {isNl ? 'Auditlogboek' : 'Audit Log'}
        </h2>
        <p style={{ fontSize: 13, color: '#9090a0', marginTop: 3 }}>
          {isNl ? 'Onveranderlijk logboek van alle systeemwijzigingen' : 'Immutable record of all system changes'}
        </p>
      </div>

      {/* Rekenkamer export */}
      <RekenkamerPanel isNl={isNl} />

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #ebebf0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{summary.total_30d}</p>
            <p style={{ fontSize: 12, color: '#9090a0', marginTop: 2 }}>{isNl ? 'Totaal 30 dagen' : 'Total 30 days'}</p>
          </div>
          {Object.entries(summary.by_event).map(([evt, cnt]) => (
            <div key={evt} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #ebebf0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: evt === 'created' ? '#059669' : evt === 'deleted' ? '#ef4444' : '#6366f1' }}>{cnt as number}</p>
              <p style={{ fontSize: 12, color: '#9090a0', marginTop: 2, textTransform: 'capitalize' }}>{evt}</p>
            </div>
          ))}
          {Object.entries(summary.by_model).map(([model, cnt]) => (
            <div key={model} style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #ebebf0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#1c1c2e' }}>{cnt as number}</p>
              <p style={{ fontSize: 12, color: '#9090a0', marginTop: 2 }}>{model}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters bar */}
      <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #ebebf0', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Search */}
        <div style={{ flex: '1 1 200px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6d6d80', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isNl ? 'Zoeken' : 'Search'}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySearch()}
              placeholder={isNl ? 'Zoek in wijzigingen...' : 'Search changes...'}
              style={{ flex: 1, height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 12px', fontSize: 13, outline: 'none' }}
            />
            <button
              onClick={applySearch}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              {isNl ? 'Zoek' : 'Search'}
            </button>
          </div>
        </div>

        {/* Event filter */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6d6d80', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event</p>
          <select
            value={filters.event ?? ''}
            onChange={e => setFilters(f => ({ ...f, event: e.target.value || undefined, page: 1 }))}
            style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }}
          >
            {EVENT_OPTS.map(o => <option key={o} value={o}>{o || (isNl ? 'Alle events' : 'All events')}</option>)}
          </select>
        </div>

        {/* Model filter */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6d6d80', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model</p>
          <select
            value={filters.auditable_type ?? ''}
            onChange={e => setFilters(f => ({ ...f, auditable_type: e.target.value || undefined, page: 1 }))}
            style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }}
          >
            {MODEL_OPTS.map(o => <option key={o} value={o}>{o || (isNl ? 'Alle modellen' : 'All models')}</option>)}
          </select>
        </div>

        {/* Date range */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6d6d80', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isNl ? 'Datum van' : 'Date from'}</p>
          <input type="date" value={filters.date_from ?? ''} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value || undefined, page: 1 }))}
            style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }} />
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6d6d80', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isNl ? 'Datum t/m' : 'Date to'}</p>
          <input type="date" value={filters.date_to ?? ''} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value || undefined, page: 1 }))}
            style={{ height: 36, borderRadius: 8, border: '1px solid #e5e7eb', padding: '0 10px', fontSize: 13, background: '#fff', outline: 'none' }} />
        </div>

        {/* Clear */}
        <button
          onClick={() => { setFilters({ per_page: 50, page: 1 }); setSearch('') }}
          style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6d6d80', fontWeight: 600, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-end' }}
        >
          {isNl ? 'Wis filters' : 'Clear'}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebf0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f8fb', borderBottom: '2px solid #ebebf0' }}>
                  {[
                    isNl ? 'Tijdstip' : 'Time',
                    'Event',
                    'Model',
                    isNl ? 'Gebruiker' : 'User',
                    isNl ? 'Wijzigingen' : 'Changes',
                    'IP',
                    '',
                  ].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((entry: AuditEntry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
                {(data?.data ?? []).length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9090a0', fontSize: 14 }}>
                    {isNl ? 'Geen logboekitems gevonden' : 'No audit entries found'}
                  </td></tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.last_page > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #f0f0f5' }}>
                <p style={{ fontSize: 13, color: '#9090a0' }}>
                  {isNl ? `${data.total} items` : `${data.total} entries`}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={(filters.page ?? 1) <= 1}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                    style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', opacity: (filters.page ?? 1) <= 1 ? 0.4 : 1 }}
                  >← {isNl ? 'Vorige' : 'Prev'}</button>
                  <span style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: 13, color: '#6d6d80' }}>
                    {filters.page ?? 1} / {data.last_page}
                  </span>
                  <button
                    disabled={(filters.page ?? 1) >= data.last_page}
                    onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                    style={{ height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', opacity: (filters.page ?? 1) >= data.last_page ? 0.4 : 1 }}
                  >{isNl ? 'Volgende' : 'Next'} →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
