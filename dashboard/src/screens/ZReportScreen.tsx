import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import { getDashboardZReports, type ZReportSummary } from '@/api/dashboard'
import { formatSRD } from '@/utils/currency'
import { format, subDays } from 'date-fns'
import apiClient from '@/api/client'

function today() { return format(new Date(), 'yyyy-MM-dd') }

const SYNC_CFG: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  synced:  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  pending: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  failed:  { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', dot: '#ef4444' },
  never:   { bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb', dot: '#d1d5db' },
}

// ─── USB Import Panel ─────────────────────────────────────────────────────────
function UsbImportPanel({ isNl }: { isNl: boolean }) {
  const [open, setOpen]           = useState(false)
  const [storeId, setStoreId]     = useState('')
  const [result, setResult]       = useState<{ imported: number; skipped: number; errors: string[]; store?: string; period?: { from: string; to: string } } | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file || !storeId.trim()) return
    setUploading(true); setResult(null); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('store_id', storeId.trim())
      const res = await apiClient.post('/sync/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(res.data)
    } catch (e: unknown) {
      type ErrShape = { response?: { data?: { message?: string } } }
      setError((e as ErrShape)?.response?.data?.message ?? 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef', marginBottom: 24, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '15px 22px', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #7c3aed20, #4f46e520)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            💾
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
              {isNl ? 'USB back-up importeren' : 'Import USB backup'}
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>
                {isNl ? 'Noodgeval • Laag 4' : 'Emergency • Layer 4'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#9090a0', marginTop: 1 }}>
              {isNl ? '.josbin_pos bestanden van vestigingen zonder internet' : '.josbin_pos files from stores without internet'}
            </div>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid #f0f0f8' }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, marginTop: 14 }}>
            {isNl
              ? 'Upload een .josbin_pos bestand dat opgeslagen is op een USB-stick of verzonden via e-mail/WhatsApp door een vestiging zonder internetverbinding.'
              : 'Upload a .josbin_pos file saved on a USB drive or sent via email/WhatsApp by a store without internet connection.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                {isNl ? 'Vestiging ID (UUID)' : 'Store ID (UUID)'}
              </label>
              <input
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid #e0e0ed', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                {isNl ? 'Bestand (.josbin_pos)' : 'File (.josbin_pos)'}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".josbin_pos"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                  borderRadius: 9, border: '1px solid #e0e0ed',
                  fontSize: 12, cursor: 'pointer',
                }}
              />
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: 9, marginBottom: 12, border: '1px solid #fecaca' }}>
              {error}
            </p>
          )}

          {result && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
              <p style={{ fontWeight: 800, color: '#15803d', marginBottom: 6, fontSize: 14 }}>
                ✓ {isNl ? 'Importeren geslaagd' : 'Import successful'}
                {result.store && ` — ${result.store}`}
                {result.period && ` (${result.period.from} → ${result.period.to})`}
              </p>
              <p style={{ color: '#166534', fontSize: 13 }}>
                {isNl
                  ? `${result.imported} geïmporteerd · ${result.skipped} overgeslagen`
                  : `${result.imported} imported · ${result.skipped} skipped`}
              </p>
              {result.errors.length > 0 && (
                <ul style={{ color: '#dc2626', marginTop: 8, fontSize: 12, paddingLeft: 18 }}>
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={uploading || !storeId.trim()}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              opacity: (uploading || !storeId.trim()) ? 0.5 : 1,
              boxShadow: '0 2px 8px rgba(124,58,237,.3)',
            }}
          >
            {uploading ? (isNl ? 'Importeren…' : 'Importing…') : (isNl ? 'Importeren' : 'Import')}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ZReportScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const [dateFrom, setDateFrom]     = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [dateTo, setDateTo]         = useState(today())
  const [syncFilter, setSyncFilter] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-z-reports', dateFrom, dateTo, syncFilter],
    queryFn: () => getDashboardZReports({
      date_from: dateFrom,
      date_to: dateTo,
      sync_status: syncFilter || undefined,
      per_page: 50,
    }),
    refetchInterval: 60_000,
  })

  const reports: ZReportSummary[] = data?.data ?? []

  // Column sort (shared hook → identical behaviour across all dashboard tables).
  // Server-paginated (per_page 50): sorting reorders the current page only.
  const { sorted: sortedReports, sort, toggle: toggleSort, indicator } = useTableSort(reports, {
    date:      (r) => (r.report_date ? new Date(r.report_date).getTime() : null),
    store:     (r) => (r.store?.name ?? '').toLowerCase(),
    revenue:   (r) => Number(r.total_sales_srd) || 0,
    btw:       (r) => Number(r.total_btw_srd) || 0,
    trans:     (r) => Number(r.transaction_count) || 0,
    cashdiff:  (r) => Number(r.cash_discrepancy_srd) || 0,
    sync:      (r) => (r.sync_status ?? '').toLowerCase(),
    closedby:  (r) => (r.closed_by?.name ?? '').toLowerCase(),
  })

  const syncLabels: Record<string, string> = {
    synced:  isNl ? 'Verzonden ✓' : 'Sent ✓',
    pending: isNl ? 'In wachtrij' : 'Pending',
    failed:  isNl ? 'Mislukt'     : 'Failed',
    never:   isNl ? 'Nooit'       : 'Never',
  }

  const syncedCount  = reports.filter((r) => r.sync_status === 'synced').length
  const pendingCount = reports.filter((r) => r.sync_status === 'pending').length
  const failedCount  = reports.filter((r) => r.sync_status === 'failed').length

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Z-Rapporten & Synchronisatie' : 'Z-Reports & Sync'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'Dagelijkse kasafsluiting per vestiging, sync-status en noodgeval import.'
            : 'Daily register close per store, sync status and emergency import.'}
        </p>
      </div>

      {/* Stats row */}
      {!isLoading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24, maxWidth: 720 }}>
          {[
            { label: isNl ? 'Totaal'       : 'Total',    value: data.total,   color: '#7c3aed' },
            { label: isNl ? 'Verzonden'    : 'Synced',   value: syncedCount,  color: '#16a34a' },
            { label: isNl ? 'In wachtrij'  : 'Pending',  value: pendingCount, color: '#d97706' },
            { label: isNl ? 'Mislukt'      : 'Failed',   value: failedCount,  color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
              padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9090a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* USB Import panel */}
      <UsbImportPanel isNl={isNl} />

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef',
        padding: '14px 18px', marginBottom: 20,
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Van' : 'From'}
          </label>
          <input
            type="date" value={dateFrom} max={dateTo}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0ed', fontSize: 13, color: '#1c1c2e', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Tot' : 'To'}
          </label>
          <input
            type="date" value={dateTo} min={dateFrom} max={today()}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0ed', fontSize: 13, color: '#1c1c2e', outline: 'none' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            {isNl ? 'Sync status' : 'Sync status'}
          </label>
          <select
            value={syncFilter}
            onChange={(e) => setSyncFilter(e.target.value)}
            style={{ padding: '8px 32px 8px 12px', borderRadius: 8, border: '1px solid #e0e0ed', fontSize: 13, color: '#1c1c2e', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'none\' stroke=\'%239090a0\' stroke-width=\'2\' viewBox=\'0 0 24 24\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            <option value="">{isNl ? 'Alle' : 'All'}</option>
            <option value="pending">{isNl ? 'In wachtrij' : 'Pending'}</option>
            <option value="synced">{isNl ? 'Verzonden' : 'Synced'}</option>
            <option value="failed">{isNl ? 'Mislukt' : 'Failed'}</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {data && (
            <span style={{ fontSize: 12, color: '#9090a0' }}>
              {data.total} {isNl ? 'rapporten' : 'reports'}
            </span>
          )}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isFetching ? 'spin-zr 0.8s linear infinite' : 'none' }}
            >
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {isNl ? 'Vernieuwen' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f3f3f8' }}>
                <div style={{ width: 80, height: 12, borderRadius: 6, background: '#f0f0f8' }} />
                <div style={{ width: 130, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 100, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 70, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[
                  { key: 'date',     label: isNl ? 'Datum' : 'Date' },
                  { key: 'store',    label: isNl ? 'Vestiging' : 'Store' },
                  { key: 'revenue',  label: isNl ? 'Omzet' : 'Revenue' },
                  { key: 'btw',      label: 'BTW' },
                  { key: 'trans',    label: isNl ? 'Trans.' : 'Trans.' },
                  { key: 'cashdiff', label: isNl ? 'Kasgeschil' : 'Cash diff.' },
                  { key: 'sync',     label: isNl ? 'Sync' : 'Sync' },
                  { key: 'closedby', label: isNl ? 'Afgesloten door' : 'Closed by' },
                ].map((h) => (
                  <th key={h.key} onClick={() => toggleSort(h.key)}
                    style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none' }}>
                    {h.label}
                    <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#7c3aed' : '#c0c0cc' }}>{indicator(h.key)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReports.map((r, i) => {
                const diff = parseFloat(r.cash_discrepancy_srd)
                const hasDiff = Math.abs(diff) > 0.005
                const sc = SYNC_CFG[r.sync_status] ?? SYNC_CFG.never
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < sortedReports.length - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#1c1c2e', fontSize: 13.5, whiteSpace: 'nowrap' }}>
                      {r.report_date}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{r.store?.name ?? r.store_id.slice(0, 8) + '…'}</div>
                      {r.store?.city && <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>{r.store.city}</div>}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                      {formatSRD(r.total_sales_srd)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#059669', fontWeight: 600 }}>
                      {formatSRD(r.total_btw_srd)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                      {r.transaction_count}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {hasDiff ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: diff < 0 ? '#fef2f2' : '#fffbeb',
                          color: diff < 0 ? '#dc2626' : '#d97706',
                          border: `1px solid ${diff < 0 ? '#fecaca' : '#fde68a'}`,
                        }}>
                          {diff > 0 ? '+' : ''}{formatSRD(diff.toFixed(2))}
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                        }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          OK
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                        {syncLabels[r.sync_status] ?? r.sync_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#374151' }}>{r.closed_by?.name ?? '—'}</div>
                      {r.synced_at && (
                        <div style={{ fontSize: 11, color: '#9090a0', marginTop: 2 }}>
                          {new Date(r.synced_at).toLocaleString(isNl ? 'nl-SR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                      {isNl ? 'Geen Z-rapporten gevonden' : 'No Z-reports found'}
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
                      {isNl ? 'Pas de datumfilter aan om meer resultaten te zien.' : 'Adjust the date filter to see more results.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isLoading && reports.length > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: '#9090a0' }}>
              {data?.total} {isNl ? 'rapporten in totaal' : 'reports total'}
            </span>
          </div>
        )}
      </div>

      <style>{`@keyframes spin-zr { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
