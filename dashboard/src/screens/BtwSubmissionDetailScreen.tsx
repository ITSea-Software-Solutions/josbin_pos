import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getBtwSubmissionDetail, acceptBtwSubmission, disputeBtwSubmission, supersedeBtwSubmission,
} from '@/api/btwSubmissions'
import { BD } from '@/theme/belastingdienst'
import { FlagStripe } from '@/components/shared/BelastingdienstHeader'

/**
 * Task #82 — detail view of a single BTW submission.
 *
 * Shows everything the inspector needs to evaluate a filing in one screen:
 *   - Header: reference, org, period, totals, status
 *   - Per-store breakdown (multi-store orgs)
 *   - Per source-POS breakdown (Josbin native vs Layer-3 third-party API)
 *   - Per payment-method breakdown
 *   - Per BTW-rate breakdown (the legal Belastingdienst view)
 *   - Audit timeline of every event touching this filing
 *   - Accept / Dispute / Resubmit buttons per role
 */

function fmtSrd(s: string | number) {
  return Number(s).toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}

const TILE: React.CSSProperties = {
  background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '20px 22px',
  boxShadow: '0 1px 4px rgba(0,0,0,.04)',
}

const SOURCE_COLOUR: Record<string, string> = {
  pos:    BD.green,  // Josbin POS
  api:    '#2563eb', // External Layer-3
  import: '#9ca3af',
}

