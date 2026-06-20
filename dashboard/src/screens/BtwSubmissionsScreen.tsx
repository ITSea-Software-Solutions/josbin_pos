import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  listBtwSubmissions, previewBtwSubmission, submitBtw,
  acceptBtwSubmission, disputeBtwSubmission, supersedeBtwSubmission, bulkAcceptBtw,
  type BtwSubmission, type BtwSubmissionStatus, type BtwSubmissionPeriodType, type BtwSubmissionPreview,
} from '@/api/btwSubmissions'
import { getOrganisations } from '@/api/organisations'
import { BD } from '@/theme/belastingdienst'
import { BelastingdienstHeader } from '@/components/shared/BelastingdienstHeader'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<BtwSubmissionStatus, { bg: string; fg: string; border: string; label: { nl: string; en: string } }> = {
  filed:      { bg: '#eef2ff', fg: '#4338ca', border: '#c7d2fe', label: { nl: 'Ingediend',    en: 'Filed' } },
  accepted:   { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0', label: { nl: 'Geaccepteerd', en: 'Accepted' } },
  disputed:   { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', label: { nl: 'Betwist',      en: 'Disputed' } },
  superseded: { bg: '#f5f5fb', fg: '#6b7280', border: '#e5e7eb', label: { nl: 'Vervangen',    en: 'Superseded' } },
}

function fmtSrd(n: string | number) { return Number(n).toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('nl-NL', { year: 'numeric', month: 'short', day: '2-digit' }) }

const inputSt: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

// ── Filter toolbar styles (advanced, horizontal layout) ──────────────────────
const CHEVRON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b6b62' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"
const fieldLabelSt: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: BD.muted, marginBottom: 6 }
const filterSelectSt: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 34px 0 12px', borderRadius: 10,
  border: `1.5px solid ${BD.border}`, background: `#fff url("${CHEVRON}") no-repeat right 12px center`,
  backgroundSize: '12px', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  fontSize: 13, color: BD.ink, cursor: 'pointer', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

// ─── Submit modal (OA / SM) ──────────────────────────────────────────────────

function SubmitBtwModal({ isNl, onClose, onSubmitted }: { isNl: boolean; onClose: () => void; onSubmitted: (s: BtwSubmission) => void }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  // Default to YESTERDAY for daily (today's still being rung up) and
  // PREVIOUS MONTH for monthly (current month not over).
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const prevMonthStart = (() => { const d = new Date(); d.setDate(0); d.setDate(1); return d.toISOString().slice(0, 10) })()
  const prevMonthEnd   = (() => { const d = new Date(); d.setDate(0); return d.toISOString().slice(0, 10) })()

  const [periodType, setPeriodType] = useState<BtwSubmissionPeriodType>('daily')
  const [start, setStart] = useState(yesterday)
  const [end,   setEnd]   = useState(yesterday)
  const [note,  setNote]  = useState('')
  const [preview, setPreview] = useState<BtwSubmissionPreview | null>(null)
  const [error, setError] = useState('')

  function setMonthly() {
    setPeriodType('monthly'); setStart(prevMonthStart); setEnd(prevMonthEnd); setPreview(null); setError('')
  }
  function setDaily() {
    setPeriodType('daily'); setStart(yesterday); setEnd(yesterday); setPreview(null); setError('')
  }

  const previewMut = useMutation({
    mutationFn: () => previewBtwSubmission({ period_type: periodType, period_start: start, period_end: end }),
    onSuccess: (p) => { setPreview(p); setError('') },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Preview failed'),
  })

  const submitMut = useMutation({
    mutationFn: () => submitBtw({ period_type: periodType, period_start: start, period_end: end, submitter_note: note || undefined }),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ['btw-submissions'] }); onSubmitted(s) },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      setError(r?.code === 'BTW_ALREADY_FILED'
        ? (isNl ? 'Er bestaat al een filing voor deze periode.' : 'A filing already exists for this period.')
        : r?.message ?? 'Submit failed')
    },
  })

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,.25)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1c1c2e' }}>
              {isNl ? 'BTW-aangifte indienen' : 'File a BTW submission'}
            </h3>
            <p style={{ fontSize: 12, color: '#9090a0', marginTop: 2 }}>
              {isNl ? 'Aan Belastingdienst Suriname' : 'To Belastingdienst Suriname'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>

        {/* Period type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={setDaily} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: periodType === 'daily' ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: periodType === 'daily' ? '#f5f0ff' : '#fff', fontSize: 13, fontWeight: 700, color: periodType === 'daily' ? '#7c3aed' : '#6b7280', cursor: 'pointer' }}>
            {isNl ? '📅 Dagelijks' : '📅 Daily'}
          </button>
          <button onClick={setMonthly} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: periodType === 'monthly' ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: periodType === 'monthly' ? '#f5f0ff' : '#fff', fontSize: 13, fontWeight: 700, color: periodType === 'monthly' ? '#7c3aed' : '#6b7280', cursor: 'pointer' }}>
            {isNl ? '🗓️ Maandelijks (formele aangifte)' : '🗓️ Monthly (formal filing)'}
          </button>
        </div>

        {/* Date range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Vanaf' : 'From'}</label>
            <input type="date" max={today} value={start} onChange={(e) => { setStart(e.target.value); if (periodType === 'daily') setEnd(e.target.value); setPreview(null) }} style={inputSt} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Tot en met' : 'Until'}</label>
            <input type="date" max={today} value={end} onChange={(e) => { setEnd(e.target.value); setPreview(null) }} disabled={periodType === 'daily'} style={{ ...inputSt, opacity: periodType === 'daily' ? 0.5 : 1 }} />
          </div>
        </div>

        {/* Preview button */}
        <button onClick={() => previewMut.mutate()} disabled={previewMut.isPending || !start || !end}
          style={{ width: '100%', padding: '10px 0', border: '1.5px solid #ddd6fe', borderRadius: 10, background: '#f5f3ff', color: '#6d28d9', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
          {previewMut.isPending ? (isNl ? 'Berekenen…' : 'Computing…') : (isNl ? '🔍 Bereken totalen' : '🔍 Compute totals')}
        </button>

        {/* Preview result */}
        {preview && (
          <div style={{ background: '#f9f7ff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>
              {isNl ? '📊 Voorbeeld — totalen voor deze periode' : '📊 Preview — totals for this period'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div><strong style={{ color: '#1c1c2e' }}>{preview.totals.sales_count}</strong> <span style={{ color: '#6b7280' }}>{isNl ? 'verkopen' : 'sales'}</span></div>
              <div>{isNl ? 'Totaal omzet:' : 'Total sales:'} <strong>SRD {fmtSrd(preview.totals.total_sales_srd)}</strong></div>
              <div>{isNl ? 'Belastbaar:' : 'Taxable:'} <strong>SRD {fmtSrd(preview.totals.btw_taxable_srd)}</strong></div>
              <div>{isNl ? 'Vrijgesteld:' : 'Exempt:'} <strong>SRD {fmtSrd(preview.totals.btw_exempt_srd)}</strong></div>
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #ede9fe', paddingTop: 8, marginTop: 4 }}>
                {isNl ? 'BTW te betalen:' : 'BTW due:'} <strong style={{ color: '#7c3aed', fontSize: 15 }}>SRD {fmtSrd(preview.totals.total_btw_srd)}</strong>
              </div>
            </div>
            {preview.existing && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                ⚠️ {isNl
                  ? `Er bestaat al een aangifte voor deze periode (${preview.existing.reference}, status: ${preview.existing.status}). Het systeem blokkeert dubbele indiening.`
                  : `A filing already exists for this period (${preview.existing.reference}, status: ${preview.existing.status}). The system will block a duplicate submission.`}
              </div>
            )}
          </div>
        )}

        {/* Note */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {isNl ? 'Opmerking (optioneel)' : 'Note (optional)'}
          </label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2}
            placeholder={isNl ? 'bv. één kassa-einde ontbreekt, volgt in volgende aangifte' : 'e.g. one register close missing, will be in next filing'}
            style={{ ...inputSt, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        {error && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => submitMut.mutate()} disabled={submitMut.isPending || !preview || !!preview.existing}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitMut.isPending || !preview || !!preview.existing) ? 0.5 : 1, boxShadow: '0 4px 12px rgba(124,58,237,.3)' }}>
            {submitMut.isPending ? (isNl ? 'Indienen…' : 'Filing…') : (isNl ? '✓ Indienen bij Belastingdienst' : '✓ File with Belastingdienst')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Review modal (tax_inspector + SA) ───────────────────────────────────────

function ReviewModal({ submission, action, isNl, onClose }: { submission: BtwSubmission; action: 'accept' | 'dispute'; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => action === 'accept'
      ? acceptBtwSubmission(submission.id, note || undefined)
      : disputeBtwSubmission(submission.id, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['btw-submissions'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed'),
  })

  const isAccept = action === 'accept'
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 500 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
          {isAccept ? (isNl ? 'Aangifte accepteren' : 'Accept submission') : (isNl ? 'Aangifte betwisten' : 'Dispute submission')}
        </h3>
        <p style={{ fontSize: 12.5, color: '#9090a0', marginBottom: 16 }}>
          {submission.reference} · {submission.organisation?.name} · SRD {fmtSrd(submission.total_btw_srd)} BTW
        </p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          {isAccept
            ? (isNl ? 'Opmerking (optioneel)' : 'Note (optional)')
            : (isNl ? 'Reden voor betwisting (verplicht)' : 'Reason for dispute (required)') + ' *'}
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
          placeholder={isAccept ? (isNl ? 'bv. Geverifieerd tegen bankafschrift.' : 'e.g. Verified against bank statement.') : (isNl ? 'bv. Totalen komen niet overeen met aanvullende Z-rapporten.' : 'e.g. Totals do not match supplementary Z-reports.')}
          style={{ ...inputSt, fontFamily: 'inherit', resize: 'vertical', marginBottom: 14 }} />

        {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || (!isAccept && note.length < 5)}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: isAccept ? 'linear-gradient(135deg,#16a34a,#15803d)' : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mut.isPending ? 0.5 : 1 }}>
            {mut.isPending ? '…' : isAccept ? (isNl ? '✓ Accepteren' : '✓ Accept') : (isNl ? '⚠ Betwisten' : '⚠ Dispute')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Resubmit modal (OA / SM — own org only) ────────────────────────────────

function ResubmitModal({ submission, isNl, onClose, onResubmitted }: { submission: BtwSubmission; isNl: boolean; onClose: () => void; onResubmitted: (s: BtwSubmission) => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => supersedeBtwSubmission(submission.id, note || undefined),
    onSuccess: (s) => { qc.invalidateQueries({ queryKey: ['btw-submissions'] }); onResubmitted(s) },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Resubmit failed'),
  })

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 520 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
          {isNl ? 'Aangifte corrigeren' : 'Correct submission'}
        </h3>
        <p style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 14 }}>
          {submission.reference} · {fmtDate(submission.period_start)}{submission.period_start !== submission.period_end ? ` → ${fmtDate(submission.period_end)}` : ''}
        </p>
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
          {isNl
            ? 'Het origineel wordt gemarkeerd als "vervangen". Er wordt een nieuwe aangifte aangemaakt voor dezelfde periode met opnieuw berekende totalen (inclusief eventuele voids/refunds sinds de eerste indiening).'
            : 'The original will be marked "superseded". A fresh submission is created for the same period with recomputed totals (including any voids/refunds since the first filing).'}
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          {isNl ? 'Reden voor correctie (aanbevolen)' : 'Reason for correction (recommended)'}
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000}
          placeholder={isNl ? 'bv. Laat-ingekomen kassabon meegenomen.' : 'e.g. Late-arriving receipt included.'}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />

        {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mut.isPending ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? '↺ Opnieuw indienen' : '↺ Resubmit')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Org filter dropdown (cross-org users) ──────────────────────────────────

function OrgFilterDropdown({ value, onChange, isNl }: { value: string; onChange: (v: string) => void; isNl: boolean }) {
  const { data: orgs = [] } = useQuery({
    queryKey: ['organisations-for-btw-filter'],
    queryFn:  getOrganisations,
    staleTime: 5 * 60_000,
  })
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={filterSelectSt}
      title={isNl ? 'Filter op organisatie' : 'Filter by organisation'}>
      <option value="">{isNl ? 'Alle organisaties' : 'All organisations'}</option>
      {(orgs as Array<{ id: string; name: string }>).map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

interface Props {
  /** Task #82 — caller (DashboardLayout) routes to the detail screen. */
  onOpenDetail?: (id: string) => void
  /** Initial filter overrides — used when the Tax Inspector Dashboard
   *  click-throughs land on this screen pre-filtered. */
  initialFilter?: { status?: BtwSubmissionStatus; organisation_id?: string }
}

export default function BtwSubmissionsScreen({ onOpenDetail, initialFilter }: Props = {}) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user = useDashboardAuthStore((s) => s.user)
  const role = user?.role ?? ''
  const isInspector = role === 'tax_inspector'
  const canSubmit = role === 'organisation_admin' || role === 'store_manager'
  const canReview = role === 'tax_inspector' || role === 'super_admin'

  const qc = useQueryClient()
  const [statusFilter,    setStatusFilter]    = useState<BtwSubmissionStatus | ''>(initialFilter?.status ?? '')
  const [periodFilter,    setPeriodFilter]    = useState<BtwSubmissionPeriodType | ''>('')
  const [orgFilter,       setOrgFilter]       = useState<string>(initialFilter?.organisation_id ?? '')
  const [sourceFilter,    setSourceFilter]    = useState<'pos' | 'api' | ''>('')
  const [yearFilter,      setYearFilter]      = useState<string>('')
  const [minAmount,       setMinAmount]       = useState<string>('')
  const [sortBy,          setSortBy]          = useState<'newest' | 'oldest' | 'amount_desc' | 'amount_asc'>('newest')
  const [searchInput,     setSearchInput]     = useState('')
  const [showSubmit,      setShowSubmit]      = useState(false)
  const [reviewTarget,    setReviewTarget]    = useState<{ submission: BtwSubmission; action: 'accept' | 'dispute' } | null>(null)
  const [resubmitTarget,  setResubmitTarget]  = useState<BtwSubmission | null>(null)
  const [successBanner,   setSuccessBanner]   = useState<BtwSubmission | null>(null)
  // Inspector multi-select for bulk accept (filed rows only).
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set())
  const [bulkBanner,      setBulkBanner]      = useState<string | null>(null)
  // OA/SM can resubmit a filed/disputed filing in their own org. Inspector
  // and SA cannot — that would be forgery (backend enforces; this just
  // hides the button to avoid 403 on click).
  function canResubmit(s: BtwSubmission): boolean {
    if (!canSubmit) return false
    if (user?.organisation_id !== s.organisation_id) return false
    return s.status === 'filed' || s.status === 'disputed'
  }

  const { data: page, isLoading } = useQuery({
    queryKey: ['btw-submissions', { statusFilter, periodFilter, orgFilter, sourceFilter, yearFilter, minAmount, sortBy, searchInput }],
    queryFn: () => listBtwSubmissions({
      status: statusFilter || undefined,
      period_type: periodFilter || undefined,
      organisation_id: orgFilter || undefined,
      source: sourceFilter || undefined,
      year: yearFilter ? Number(yearFilter) : undefined,
      min_amount: minAmount ? Number(minAmount) : undefined,
      sort: sortBy,
      search: searchInput.trim() || undefined,
      per_page: 50,
    } as Record<string, unknown>),
  })

  // Selection helpers — only FILED rows can be bulk-accepted.
  const rows = page?.data ?? []
  const filedIds = rows.filter((r) => r.status === 'filed').map((r) => r.id)
  const allFiledSelected = filedIds.length > 0 && filedIds.every((id) => selectedIds.has(id))
  function toggleOne(id: string) {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllFiled() {
    setSelectedIds(allFiledSelected ? new Set() : new Set(filedIds))
  }
  const bulkMut = useMutation({
    mutationFn: () => bulkAcceptBtw([...selectedIds]),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['btw-submissions'] })
      qc.invalidateQueries({ queryKey: ['btw-inspector-dashboard'] })
      setBulkBanner(isNl
        ? `${r.accepted} aangifte(s) geaccepteerd${r.skipped ? `, ${r.skipped} overgeslagen` : ''}.`
        : `${r.accepted} submission(s) accepted${r.skipped ? `, ${r.skipped} skipped` : ''}.`)
      setSelectedIds(new Set())
    },
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1240, background: isInspector ? BD.paper : undefined, minHeight: isInspector ? '100%' : undefined }}>

      {/* Header — official for the inspector, plain for OA/SM */}
      {isInspector ? (
        <BelastingdienstHeader
          overline={isNl ? 'Republiek Suriname · Belastingdienst' : 'Republic of Suriname · Tax Authority'}
          title={isNl ? 'BTW-aangiftes' : 'BTW Submissions'}
          subtitle={isNl ? 'Alle aangiftes bij Belastingdienst Suriname, over alle organisaties.' : 'All BTW submissions to Belastingdienst Suriname, across all organisations.'}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
              {isNl ? 'BTW-aangiftes' : 'BTW Submissions'}
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              {isNl ? 'BTW-aangiftes voor uw organisatie. Dien dagelijks of maandelijks in.' : 'BTW submissions for your organisation. File daily or monthly.'}
            </p>
          </div>
          {canSubmit && (
            <button onClick={() => setShowSubmit(true)}
              style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,.3)' }}>
              + {isNl ? 'Nieuwe aangifte' : 'New submission'}
            </button>
          )}
        </div>
      )}

      {/* Success banner */}
      {successBanner && (
        <div style={{ marginBottom: 20, padding: '14px 18px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: 12 }}>
          <strong style={{ color: '#15803d' }}>✓ {isNl ? 'Aangifte ingediend' : 'Submission filed'}: </strong>
          <span style={{ color: '#15803d' }}>
            {successBanner.reference} — SRD {fmtSrd(successBanner.total_btw_srd)} BTW
          </span>
          <button onClick={() => setSuccessBanner(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', fontSize: 18 }}>×</button>
        </div>
      )}

      {/* Filters — contained toolbar: full-width search, then a horizontal row
          of labelled dropdowns. Cross-org users get the full set; OA/SM see a
          subset (org filter hidden — they only have their own org). */}
      {(() => {
        const hasActive = !!(statusFilter || periodFilter || orgFilter || sourceFilter || yearFilter || minAmount || sortBy !== 'newest' || searchInput)
        const fieldSt: React.CSSProperties = { flex: '1 1 160px', minWidth: 140 }
        const thisYear = new Date().getFullYear()
        const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3]
        return (
          <div style={{ background: '#fff', border: `1px solid ${BD.border}`, borderRadius: 14, padding: '16px 18px', marginBottom: 18, boxShadow: '0 1px 3px rgba(12,58,34,.05)' }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: BD.muted, pointerEvents: 'none', fontSize: 14 }}>🔍</span>
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                placeholder={isNl ? 'Zoek op referentie of organisatie…' : 'Search by reference or organisation…'}
                style={{ width: '100%', height: 44, padding: '0 14px 0 40px', border: `1.5px solid ${BD.border}`, borderRadius: 10, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', color: BD.ink }} />
            </div>

            {/* Dropdown row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'Status' : 'Status'}</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BtwSubmissionStatus | '')} style={filterSelectSt}>
                  <option value="">{isNl ? 'Alle statussen' : 'All statuses'}</option>
                  <option value="filed">{STATUS_STYLE.filed.label[isNl ? 'nl' : 'en']}</option>
                  <option value="accepted">{STATUS_STYLE.accepted.label[isNl ? 'nl' : 'en']}</option>
                  <option value="disputed">{STATUS_STYLE.disputed.label[isNl ? 'nl' : 'en']}</option>
                  <option value="superseded">{STATUS_STYLE.superseded.label[isNl ? 'nl' : 'en']}</option>
                </select>
              </div>
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'Periode' : 'Period'}</label>
                <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value as BtwSubmissionPeriodType | '')} style={filterSelectSt}>
                  <option value="">{isNl ? 'Alle periodes' : 'All periods'}</option>
                  <option value="daily">{isNl ? 'Dagelijks' : 'Daily'}</option>
                  <option value="monthly">{isNl ? 'Maandelijks' : 'Monthly'}</option>
                </select>
              </div>
              {(isInspector || role === 'super_admin') && (
                <div style={fieldSt}>
                  <label style={fieldLabelSt}>{isNl ? 'Organisatie' : 'Organisation'}</label>
                  <OrgFilterDropdown value={orgFilter} onChange={setOrgFilter} isNl={isNl} />
                </div>
              )}
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'POS-bron' : 'POS source'}</label>
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as 'pos' | 'api' | '')} style={filterSelectSt}
                  title={isNl ? 'Filter op POS-bron — Josbin of externe API' : 'Filter by source POS — Josbin or external API'}>
                  <option value="">{isNl ? 'Alle POS-bronnen' : 'All POS sources'}</option>
                  <option value="pos">{isNl ? 'Josbin POS' : 'Josbin POS'}</option>
                  <option value="api">{isNl ? 'Externe POS (API)' : 'External POS (API)'}</option>
                </select>
              </div>
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'Jaar' : 'Year'}</label>
                <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={filterSelectSt}>
                  <option value="">{isNl ? 'Alle jaren' : 'All years'}</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'Min. BTW (SRD)' : 'Min BTW (SRD)'}</label>
                <input type="number" inputMode="decimal" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${BD.border}`, fontSize: 13, color: BD.ink, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={fieldSt}>
                <label style={fieldLabelSt}>{isNl ? 'Sorteren' : 'Sort'}</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={filterSelectSt}>
                  <option value="newest">{isNl ? 'Nieuwste eerst' : 'Newest first'}</option>
                  <option value="oldest">{isNl ? 'Oudste eerst' : 'Oldest first'}</option>
                  <option value="amount_desc">{isNl ? 'BTW hoog → laag' : 'BTW high → low'}</option>
                  <option value="amount_asc">{isNl ? 'BTW laag → hoog' : 'BTW low → high'}</option>
                </select>
              </div>
              {hasActive && (
                <button onClick={() => { setStatusFilter(''); setPeriodFilter(''); setOrgFilter(''); setSourceFilter(''); setYearFilter(''); setMinAmount(''); setSortBy('newest'); setSearchInput('') }}
                  style={{ height: 42, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${BD.greenLine}`, background: BD.greenSoft, color: BD.green, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  ✗ {isNl ? 'Filters wissen' : 'Clear filters'}
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Bulk action bar — inspector only, when filed rows are selected */}
      {canReview && selectedIds.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '12px 18px', background: BD.greenDeep, borderRadius: 12, color: '#fff', boxShadow: '0 6px 18px rgba(12,58,34,.25)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>
            {selectedIds.size} {isNl ? 'geselecteerd' : 'selected'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
              {isNl ? 'Wissen' : 'Clear'}
            </button>
            <button onClick={() => bulkMut.mutate()} disabled={bulkMut.isPending}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: BD.gold, color: BD.greenDeep, cursor: 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkMut.isPending ? 0.6 : 1 }}>
              {bulkMut.isPending ? '…' : `✓ ${isNl ? 'Accepteer geselecteerde' : 'Accept selected'}`}
            </button>
          </div>
        </div>
      )}

      {/* Bulk result banner */}
      {bulkBanner && (
        <div style={{ marginBottom: 14, padding: '12px 16px', background: BD.greenSoft, border: `1px solid ${BD.greenLine}`, borderRadius: 10, color: BD.green, fontSize: 13, fontWeight: 600 }}>
          ✓ {bulkBanner}
          <button onClick={() => setBulkBanner(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: BD.green, fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9090a0' }}>{isNl ? 'Laden…' : 'Loading…'}</div>
        ) : (page?.data ?? []).length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9090a0' }}>
            {isNl ? 'Geen aangiftes gevonden.' : 'No submissions found.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isInspector ? BD.greenSoft : 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: `1px solid ${isInspector ? BD.greenLine : '#eeeef8'}` }}>
                {canReview && (
                  <th style={{ padding: '12px 8px 12px 16px', width: 38 }}>
                    <input type="checkbox" checked={allFiledSelected} disabled={filedIds.length === 0}
                      onChange={toggleAllFiled} title={isNl ? 'Selecteer alle ingediende' : 'Select all filed'}
                      style={{ width: 16, height: 16, cursor: filedIds.length ? 'pointer' : 'not-allowed', accentColor: BD.green }} />
                  </th>
                )}
                {[
                  isNl ? 'Referentie' : 'Reference',
                  isInspector || role === 'super_admin' ? (isNl ? 'Organisatie' : 'Organisation') : null,
                  isNl ? 'Periode' : 'Period',
                  isNl ? 'Verkopen' : 'Sales',
                  isNl ? 'BTW (SRD)' : 'BTW (SRD)',
                  'Status',
                  isNl ? 'Ingediend' : 'Submitted',
                  isNl ? 'Acties' : 'Actions',
                ].filter(Boolean).map((h) => (
                  <th key={h as string} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(page?.data ?? []).map((s, i) => {
                const ss = STATUS_STYLE[s.status]
                return (
                  <tr key={s.id}
                    onClick={() => onOpenDetail?.(s.id)}
                    style={{ borderBottom: i < (page!.data.length - 1) ? '1px solid #f3f3f8' : 'none', cursor: onOpenDetail ? 'pointer' : 'default', transition: 'background .12s' }}
                    onMouseEnter={(e) => { if (onOpenDetail) e.currentTarget.style.background = isInspector ? BD.greenSoft : 'rgba(124,58,237,.03)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    {canReview && (
                      <td style={{ padding: '14px 8px 14px 16px' }} onClick={(e) => e.stopPropagation()}>
                        {s.status === 'filed' ? (
                          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleOne(s.id)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: BD.green }} />
                        ) : (
                          <span style={{ display: 'inline-block', width: 16 }} />
                        )}
                      </td>
                    )}
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12.5, color: '#1c1c2e', fontWeight: 600 }}>{s.reference}</td>
                    {(isInspector || role === 'super_admin') && (
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>
                        {s.organisation?.name ?? '—'}
                      </td>
                    )}
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>
                      <div>{fmtDate(s.period_start)}{s.period_start !== s.period_end ? ` → ${fmtDate(s.period_end)}` : ''}</div>
                      <div style={{ fontSize: 11, color: '#9090a0' }}>{s.period_type === 'daily' ? (isNl ? 'dagelijks' : 'daily') : (isNl ? 'maandelijks' : 'monthly')}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>{s.sales_count}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: '#1c1c2e', fontWeight: 700 }}>
                      {fmtSrd(s.total_btw_srd)}
                      <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 500 }}>
                        {isNl ? 'van' : 'of'} {fmtSrd(s.total_sales_srd)}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}`, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.fg }} />
                        {ss.label[isNl ? 'nl' : 'en']}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#9090a0' }}>
                      {new Date(s.submitted_at).toLocaleString(isNl ? 'nl-NL' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      <div style={{ fontSize: 11 }}>{s.submitter?.name}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {canReview && s.status === 'filed' && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setReviewTarget({ submission: s, action: 'accept' }) }}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                              ✓ {isNl ? 'Accepteer' : 'Accept'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setReviewTarget({ submission: s, action: 'dispute' }) }}
                              style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                              ⚠ {isNl ? 'Betwist' : 'Dispute'}
                            </button>
                          </>
                        )}
                        {canResubmit(s) && (
                          <button onClick={(e) => { e.stopPropagation(); setResubmitTarget(s) }}
                            title={isNl ? 'Markeer als vervangen en dien een correctie in.' : 'Mark superseded and file a correction.'}
                            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                            ↺ {isNl ? 'Corrigeer' : 'Resubmit'}
                          </button>
                        )}
                        {!canReview && !canResubmit(s) && (
                          <span style={{ color: '#d1d5db', fontSize: 11.5 }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showSubmit && (
        <SubmitBtwModal isNl={isNl} onClose={() => setShowSubmit(false)} onSubmitted={(s) => { setShowSubmit(false); setSuccessBanner(s) }} />
      )}
      {reviewTarget && (
        <ReviewModal submission={reviewTarget.submission} action={reviewTarget.action} isNl={isNl} onClose={() => setReviewTarget(null)} />
      )}
      {resubmitTarget && (
        <ResubmitModal
          submission={resubmitTarget}
          isNl={isNl}
          onClose={() => setResubmitTarget(null)}
          onResubmitted={(s) => { setResubmitTarget(null); setSuccessBanner(s) }}
        />
      )}
    </div>
  )
}
