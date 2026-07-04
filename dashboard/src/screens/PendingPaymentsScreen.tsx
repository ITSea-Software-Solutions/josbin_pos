import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTableSort } from '@/lib/useTableSort'
import { listPendingPayments, confirmPendingPayment, type PendingPaymentSale } from '@/api/pendingPayments'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSrd(n: string | number) { return Number(n).toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(s: string) {
  return new Date(s).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}
function daysAgo(s: string): number {
  return Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000)
}

const METHOD_ICON: Record<string, string> = {
  bank_transfer: '🏦',
  mobile_transfer: '📱',
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({ sale, isNl, onClose }: { sale: PendingPaymentSale; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => confirmPendingPayment(sale.id, note || undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pending-payments'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Confirm failed'),
  })

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 500 }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>
          {isNl ? 'Betaling bevestigen' : 'Confirm payment'}
        </h3>
        <p style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 14 }}>
          {sale.sale_number} · {sale.payment_provider} · <strong>SRD {fmtSrd(sale.total_srd)}</strong>
        </p>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
          <div><strong>{isNl ? 'Referentie' : 'Reference'}:</strong> <span style={{ fontFamily: 'monospace' }}>{sale.payment_reference}</span></div>
          {sale.payment_sender_name && <div style={{ marginTop: 4 }}><strong>{isNl ? 'Betaler' : 'Payer'}:</strong> {sale.payment_sender_name}</div>}
          <div style={{ marginTop: 4 }}><strong>{isNl ? 'Aangemaakt' : 'Created'}:</strong> {fmtDate(sale.occurred_at)} ({daysAgo(sale.occurred_at)} {isNl ? 'dagen geleden' : 'days ago'})</div>
        </div>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          {isNl ? 'Opmerking (optioneel)' : 'Note (optional)'}
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
          placeholder={isNl ? 'bv. Gecontroleerd tegen DSB-afschrift d.d. 26-05-2026' : 'e.g. Verified against DSB statement 26-05-2026'}
          style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', marginBottom: 14 }} />

        {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f2f5fb', border: '1px solid #d9e1f1', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mut.isPending ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? '✓ Markeer als ontvangen' : '✓ Mark as received')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PendingPaymentsScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [target, setTarget] = useState<PendingPaymentSale | null>(null)

  const { data: page, isLoading } = useQuery({
    queryKey: ['pending-payments'],
    queryFn:  () => listPendingPayments({ per_page: 50 }),
    // Refresh every 30s — bank statements arrive periodically and we want
    // the queue to drain visibly as the OA confirms each one.
    refetchInterval: 30_000,
  })

  const rows = page?.data ?? []
  const totalPending = rows.reduce((a, s) => a + Number(s.total_srd), 0)

  // Column sort (shared hook → identical behaviour across all dashboard tables).
  const { sorted, sort, toggle, indicator } = useTableSort(rows, {
    sale_number: (s) => (s.sale_number ?? '').toLowerCase(),
    method:      (s) => s.payment_method ?? '',
    provider:    (s) => (s.payment_provider ?? '').toLowerCase(),
    reference:   (s) => (s.payment_reference ?? '').toLowerCase(),
    payer:       (s) => (s.payment_sender_name ?? '').toLowerCase(),
    amount:      (s) => Number(s.total_srd) || 0,
    date:        (s) => (s.occurred_at ? new Date(s.occurred_at).getTime() : null),
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Openstaande betalingen' : 'Pending Payments'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'Bank- en mobiele overschrijvingen die nog niet zijn bevestigd. Markeer als ontvangen zodra het bedrag op de bankrekening staat.'
            : 'Bank and mobile transfers awaiting confirmation. Mark as received once the amount lands in the bank account.'}
        </p>
      </div>

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24, maxWidth: 600 }}>
        <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#293371' }}>{rows.length}</div>
          <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 3, fontWeight: 500 }}>{isNl ? 'In afwachting' : 'Pending'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#16203a' }}>SRD {fmtSrd(totalPending)}</div>
          <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 3, fontWeight: 500 }}>{isNl ? 'Totaal openstaand' : 'Total pending'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: rows.some((s) => daysAgo(s.occurred_at) > 7) ? '#dc2626' : '#16a34a' }}>
            {rows.filter((s) => daysAgo(s.occurred_at) > 7).length}
          </div>
          <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 3, fontWeight: 500 }}>{isNl ? 'Ouder dan 7 dagen' : 'Older than 7 days'}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7e88a0' }}>{isNl ? 'Laden…' : 'Loading…'}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#7e88a0' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            {isNl ? 'Alles bevestigd — er staan geen overschrijvingen open.' : 'All clear — no pending transfers.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                {[
                  { key: 'sale_number', label: isNl ? 'Bon nr.' : 'Sale no.' },
                  { key: 'method',      label: isNl ? 'Methode' : 'Method' },
                  { key: 'provider',    label: isNl ? 'Aanbieder' : 'Provider' },
                  { key: 'reference',   label: isNl ? 'Referentie' : 'Reference' },
                  { key: 'payer',       label: isNl ? 'Betaler' : 'Payer' },
                  { key: 'amount',      label: isNl ? 'Bedrag' : 'Amount' },
                  { key: 'date',        label: isNl ? 'Datum' : 'Date' },
                ].map((h) => (
                  <th key={h.key} onClick={() => toggle(h.key)}
                    style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: 'pointer', userSelect: 'none' }}>
                    {h.label}
                    <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{indicator(h.key)}</span>
                  </th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{isNl ? 'Actie' : 'Action'}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const age = daysAgo(s.occurred_at)
                const ageColor = age > 14 ? '#dc2626' : age > 7 ? '#f59e0b' : '#7e88a0'
                return (
                  <tr key={s.id} style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f1f4fb' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12.5, color: '#16203a', fontWeight: 600 }}>{s.sale_number}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      {METHOD_ICON[s.payment_method] ?? '•'} {s.payment_method === 'bank_transfer' ? (isNl ? 'Overschrijving' : 'Bank transfer') : (isNl ? 'Mobiel' : 'Mobile')}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151', fontWeight: 600 }}>{s.payment_provider ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{s.payment_reference ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12.5, color: '#374151' }}>{s.payment_sender_name ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 13.5, color: '#16203a', fontWeight: 700 }}>SRD {fmtSrd(s.total_srd)}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: ageColor }}>
                      {fmtDate(s.occurred_at)}
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{age} {isNl ? 'd geleden' : 'd ago'}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button onClick={() => setTarget(s)}
                        style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        ✓ {isNl ? 'Bevestig' : 'Confirm'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {target && <ConfirmModal sale={target} isNl={isNl} onClose={() => setTarget(null)} />}
    </div>
  )
}
