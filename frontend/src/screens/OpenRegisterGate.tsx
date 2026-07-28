import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useRegisterStore } from '@/store/registerStore'
import {
  getRegisters, getMySession, openRegister, closeRegister, reconcileSession,
  getYesterdayStatus,
  type Register, type YesterdayStatus,
} from '@/api/registers'
import { getStore } from '@/api/stores'
import apiClient from '@/api/client'
import type { Store } from '@/types/models'

const MANAGER_ROLES = ['store_manager', 'organisation_admin', 'super_admin']

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
        background: '#f5f5ff', color: '#003366', cursor: 'pointer', fontFamily: 'inherit',
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
  const logout  = useAuthStore(s => s.logout)
  const storeId = useSettingsStore(s => s.storeId)
  const setStoreId = useSettingsStore(s => s.setStoreId)
  const setSession = useRegisterStore(s => s.setSession)

  const [registers, setRegisters]       = useState<Register[]>([])
  const [selfHandover, setSelfHandover]  = useState(false)
  const [selected, setSelected]         = useState<Register | null>(null)
  const [float, setFloat]               = useState('0')
  const [loading, setLoading]           = useState(true)
  const [opening, setOpening]           = useState(false)
  const [error, setError]               = useState('')
  const [step, setStep]                 = useState<'pick' | 'float' | 'yesterday'>('pick')
  const [yStatus, setYStatus]           = useState<YesterdayStatus | null>(null)
  const [storeInfo, setStoreInfo]       = useState<Store | null>(null)
  const [count, setCount]               = useState('0')
  const [note, setNote]                 = useState('')
  const [closingStale, setClosingStale] = useState(false)
  const [refreshTick, setRefreshTick]   = useState(0)

  const isManager = MANAGER_ROLES.includes(user?.role ?? '')

  useEffect(() => {
    if (!storeId) return
    Promise.all([
      getRegisters(storeId),
      getMySession(storeId),
      getYesterdayStatus(storeId).catch(() => null),
      getStore(storeId).catch(() => null),
    ]).then(([regsRes, existing, ystat, store]) => {
      const regs = regsRes.registers
      setSelfHandover(regsRes.selfServiceHandover)
      setYStatus(ystat)
      setStoreInfo(store)

      // Morning recovery: sessions still open from a PREVIOUS day block the
      // new day — never silently resume one, route into the guided flow.
      // A manager also lands there when a system-closed session still needs
      // its drawer counted (skippable — reconciliation is a task, not a wall).
      if (ystat && (ystat.stale_sessions.length > 0
          || (MANAGER_ROLES.includes(user?.role ?? '') && ystat.unreconciled.length > 0))) {
        setRegisters(regs)
        setStep('yesterday')
        setCount('0'); setNote('')
        return
      }

      if (existing) {
        // Already have an open session (from today) — resume directly
        setSession(existing)
      } else {
        setRegisters(regs)
        setStep('pick') // leave the morning-recovery step once it's resolved
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
  }, [storeId, setStoreId, isNl, refreshTick])

  /** Manager closes yesterday's forgotten session with a real count. */
  async function handleCloseStale(sessionId: string, expected: string | null) {
    const counted = parseFloat(count) || 0
    const diff = expected !== null ? counted - parseFloat(expected) : 0
    if (Math.abs(diff) > 0.005 && note.trim() === '') {
      setError(isNl ? 'Een kasverschil vereist een korte toelichting.' : 'A cash difference needs a short note.')
      return
    }
    setClosingStale(true); setError('')
    try {
      await closeRegister(sessionId, counted, note.trim() || (isNl ? 'Ochtendafsluiting van gisteren' : 'Morning close of yesterday'))
      setCount('0'); setNote('')
      setRefreshTick(t => t + 1)   // refetch — next stale session or on to today
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? (isNl ? 'Afsluiten mislukt' : 'Close failed'))
    } finally {
      setClosingStale(false)
    }
  }

  /** Manager records the drawer count of a system-closed session. */
  async function handleReconcile(sessionId: string, expected: string | null) {
    const counted = parseFloat(count) || 0
    const diff = expected !== null ? counted - parseFloat(expected) : 0
    if (Math.abs(diff) > 0.005 && note.trim() === '') {
      setError(isNl ? 'Een kasverschil vereist een korte toelichting.' : 'A cash difference needs a short note.')
      return
    }
    setClosingStale(true); setError('')
    try {
      await reconcileSession(sessionId, counted, note.trim() || undefined)
      setCount('0'); setNote('')
      setRefreshTick(t => t + 1)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? (isNl ? 'Telling opslaan mislukt' : 'Saving the count failed'))
    } finally {
      setClosingStale(false)
    }
  }

  async function handleRetrySync(zReportId: string) {
    try {
      await apiClient.post(`/reports/z-report/${zReportId}/submit`)
      setRefreshTick(t => t + 1)
    } catch {
      setError(isNl ? 'Opnieuw versturen mislukt — wordt automatisch opnieuw geprobeerd.' : 'Retry failed — it will retry automatically.')
    }
  }

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
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #d9e1f1', borderTopColor: '#003366', animation: 'spin 0.8s linear infinite' }} />
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

      <div style={{ position: 'absolute', top: 18, right: 20, display: 'flex', gap: 8 }}>
        <button
          onClick={() => logout()}
          data-testid="gate-logout"
          style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.65)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ⎋ {isNl ? 'Uitloggen' : 'Log out'}
        </button>
        {Boolean((window as any).josbin_pos?.quit) && (
          <button
            onClick={() => (window as any).josbin_pos.quit()}
            data-testid="gate-exit-app"
            style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.65)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ⏻ {isNl ? 'Afsluiten' : 'Exit'}
          </button>
        )}
      </div>

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
            background: 'linear-gradient(135deg,#003366,#1f2a63)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0,51,102,.45)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
            </svg>
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px', marginBottom: 4 }}>
            {step === 'yesterday'
              ? (isNl ? 'Gisteren is nog niet afgesloten' : 'Yesterday was never closed')
              : step === 'pick'
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

        {/* Yesterday's sync didn't reach HQ — informative, never blocking */}
        {step !== 'float' && yStatus?.yesterday_zreport && yStatus.yesterday_zreport.sync_status !== 'synced' && (
          <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>{isNl ? 'Z-rapport van gisteren nog niet bij hoofdkantoor.' : "Yesterday's Z-report has not reached headquarters yet."}</span>
            {isManager && (
              <button onClick={() => handleRetrySync(yStatus.yesterday_zreport!.id)}
                style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(251,191,36,.4)', background: 'transparent', color: '#fde68a', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isNl ? 'Opnieuw versturen' : 'Retry now'}
              </button>
            )}
          </div>
        )}

        {/* Morning recovery: close yesterday's session / count a system-closed drawer */}
        {step === 'yesterday' && (() => {
          const stale = yStatus?.stale_sessions[0] ?? null
          const recon = !stale ? (yStatus?.unreconciled[0] ?? null) : null
          const target = stale ?? recon
          if (!target) return null // effect routes back to 'pick' on next fetch
          const expected = target.expected_cash
          const when = 'opened_at' in target ? target.opened_at : (target as { closed_at: string }).closed_at
          const managerName  = (storeInfo?.settings?.manager_name as string | undefined) || null
          const managerPhone = (storeInfo?.settings?.manager_phone as string | undefined) || null

          return (
            <div>
              <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, lineHeight: 1.5, color: '#fde68a' }}>
                {stale
                  ? (isNl
                      ? <>De kassa <b>{target.register_name ?? '—'}</b> van <b>{target.cashier_name ?? '—'}</b> staat nog open sinds <b>{when.slice(0, 16)}</b>. Vandaag kan pas beginnen als gisteren is afgesloten.</>
                      : <>Register <b>{target.register_name ?? '—'}</b> of <b>{target.cashier_name ?? '—'}</b> has been open since <b>{when.slice(0, 16)}</b>. Today can only start once yesterday is closed.</>)
                  : (isNl
                      ? <>De kassa <b>{target.register_name ?? '—'}</b> is vannacht automatisch afgesloten <b>zonder telling</b>. Tel de la en leg het bedrag vast.</>
                      : <>Register <b>{target.register_name ?? '—'}</b> was auto-closed overnight <b>without a count</b>. Count the drawer and record the amount.</>)}
              </div>

              {isManager ? (
                <div>
                  {expected !== null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: '9px 14px', marginBottom: 12, fontSize: 13 }}>
                      <span style={{ color: 'rgba(148,163,184,.7)' }}>{isNl ? 'Verwacht in de la' : 'Expected in drawer'}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 800, fontFamily: 'monospace' }}>SRD {parseFloat(expected).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', marginBottom: 12, border: '1.5px solid rgba(255,255,255,.1)' }}>
                    <p style={{ color: 'rgba(148,163,184,.5)', fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{isNl ? 'Geteld' : 'Counted'} · SRD</p>
                    <p style={{ color: '#f1f5f9', fontSize: 30, fontWeight: 900, fontFamily: 'monospace' }}>{parseFloat(count).toFixed(2)}</p>
                  </div>
                  <Numpad value={count} onChange={setCount} />
                  <input
                    type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder={isNl ? 'Toelichting (verplicht bij verschil)' : 'Note (required on a difference)'}
                    style={{ width: '100%', marginTop: 14, padding: '11px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    {recon && (
                      <button onClick={() => setStep('pick')}
                        style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {isNl ? 'Later' : 'Later'}
                      </button>
                    )}
                    <button
                      onClick={() => stale ? handleCloseStale(target.id, expected) : handleReconcile(target.id, expected)}
                      disabled={closingStale}
                      style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: closingStale ? 'not-allowed' : 'pointer', opacity: closingStale ? 0.6 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,51,102,.5)' }}>
                      {closingStale ? '…' : stale
                        ? (isNl ? 'Gisteren afsluiten' : 'Close yesterday')
                        : (isNl ? 'Telling vastleggen' : 'Record the count')}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'rgba(148,163,184,.7)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 18 }}>
                    {isNl
                      ? 'Alleen een manager kan dit afronden. Bel de manager en vraag om de kassa van gisteren af te sluiten.'
                      : 'Only a manager can complete this. Call the manager and ask them to close yesterday\'s register.'}
                  </p>
                  {managerPhone ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <a href={`tel:${managerPhone}`}
                        style={{ display: 'block', padding: '13px 0', borderRadius: 12, background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 15, fontWeight: 800, textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,51,102,.5)' }}>
                        📞 {isNl ? 'Bel' : 'Call'} {managerName ?? 'manager'} · {managerPhone}
                      </a>
                      <a href={`https://wa.me/${managerPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer"
                        style={{ display: 'block', padding: '11px 0', borderRadius: 12, border: '1px solid rgba(74,222,128,.35)', color: '#4ade80', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
                        WhatsApp
                      </a>
                    </div>
                  ) : (
                    <p style={{ color: '#fde68a', fontSize: 12.5 }}>
                      {isNl
                        ? 'Tip voor de beheerder: stel naam + telefoonnummer van de manager in bij Vestiging → Instellingen, dan staat hier voortaan een belknop.'
                        : "Tip for the admin: set the manager's name + phone under Store → Settings and a call button will appear here."}
                    </p>
                  )}
                  <button onClick={() => setRefreshTick(t => t + 1)}
                    style={{ marginTop: 16, padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isNl ? 'Manager klaar? Vernieuwen' : 'Manager done? Refresh'}
                  </button>
                  {/* A stale drawer on ONE register must not wall off the
                      whole store — any other openable register stays usable. */}
                  {registers.some(r => r.status === 'available' || (r.status === 'closed_today' && selfHandover)) && (
                    <button onClick={() => setStep('pick')}
                      data-testid="gate-other-register"
                      style={{ marginTop: 10, padding: '12px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxShadow: '0 4px 16px rgba(0,51,102,.5)' }}>
                      {isNl ? '→ Doorgaan op een andere kassa' : '→ Continue on another register'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Cashier info note: a drawer still needs the manager's count (non-blocking) */}
        {step === 'pick' && !isManager && (yStatus?.unreconciled.length ?? 0) > 0 && (
          <div style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: '#fde68a' }}>
            {isNl
              ? 'De la van gisteren is automatisch afgesloten en moet nog door de manager geteld worden. U kunt gewoon beginnen.'
              : "Yesterday's drawer was auto-closed and still needs the manager's count. You can start normally."}
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
            {/* Register status changes on the OTHER tills — a colleague closing
                their drawer, a manager force-closing one. Without this the
                cashier's only way to see that was to log out and back in. */}
            <button
              onClick={() => setRefreshTick(t => t + 1)}
              data-testid="btn-refresh-registers"
              style={{
                alignSelf: 'flex-end', marginBottom: 8,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.14)',
                borderRadius: 9, padding: '7px 13px',
                color: 'rgba(241,245,249,.85)', fontSize: 12.5, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ↻ {isNl ? 'Vernieuwen' : 'Refresh'}
            </button>

            {registers.map(r => {
              const isOpen        = r.status === 'open' || r.status === 'reopen_requested'
              const isClosedToday = r.status === 'closed_today'
              const isAvailable   = r.status === 'available'
              // Self-service handover (org policy): a closed register is
              // openable by the next shift — new session, own float.
              const disabled      = !(isAvailable || (isClosedToday && selfHandover))
              const subLine = isOpen
                ? (isNl ? `In gebruik door ${r.session?.cashier_name ?? '—'}` : `In use by ${r.session?.cashier_name ?? '—'}`)
                : isClosedToday
                  ? (selfHandover
                      ? (isNl
                          ? `Gesloten ${r.closed_today?.closed_at?.slice(11,16) ?? ''} door ${r.closed_today?.cashier_name ?? '—'} · volgende ploeg kan openen`
                          : `Closed ${r.closed_today?.closed_at?.slice(11,16) ?? ''} by ${r.closed_today?.cashier_name ?? '—'} · next shift can open`)
                      : (isNl
                          ? `Gesloten ${r.closed_today?.closed_at?.slice(11,16) ?? ''} door ${r.closed_today?.cashier_name ?? '—'} · vraag beheerder`
                          : `Closed ${r.closed_today?.closed_at?.slice(11,16) ?? ''} by ${r.closed_today?.cashier_name ?? '—'} · ask manager`))
                  : null
              const badge = isOpen
                ? { text: isNl ? 'Bezet' : 'Occupied', fg: '#f87171', bg: 'rgba(239,68,68,.1)', bd: 'rgba(239,68,68,.25)' }
                : isClosedToday
                  ? { text: isNl ? 'Gesloten' : 'Closed',   fg: '#fbbf24', bg: 'rgba(251,191,36,.1)', bd: 'rgba(251,191,36,.3)' }
                  : { text: isNl ? 'Beschikbaar' : 'Available', fg: '#4ade80', bg: 'rgba(34,197,94,.1)', bd: 'rgba(34,197,94,.25)' }
              const borderCol = disabled ? 'rgba(255,255,255,.06)' : 'rgba(0,51,102,.4)'
              const bgCol     = disabled ? 'rgba(255,255,255,.03)' : 'rgba(0,51,102,.1)'
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
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(0,51,102,.18)' }}
                  onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = 'rgba(0,51,102,.1)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,51,102,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            {!selfHandover && registers.length > 0 && registers.every(r => r.status === 'closed_today') && (
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
            <div style={{ background: 'rgba(0,51,102,.1)', border: '1px solid rgba(0,51,102,.25)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
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
                style={{ flex: 2, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: opening ? 'not-allowed' : 'pointer', opacity: opening ? 0.6 : 1, fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,51,102,.5)' }}>
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
