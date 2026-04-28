import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useRegisterStore } from '@/store/registerStore'
import {
  getRegisters, getMySession, openRegister,
  type Register,
} from '@/api/registers'

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
  const keys = ['7','8','9','4','5','6','1','2','3','C','0','.','⌫']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 260, margin: '0 auto' }}>
      {['7','8','9','4','5','6','1','2','3','C','0','.'].map(k => (
        <button key={k} onClick={() => press(k)} style={{
          height: 52, borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 18, fontWeight: 700,
          background: k === 'C' ? '#fef2f2' : '#f9fafb', color: k === 'C' ? '#dc2626' : '#1c1c2e',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .1s',
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(.95)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >{k}</button>
      ))}
      <button onClick={() => press('⌫')} style={{
        height: 52, borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 18, fontWeight: 700,
        background: '#f5f5ff', color: '#7c3aed', cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .1s', gridColumn: 'span 1',
      }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(.95)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      >⌫</button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OpenRegisterGate() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user    = useAuthStore(s => s.user)
  const storeId = useSettingsStore(s => s.storeId)
  const setSession = useRegisterStore(s => s.setSession)

  const [registers, setRegisters]       = useState<Register[]>([])
  const [selected, setSelected]         = useState<Register | null>(null)
  const [float, setFloat]               = useState('0')
  const [loading, setLoading]           = useState(true)
  const [opening, setOpening]           = useState(false)
  const [error, setError]               = useState('')
  const [step, setStep]                 = useState<'pick' | 'float'>('pick')

  useEffect(() => {
    if (!storeId) return
    Promise.all([
      getRegisters(storeId),
      getMySession(storeId),
    ]).then(([regs, existing]) => {
      if (existing) {
        // Already have an open session — resume directly
        setSession(existing)
      } else {
        setRegisters(regs)
      }
    }).catch(() => setError(isNl ? 'Kon kassa\'s niet laden' : 'Could not load registers'))
      .finally(() => setLoading(false))
  }, [storeId])

  async function handleOpen() {
    if (!selected) return
    setOpening(true); setError('')
    try {
      const session = await openRegister(selected.id, parseFloat(float) || 0)
      setSession(session)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? (isNl ? 'Kassa openen mislukt' : 'Failed to open register'))
    } finally {
      setOpening(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f8', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e0e0ed', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#9090a0', fontSize: 14 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1c1c2e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", padding: 24,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,.045)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,.09)', borderRadius: 24,
        padding: '36px 40px', width: '100%', maxWidth: 440,
        boxShadow: '0 32px 80px rgba(0,0,0,.5)',
        animation: 'fadeUp .4s ease both',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(124,58,237,.45)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
            </svg>
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4 }}>
            {step === 'pick'
              ? (isNl ? 'Kies een kassa' : 'Choose a register')
              : (isNl ? 'Openingsbedrag' : 'Opening float')}
          </h2>
          <p style={{ color: 'rgba(148,163,184,.6)', fontSize: 13 }}>
            {isNl ? `Welkom, ${user?.name?.split(' ')[0]}` : `Welcome, ${user?.name?.split(' ')[0]}`}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#fca5a5', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Step 1: Pick register */}
        {step === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {registers.length === 0 && (
              <p style={{ color: 'rgba(148,163,184,.5)', textAlign: 'center', fontSize: 13, padding: '20px 0' }}>
                {isNl ? 'Geen kassa\'s gevonden. Vraag de beheerder om kassa\'s aan te maken.' : 'No registers found. Ask the manager to create registers.'}
              </p>
            )}
            {registers.map(r => {
              const busy = r.status !== 'closed' && r.session?.cashier_id !== user?.id
              return (
                <button key={r.id} onClick={() => { if (!busy) { setSelected(r); setStep('float') } }}
                  disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 14,
                    border: `1.5px solid ${busy ? 'rgba(255,255,255,.06)' : 'rgba(124,58,237,.4)'}`,
                    background: busy ? 'rgba(255,255,255,.03)' : 'rgba(124,58,237,.1)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    opacity: busy ? 0.5 : 1, transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(124,58,237,.18)' }}
                  onMouseLeave={e => { if (!busy) e.currentTarget.style.background = 'rgba(124,58,237,.1)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(124,58,237,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#a78bfa', fontSize: 15, fontWeight: 800 }}>{r.number}</span>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                      {busy && <div style={{ color: 'rgba(148,163,184,.5)', fontSize: 11, marginTop: 1 }}>
                        {isNl ? `In gebruik door ${r.session?.cashier_name ?? '—'}` : `In use by ${r.session?.cashier_name ?? '—'}`}
                      </div>}
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: r.status === 'closed' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                    color: r.status === 'closed' ? '#4ade80' : '#f87171',
                    border: `1px solid ${r.status === 'closed' ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
                  }}>
                    {r.status === 'closed' ? (isNl ? 'Beschikbaar' : 'Available') : (isNl ? 'Bezet' : 'Occupied')}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 2: Opening float */}
        {step === 'float' && selected && (
          <div>
            <div style={{ background: 'rgba(124,58,237,.1)', border: '1px solid rgba(124,58,237,.25)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              <span style={{ color: '#a78bfa', fontSize: 13, fontWeight: 700 }}>{selected.name}</span>
            </div>

            {/* Float display */}
            <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 14, padding: '16px 20px', textAlign: 'center', marginBottom: 20, border: '1.5px solid rgba(255,255,255,.1)' }}>
              <p style={{ color: 'rgba(148,163,184,.5)', fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>
                SRD
              </p>
              <p style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 900, letterSpacing: '-1px', fontFamily: 'monospace' }}>
                {parseFloat(float).toFixed(2)}
              </p>
              <p style={{ color: 'rgba(148,163,184,.4)', fontSize: 11, marginTop: 4 }}>
                {isNl ? 'Wissel in de la' : 'Starting cash in drawer'}
              </p>
            </div>

            <Numpad value={float} onChange={setFloat} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setStep('pick'); setFloat('0'); setError('') }}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isNl ? 'Terug' : 'Back'}
              </button>
              <button onClick={handleOpen} disabled={opening}
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: opening ? 'not-allowed' : 'pointer', opacity: opening ? 0.6 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(124,58,237,.5)' }}>
                {opening ? '…' : (isNl ? 'Kassa openen' : 'Open register')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ color: 'rgba(148,163,184,.2)', fontSize: 11, marginTop: 20 }}>
        Josbin POS · {isNl ? 'Kassa beheer' : 'Register management'}
      </p>
    </div>
  )
}
