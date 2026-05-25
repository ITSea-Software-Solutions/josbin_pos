import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRegisterStore } from '@/store/registerStore'
import { closeRegister, requestReopen, getSessionReport, type SessionReport } from '@/api/registers'

// ─── Numpad ───────────────────────────────────────────────────────────────────
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(k: string) {
    if (k === 'C') { onChange('0'); return }
    if (k === '⌫') { onChange(value.length > 1 ? value.slice(0, -1) : '0'); return }
    if (k === '.' && value.includes('.')) return
    if (value === '0' && k !== '.') { onChange(k); return }
    if (value.split('.')[1]?.length >= 2) return
    onChange(value + k)
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {['7','8','9','4','5','6','1','2','3','C','0','.'].map(k => (
        <button key={k} onClick={() => press(k)} style={{
          height: 46, borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 17, fontWeight: 700,
          background: k === 'C' ? '#fef2f2' : '#f9fafb', color: k === 'C' ? '#dc2626' : '#1c1c2e',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(.95)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >{k}</button>
      ))}
      <button onClick={() => press('⌫')} style={{
        height: 46, borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 17, fontWeight: 700,
        background: '#f5f5ff', color: '#7c3aed', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s',
      }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(.95)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >⌫</button>
    </div>
  )
}

function SRDRow({ label, value, highlight, discrepancy }: { label: string; value: string; highlight?: boolean; discrepancy?: boolean }) {
  const color = discrepancy
    ? (parseFloat(value) < 0 ? '#dc2626' : parseFloat(value) > 0 ? '#16a34a' : '#6b7280')
    : highlight ? '#7c3aed' : '#374151'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f3f8' }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: highlight ? 800 : 600, color }}>{value === null ? '—' : `SRD ${value}`}</span>
    </div>
  )
}

type Step = 'report' | 'count' | 'confirm' | 'closed' | 'reopen_request' | 'reopen_sent'

interface Props { onClose: () => void }

export default function CloseRegisterModal({ onClose }: Props) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const session    = useRegisterStore(s => s.session)
  const setSession = useRegisterStore(s => s.setSession)
  const clearSession = useRegisterStore(s => s.clearSession)

  const [step, setStep]           = useState<Step>('report')
  const [report, setReport]       = useState<SessionReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [counted, setCounted]     = useState('0')
  const [note, setNote]           = useState('')
  const [reopenReason, setReopenReason] = useState('')
  const [busy, setBusy]           = useState(false)
  const [error, setError]         = useState('')

  async function loadReport() {
    if (!session) return
    setLoadingReport(true)
    try {
      const r = await getSessionReport(session.id)
      setReport(r)
      setStep('report')
    } catch {
      setError(isNl ? 'Rapport laden mislukt' : 'Failed to load report')
    } finally {
      setLoadingReport(false)
    }
  }

  // Auto-load report when modal mounts
  useState(() => { loadReport() })

  async function handleClose() {
    if (!session) return
    setBusy(true); setError('')
    try {
      const updated = await closeRegister(session.id, parseFloat(counted), note || undefined)
      setSession(updated)
      setStep('closed')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? (isNl ? 'Sluiten mislukt' : 'Failed to close'))
    } finally {
      setBusy(false)
    }
  }

  async function handleReopenRequest() {
    if (!session || !reopenReason.trim()) return
    setBusy(true); setError('')
    try {
      const updated = await requestReopen(session.id, reopenReason)
      setSession(updated)
      setStep('reopen_sent')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? (isNl ? 'Verzoek mislukt' : 'Request failed'))
    } finally {
      setBusy(false)
    }
  }

  const discrepancy = report
    ? (parseFloat(counted) - parseFloat(report.expected_cash ?? counted)).toFixed(2)
    : null

  if (!session) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,.35)' }}>

        {/* Header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #f0f0f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
              {step === 'closed'   ? (isNl ? 'Kassa gesloten' : 'Register closed') :
               step === 'reopen_request' ? (isNl ? 'Heropening aanvragen' : 'Request re-open') :
               step === 'reopen_sent'    ? (isNl ? 'Verzoek ingediend' : 'Request submitted') :
               (isNl ? 'Kassa sluiten' : 'Close register')}
            </h3>
            <p style={{ fontSize: 12, color: '#9090a0', marginTop: 2 }}>
              {session.register_name ?? `Register ${session.register_number}`} · {session.cashier_name}
            </p>
          </div>
          {(step === 'closed' || step === 'reopen_sent') && (
            <button onClick={() => { if (step === 'closed') clearSession(); onClose() }}
              style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6b7280' }}>
              {isNl ? 'Sluiten' : 'Close'}
            </button>
          )}
        </div>

        <div style={{ padding: '20px 26px 26px' }}>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          {/* ── Step: Session report ── */}
          {step === 'report' && (
            <>
              {loadingReport ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e0e0ed', borderTopColor: '#7c3aed', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
                </div>
              ) : report && (
                <>
                  <div style={{ background: '#f9f7ff', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
                      {isNl ? 'Sessie samenvatting' : 'Session summary'}
                    </p>
                    <SRDRow label={isNl ? 'Openingsbedrag' : 'Opening float'} value={report.opening_float} />
                    <SRDRow label={isNl ? 'Transacties' : 'Transactions'} value={report.transaction_count.toString()} />
                    <SRDRow label={isNl ? 'Contante omzet' : 'Cash sales'} value={report.payment_breakdown.cash} />
                    <SRDRow label={isNl ? 'PIN/Kaart' : 'Card/PIN'} value={report.payment_breakdown.card} />
                    <SRDRow label={isNl ? 'Totale omzet' : 'Total revenue'} value={report.total_sales} highlight />
                    {report.void_count > 0 && (
                      <div style={{ marginTop: 8, padding: '6px 10px', background: '#fef9c3', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                        ⚠ {report.void_count} {isNl ? 'geannuleerde transacties' : 'voided transactions'}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setStep('count')} style={{ width: '100%', padding: '13px 0', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}>
                    {isNl ? 'Ga verder met kassasluiting' : 'Proceed to close register'} →
                  </button>
                </>
              )}
            </>
          )}

          {/* ── Step: Count cash ── */}
          {step === 'count' && (
            <>
              <div style={{ background: '#f9f7ff', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#9090a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
                  {isNl ? 'Verwacht in la' : 'Expected in drawer'}
                </p>
                <p style={{ fontSize: 26, fontWeight: 900, color: '#7c3aed' }}>SRD {report?.expected_cash ?? '—'}</p>
              </div>

              <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                {isNl ? 'Tel het geld en voer het bedrag in:' : 'Count the cash and enter the amount:'}
              </p>

              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px', textAlign: 'center', marginBottom: 16, border: `2px solid ${discrepancy && parseFloat(discrepancy) !== 0 ? '#fecaca' : '#e5e7eb'}` }}>
                <p style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>SRD</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: '#1c1c2e', fontFamily: 'monospace' }}>{parseFloat(counted).toFixed(2)}</p>
              </div>

              <Numpad value={counted} onChange={setCounted} />

              {discrepancy && parseFloat(discrepancy) !== 0 && (
                <div style={{ marginTop: 14, background: parseFloat(discrepancy) < 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${parseFloat(discrepancy) < 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: parseFloat(discrepancy) < 0 ? '#dc2626' : '#15803d' }}>
                    {parseFloat(discrepancy) < 0
                      ? (isNl ? 'Tekort' : 'Shortage')
                      : (isNl ? 'Overschot' : 'Surplus')}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: parseFloat(discrepancy) < 0 ? '#dc2626' : '#15803d' }}>
                    SRD {Math.abs(parseFloat(discrepancy)).toFixed(2)}
                  </span>
                </div>
              )}

              {(() => {
                const hasDiscrepancy = !!discrepancy && parseFloat(discrepancy) !== 0
                const noteMissing    = hasDiscrepancy && !note.trim()
                return (
                  <>
                    <div style={{ marginTop: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: noteMissing ? '#dc2626' : '#374151', display: 'block', marginBottom: 6 }}>
                        {isNl
                          ? (hasDiscrepancy ? 'Opmerking (verplicht bij verschil)' : 'Opmerking (optioneel)')
                          : (hasDiscrepancy ? 'Note (required when there is a discrepancy)' : 'Note (optional)')}
                      </label>
                      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                        placeholder={isNl ? 'Reden voor verschil…' : 'Reason for discrepancy…'}
                        style={{ width: '100%', borderRadius: 10, border: `1.5px solid ${noteMissing ? '#fca5a5' : '#e5e7eb'}`, padding: '8px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button onClick={() => setStep('report')} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid #e0e0ed', background: '#f5f5fb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {isNl ? 'Terug' : 'Back'}
                      </button>
                      <button onClick={() => setStep('confirm')} disabled={noteMissing}
                        title={noteMissing ? (isNl ? 'Vul een reden in voor het verschil' : 'Please enter a reason for the discrepancy') : undefined}
                        style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: noteMissing ? '#cbd5e1' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: noteMissing ? 'not-allowed' : 'pointer', boxShadow: noteMissing ? 'none' : '0 4px 14px rgba(124,58,237,.35)' }}>
                        {isNl ? 'Controleer en sluit' : 'Review and close'} →
                      </button>
                    </div>
                  </>
                )
              })()}
            </>
          )}

          {/* ── Step: Confirm close ── */}
          {step === 'confirm' && (
            <>
              <div style={{ background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>
                  {isNl ? 'Bevestig kassasluiting' : 'Confirm register close'}
                </p>
                <SRDRow label={isNl ? 'Verwacht' : 'Expected'} value={report?.expected_cash ?? '—'} />
                <SRDRow label={isNl ? 'Geteld' : 'Counted'} value={parseFloat(counted).toFixed(2)} />
                <SRDRow
                  label={isNl ? 'Verschil' : 'Discrepancy'}
                  value={discrepancy ?? '0.00'}
                  discrepancy
                />
                {note && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10 }}>"{note}"</p>}
              </div>

              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>
                {isNl
                  ? 'Na sluiting kan de kassa niet worden heropend zonder goedkeuring van de beheerder.'
                  : 'After closing, the register cannot be reopened without manager approval.'}
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('count')} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid #e0e0ed', background: '#f5f5fb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isNl ? 'Terug' : 'Back'}
                </button>
                <button onClick={handleClose} disabled={busy} style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, boxShadow: '0 4px 14px rgba(220,38,38,.35)' }}>
                  {busy ? '…' : (isNl ? 'Kassa definitief sluiten' : 'Close register now')}
                </button>
              </div>
            </>
          )}

          {/* ── Step: Closed confirmation ── */}
          {step === 'closed' && session && (
            <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e', marginBottom: 6 }}>
                {isNl ? 'Kassa gesloten' : 'Register closed'}
              </h4>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                {isNl
                  ? 'Bedankt voor uw shift. De gegevens zijn opgeslagen.'
                  : 'Thank you for your shift. Data has been saved.'}
              </p>
              {session.discrepancy && parseFloat(session.discrepancy) !== 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>
                  {isNl ? 'Verschil geregistreerd: ' : 'Discrepancy recorded: '}
                  SRD {Math.abs(parseFloat(session.discrepancy)).toFixed(2)}
                  {parseFloat(session.discrepancy) < 0 ? (isNl ? ' tekort' : ' short') : (isNl ? ' overschot' : ' surplus')}
                </div>
              )}
              <p style={{ fontSize: 12, color: '#9090a0', marginBottom: 20 }}>
                {isNl
                  ? 'Wilt u de kassa heropenen? Vraag uw beheerder om goedkeuring.'
                  : 'Need to re-open the register? Request manager approval.'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('reopen_request')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid #e0e0ed', background: '#f5f5fb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isNl ? 'Heropening aanvragen' : 'Request re-open'}
                </button>
                <button onClick={() => { clearSession(); onClose() }}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isNl ? 'Uitloggen' : 'Log out'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Reopen request ── */}
          {step === 'reopen_request' && (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
                {isNl
                  ? 'Geef een reden op waarom u de kassa wilt heropenen. De beheerder zal dit beoordelen.'
                  : 'Provide a reason for re-opening the register. The manager will review this.'}
              </p>
              <textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3}
                placeholder={isNl ? 'Reden voor heropening…' : 'Reason for re-opening…'}
                style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '10px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep('closed')} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid #e0e0ed', background: '#f5f5fb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {isNl ? 'Terug' : 'Back'}
                </button>
                <button onClick={handleReopenRequest} disabled={busy || !reopenReason.trim()}
                  style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy || !reopenReason.trim() ? 'not-allowed' : 'pointer', opacity: busy || !reopenReason.trim() ? 0.5 : 1 }}>
                  {busy ? '…' : (isNl ? 'Verzoek indienen' : 'Submit request')}
                </button>
              </div>
            </>
          )}

          {/* ── Step: Reopen request sent ── */}
          {step === 'reopen_sent' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: '#1c1c2e', marginBottom: 8 }}>
                {isNl ? 'Verzoek ingediend' : 'Request submitted'}
              </h4>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                {isNl
                  ? 'Uw beheerder heeft een melding ontvangen. U wordt op de hoogte gebracht zodra het verzoek is goedgekeurd.'
                  : 'Your manager has been notified. You will be informed once the request is approved.'}
              </p>
              <button onClick={onClose} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {isNl ? 'Sluiten' : 'Close'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