export default function BtwSubmissionDetailScreen({ submissionId, onBack }: { submissionId: string; onBack: () => void }) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const user = useDashboardAuthStore((s) => s.user)
  const canReview = user?.role === 'tax_inspector' || user?.role === 'super_admin'
  const canResubmit = (user?.role === 'organisation_admin' || user?.role === 'store_manager')
  const isInspector = user?.role === 'tax_inspector'

  const { data, isLoading } = useQuery({
    queryKey: ['btw-submission-detail', submissionId],
    queryFn:  () => getBtwSubmissionDetail(submissionId),
  })

  const [action, setAction] = useState<'accept' | 'dispute' | 'resubmit' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => {
      if (action === 'accept')    return acceptBtwSubmission(submissionId, note || undefined)
      if (action === 'dispute')   return disputeBtwSubmission(submissionId, note)
      if (action === 'resubmit')  return supersedeBtwSubmission(submissionId, note || undefined)
      throw new Error('No action selected')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['btw-submission-detail', submissionId] })
      qc.invalidateQueries({ queryKey: ['btw-submissions'] })
      qc.invalidateQueries({ queryKey: ['btw-inspector-dashboard'] })
      setAction(null); setNote(''); setError('')
    },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed'),
  })

  if (isLoading || !data) {
    return <div style={{ padding: 40, color: '#7e88a0', textAlign: 'center' }}>{isNl ? 'Laden…' : 'Loading…'}</div>
  }

  const s = data.submission
  const ownOrg = user?.organisation_id === s.organisation_id
  const canResubmitThis = canResubmit && ownOrg && (s.status === 'filed' || s.status === 'disputed')

  return (
    <div style={{ padding: '28px 32px', maxWidth: '100%', background: isInspector ? BD.paper : undefined, minHeight: isInspector ? '100%' : undefined }}>
      {/* Back */}
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: isInspector ? BD.green : '#293371', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
        ← {isNl ? 'Terug naar lijst' : 'Back to list'}
      </button>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        {isInspector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <FlagStripe w={34} h={22} />
            <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '1.6px', color: BD.green, textTransform: 'uppercase' }}>
              {isNl ? 'Belastingdienst · BTW-aangifte' : 'Tax Authority · BTW filing'}
            </span>
          </div>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 900, color: BD.ink, letterSpacing: '-0.3px', marginBottom: 6, fontFamily: isInspector ? "Georgia,'Times New Roman',serif" : 'inherit' }}>
          {s.reference}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {s.organisation?.name} · {fmtDate(s.period_start)}{s.period_start !== s.period_end ? ` → ${fmtDate(s.period_end)}` : ''}
          {s.organisation?.btw_number && <> · BTW: <span style={{ fontFamily: 'monospace' }}>{s.organisation.btw_number}</span></>}
        </p>
      </div>

      {/* Status + totals + actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 22 }}>
        <div style={TILE}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Stat label={isNl ? 'Verkopen' : 'Sales'} value={String(s.sales_count)} />
            <Stat label={isNl ? 'Totaal omzet' : 'Total sales'} value={`SRD ${fmtSrd(s.total_sales_srd)}`} />
            <Stat label={isNl ? 'Belastbaar' : 'Taxable'} value={`SRD ${fmtSrd(s.btw_taxable_srd)}`} />
            <Stat label={isNl ? 'Vrijgesteld' : 'Exempt'} value={`SRD ${fmtSrd(s.btw_exempt_srd)}`} />
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{isNl ? 'BTW te betalen' : 'BTW due'}</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: BD.green }}>SRD {fmtSrd(s.total_btw_srd)}</span>
          </div>
        </div>

        <div style={TILE}>
          <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>
            {isNl ? 'Status' : 'Status'}
          </div>
          <StatusBadge status={s.status} isNl={isNl} large />

          <div style={{ marginTop: 14, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            <div>{isNl ? 'Ingediend' : 'Filed'}: {fmtDateTime(s.submitted_at)}</div>
            <div>{isNl ? 'Door' : 'By'}: {s.submitter?.name ?? '—'}</div>
            {s.reviewed_at && <div style={{ marginTop: 6 }}>
              {isNl ? 'Beoordeeld' : 'Reviewed'}: {fmtDateTime(s.reviewed_at)} {s.reviewer?.name && <>· {s.reviewer.name}</>}
            </div>}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {canReview && s.status === 'filed' && (
              <>
                <button onClick={() => { setAction('accept'); setError('') }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ {isNl ? 'Accepteer' : 'Accept'}
                </button>
                <button onClick={() => { setAction('dispute'); setError('') }}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ⚠ {isNl ? 'Betwist' : 'Dispute'}
                </button>
              </>
            )}
            {canResubmitThis && (
              <button onClick={() => { setAction('resubmit'); setError('') }}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #d5deef', background: '#f2f5fc', color: '#1e2657', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ↺ {isNl ? 'Corrigeer' : 'Resubmit'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {(s.submitter_note || s.inspector_note) && (
        <div style={{ ...TILE, marginBottom: 22 }}>
          {s.submitter_note && (
            <div style={{ marginBottom: s.inspector_note ? 12 : 0 }}>
              <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px' }}>
                💬 {isNl ? 'Opmerking belastingplichtige' : 'Submitter note'}
              </div>
              <p style={{ fontSize: 13, color: '#16203a', marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.submitter_note}</p>
            </div>
          )}
          {s.inspector_note && (
            <div>
              <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px' }}>
                🔍 {isNl ? 'Opmerking inspecteur' : 'Inspector note'}
              </div>
              <p style={{ fontSize: 13, color: '#16203a', marginTop: 4, whiteSpace: 'pre-wrap' }}>{s.inspector_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <div style={TILE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            🏬 {isNl ? 'Per vestiging' : 'Per store'}
          </div>
          {data.breakdown.per_store.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0' }}>{isNl ? 'Geen verkopen in deze periode.' : 'No sales in this period.'}</p>
          ) : (
            <BreakdownTable rows={data.breakdown.per_store.map((r) => ({
              key: r.store_id, label: r.store_name, sub: `${r.tx_count} tx`, total: r.total_btw_srd, gross: r.total_sales_srd,
            }))} isNl={isNl} />
          )}
        </div>

        <div style={TILE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            💻 {isNl ? 'Per POS-bron' : 'Per source POS'}
          </div>
          {data.breakdown.per_source.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0' }}>{isNl ? 'Geen verkopen.' : 'No sales.'}</p>
          ) : (
            <>
              <BreakdownTable rows={data.breakdown.per_source.map((r) => ({
                key: r.source, label: r.source_label, sub: `${r.tx_count} tx`, total: r.total_btw_srd, gross: r.total_sales_srd,
                colour: SOURCE_COLOUR[r.source],
              }))} isNl={isNl} />
              <p style={{ fontSize: 11, color: '#7e88a0', marginTop: 8, lineHeight: 1.4 }}>
                {isNl
                  ? 'POS-bron geeft aan welk verkoopsysteem de gegevens heeft aangeleverd. Externe POS via onze Open Integration API (Layer 3) tellen volledig mee in de BTW-aangifte.'
                  : 'Source POS shows which sales system delivered the data. External POS via our Open Integration API (Layer 3) contribute fully to the BTW filing.'}
              </p>
            </>
          )}
        </div>

        <div style={TILE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            💳 {isNl ? 'Per betaalwijze' : 'Per payment method'}
          </div>
          {data.breakdown.per_payment_method.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0' }}>—</p>
          ) : (
            <BreakdownTable rows={data.breakdown.per_payment_method.map((r) => ({
              key: r.method, label: r.method, sub: `${r.tx_count} tx`, total: r.total_srd,
            }))} isNl={isNl} />
          )}
        </div>

        <div style={TILE}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            🧾 {isNl ? 'Per BTW-tarief' : 'Per BTW rate'}
          </div>
          {data.breakdown.per_btw_rate.length === 0 ? (
            <p style={{ fontSize: 13, color: '#7e88a0' }}>{isNl ? 'Geen lijnregels in deze aangifte (snapshot-only).' : 'No line items in this filing (snapshot-only).'}</p>
          ) : (
            <BreakdownTable rows={data.breakdown.per_btw_rate.map((r) => ({
              key: `${r.rate}-${r.exempt}`, label: r.exempt ? (isNl ? 'BTW-vrij' : 'Exempt') : `${r.rate}%`,
              sub: `${isNl ? 'Grondslag' : 'Base'}: SRD ${fmtSrd(r.base_srd)}`, total: r.btw_srd,
            }))} isNl={isNl} />
          )}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ ...TILE, marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
          🕒 {isNl ? 'Tijdlijn' : 'Timeline'}
        </div>
        {data.timeline.length === 0 ? (
          <p style={{ fontSize: 13, color: '#7e88a0' }}>—</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.timeline.map((evt) => (
              <li key={evt.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontSize: 12, color: '#7e88a0', fontFamily: 'monospace', width: 130, flexShrink: 0 }}>
                  {fmtDateTime(evt.created_at)}
                </span>
                <span style={{ fontSize: 13, color: '#16203a', fontWeight: 600 }}>{evt.event}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action modal */}
      {action && (
        <div onClick={() => setAction(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 500 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
              {action === 'accept'  && (isNl ? 'Aangifte accepteren' : 'Accept submission')}
              {action === 'dispute' && (isNl ? 'Aangifte betwisten' : 'Dispute submission')}
              {action === 'resubmit' && (isNl ? 'Aangifte corrigeren' : 'Resubmit submission')}
            </h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {action === 'dispute'
                ? (isNl ? 'Reden voor betwisting (verplicht, min. 5 tekens)' : 'Reason for dispute (required, min 5 chars)') + ' *'
                : (isNl ? 'Opmerking (optioneel)' : 'Note (optional)')}
            </label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />
            {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAction(null)} style={{ flex: 1, padding: '11px 0', background: '#f2f5fb', border: '1px solid #d9e1f1', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button onClick={() => mut.mutate()} disabled={mut.isPending || (action === 'dispute' && note.length < 5)}
                style={{
                  flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mut.isPending ? 0.5 : 1,
                  background: action === 'accept' ? 'linear-gradient(135deg,#16a34a,#15803d)' :
                              action === 'dispute' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' :
                              'linear-gradient(135deg,#293371,#1f2a63)',
                }}>
                {mut.isPending ? '…' :
                  action === 'accept'  ? '✓ ' + (isNl ? 'Accepteer' : 'Accept') :
                  action === 'dispute' ? '⚠ ' + (isNl ? 'Betwist' : 'Dispute') :
                  '↺ ' + (isNl ? 'Opnieuw indienen' : 'Resubmit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#16203a', marginTop: 4 }}>{value}</div>
    </div>
  )
}

function BreakdownTable({ rows, isNl }: {
  rows: Array<{ key: string; label: string; sub: string; total: string; gross?: string; colour?: string }>
  isNl: boolean
}) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {rows.map((r, idx) => (
        <li key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {r.colour && <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.colour }} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#16203a' }}>{r.label}</div>
              <div style={{ fontSize: 11, color: '#7e88a0' }}>{r.sub}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>SRD {Number(r.total).toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            {r.gross && <div style={{ fontSize: 11, color: '#7e88a0' }}>{isNl ? 'van' : 'of'} SRD {Number(r.gross).toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
          </div>
        </li>
      ))}
    </ul>
  )
}

function StatusBadge({ status, isNl, large = false }: { status: string; isNl: boolean; large?: boolean }) {
  const style: Record<string, { bg: string; fg: string; nl: string; en: string }> = {
    filed:      { bg: '#eef2ff', fg: '#1a234f', nl: 'Ingediend',    en: 'Filed' },
    accepted:   { bg: '#f0fdf4', fg: '#15803d', nl: 'Geaccepteerd', en: 'Accepted' },
    disputed:   { bg: '#fef2f2', fg: '#b91c1c', nl: 'Betwist',      en: 'Disputed' },
    superseded: { bg: '#f2f5fb', fg: '#6b7280', nl: 'Vervangen',    en: 'Superseded' },
  }
  const s = style[status] ?? { bg: '#f9fafb', fg: '#374151', nl: status, en: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: large ? '6px 14px' : '3px 10px',
      borderRadius: 20, background: s.bg, color: s.fg, fontWeight: 700,
      fontSize: large ? 14 : 12,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.fg }} />
      {s[isNl ? 'nl' : 'en']}
    </span>
  )
}
