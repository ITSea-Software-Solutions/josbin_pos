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
      {keys.map(k => (
        <button key={k} onClick={() => press(k)} style={{
          height: 52, borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 18, fontWeight: 700,
          background: k === 'C' ? '#fef2f2' : '#f9fafb', color: k === 'C' ? '#dc2626' : '#16203a',
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)', transition: 'all .1s',
        }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(.95)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >{k}</button>
      ))}
      <button onClick={() => press('⌫')} style={{
        height: 52, borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 18, fontWeight: 700,
        background: '#f5f5ff', color: '#293371', cursor: 'pointer', fontFamily: 'inherit',
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
  const setStoreId = useSettingsStore(s => s.setStoreId)
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
        // Auto-pick only when exactly one register is *openable* — don't
        // auto-pick a closed-today register, the cashier would be stuck.
        const openable = regs.filter(r => r.status === 'available')
        if (openable.length === 1) {
          setSelected(openable[0])
          setStep('float')
        }
      }
    }).catch((e: unknown) => {
      // 422 from the StoreBelongsToOrg rule means the persisted storeId is
      // not a store in the current user's org — usually because the user
      // switched backends (live ↔ demo) or was re-org'd. Reset the store
      // so App.tsx routes them back to StoreSelectScreen instead of being
      // stuck on "Could not load registers".
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 422 || status === 403 || status === 404) {
        setStoreId(null)
        return
      }
      setError(isNl ? 'Kon kassa\'s niet laden' : 'Could not load registers')
    })
      .finally(() => setLoading(false))
  }, [storeId, setStoreId, isNl])

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f2f5fb', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #d9e1f1', borderTopColor: '#293371', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: '#7e88a0', fontSize: 14 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #16203a 100%)',
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
            background: 'linear-gradient(135deg,#293371,#1f2a63)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(41,51,113,.45)',
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
              const isOpen        = r.status === 'open' || r.status === 'reopen_requested'
              const isClosedToday = r.status === 'closed_today'
              const isAvailable   = r.status === 'available'
              const disabled      = !isAvailable
              const subLine = isOpen
                ? (isNl ? `In gebruik door ${r.session?.cashier_name ?? '—'}` : `In use by ${r.session?.cashier_name ?? '—'}`)
                : isClosedToday
                  ? (isNl
                      ? `Gesloten ${r.closed_today?.closed_at?.slice(11,16) ?? ''} door ${r.closed_today?.cashier_name ?? '—'} · vraag beheerder`
                      : `Closed ${r.closed_today?.closed_at?.slice(11,16) ?? ''} by ${r.closed_today?.cashier_name ?? '—'} · ask manager`)
                  : null
              const badge = isOpen
                ? { text: isNl ? 'Bezet' : 'Occupied', fg: '#f87171', bg: 'rgba(239,68,68,.1)', bd: 'rgba(239,68,68,.25)' }
                : isClosedToday
                  ? { text: isNl ? 'Gesloten' : 'Closed',   fg: '#fbbf24', bg: 'rgba(251,191,36,.1)', bd: 'rgba(251,191,36,.3)' }
                  : { text: isNl ? 'Beschikbaar' : 'Available', fg: '#4ade80', bg: 'rgba(34,197,94,.1)', bd: 'rgba(34,197,94,.25)' }
              const borderCol = disabled ? 'rgba(255,255,255,.06)' : 'rgba(41,51,113,.4)'
              const bgCol     = disabled ? 'rgba(255,255,255,.03)' : 'rgba(41,51,113,.1)'
              return (
                <button key={r.id} onClick={() => { if (!disabled) { setSelected(r); setStep('float') } }}
                  disabled={disabled}
                  title={subLine ?? undefined}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderRadius: 14,
                    border: `1.5px solid ${borderCol}`,
                    background: bgCol,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.55 : 1, transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(41,51,113,.18)' }}
                  onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'rgba(41,51,113,.1)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(41,51,113,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#8f9ac9', fontSize: 15, fontWeight: 800 }}>{r.number}</span>
                    </div>
                    <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                      {subLine && <div style={{ color: 'rgba(148,163,184,.5)', fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subLine}
                      </div>}
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: badge.bg, color: badge.fg, border: `1px solid ${badge.bd}`, flexShrink: 0,
                  }}>
                    {badge.text}
                  </div>
                </button>
              )
            })}
            {registers.length > 0 && registers.every(r => r.status === 'closed_today') && (
              <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.5 }}>
                {isNl
                  ? 'Alle kassa\'s zijn vandaag al gesloten. Vraag uw beheerder om een nieuwe sessie te openen voor de volgende ploeg.'
                  : 'All registers have already been closed for today. Ask your manager to open a new session for the next shift.'}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Opening float */}
        {step === 'float' && selected && (
          <div>
            <div style={{ background: 'rgba(41,51,113,.1)', border: '1px solid rgba(41,51,113,.25)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8f9ac9" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
              <span style={{ color: '#8f9ac9', fontSize: 13, fontWeight: 700 }}>{selected.name}</span>
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
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#293371,#1f2a63)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: opening ? 'not-allowed' : 'pointer', opacity: opening ? 0.6 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(41,51,113,.5)' }}>
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
