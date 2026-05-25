import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getStoreSessions, approveReopen, getRegisters, createRegister, updateRegister, deleteRegister,
  type RegisterSession, type Register,
} from '@/api/registers'
import type { Organisation } from '@/api/organisations'
import { getStores, type Store } from '@/api/stores'

// ─── Shared styles ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; color: string; border: string; dot: string; label_nl: string; label_en: string }> = {
  open:             { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label_nl: 'Open',              label_en: 'Open' },
  closed:           { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', dot: '#d1d5db', label_nl: 'Gesloten',          label_en: 'Closed' },
  reopen_requested: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b', label_nl: 'Heropening gevraagd', label_en: 'Reopen requested' },
  reopen_approved:  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label_nl: 'Heropening goedgekeurd', label_en: 'Reopen approved' },
}

function StatusBadge({ status, isNl }: { status: string; isNl: boolean }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.closed
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {isNl ? cfg.label_nl : cfg.label_en}
    </span>
  )
}

function fmt(v: string | null) {
  if (!v) return '—'
  return `SRD ${parseFloat(v).toFixed(2)}`
}

function fmtTime(iso: string | null, isNl: boolean) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(isNl ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

// ─── Approve/Deny modal ───────────────────────────────────────────────────────
function ApproveReopenModal({ session, isNl, onClose }: { session: RegisterSession; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [denialReason, setDenialReason] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: ({ approved, reason }: { approved: boolean; reason?: string }) =>
      approveReopen(session.id, approved, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['register-sessions'] })
      onClose()
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Fout opgetreden' : 'An error occurred'))
    },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e', marginBottom: 4 }}>
              {isNl ? 'Heropening beoordelen' : 'Review re-open request'}
            </h3>
            <p style={{ fontSize: 12.5, color: '#9090a0' }}>
              {session.register_name ?? `Register ${session.register_number}`} · {session.cashier_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>

        {/* Request details */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
            {isNl ? 'Reden van verzoek' : 'Reason for request'}
          </p>
          <p style={{ fontSize: 13.5, color: '#1c1c2e', lineHeight: 1.5 }}>"{session.reopen_reason}"</p>
          <p style={{ fontSize: 11, color: '#9090a0', marginTop: 8 }}>
            {isNl ? 'Ingediend om' : 'Submitted at'} {fmtTime(session.reopen_requested_at, isNl)}
          </p>
        </div>

        {/* Session info */}
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: isNl ? 'Opening float' : 'Opening float', value: fmt(session.opening_float) },
              { label: isNl ? 'Verwacht in la' : 'Expected in drawer', value: fmt(session.expected_cash) },
              { label: isNl ? 'Geteld bij sluiting' : 'Counted at close', value: fmt(session.closing_cash_counted) },
              { label: isNl ? 'Verschil' : 'Discrepancy', value: session.discrepancy ? fmt(session.discrepancy) : '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 10.5, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e' }}>{value}</p>
              </div>
            ))}
          </div>
          {session.closing_note && (
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 10, fontStyle: 'italic' }}>"{session.closing_note}"</p>
          )}
        </div>

        {error && (
          <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>{error}</p>
        )}

        {/* Denial reason (shown when about to deny) */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {isNl ? 'Reden voor afwijzing (optioneel bij goedkeuring)' : 'Denial reason (optional if approving)'}
          </label>
          <textarea value={denialReason} onChange={e => setDenialReason(e.target.value)} rows={2}
            placeholder={isNl ? 'Reden voor afwijzing…' : 'Reason for denial…'}
            style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '8px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => mutation.mutate({ approved: false, reason: denialReason || undefined })}
            disabled={mutation.isPending}
            style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mutation.isPending ? 0.5 : 1 }}>
            {isNl ? 'Afwijzen' : 'Deny'}
          </button>
          <button
            onClick={() => mutation.mutate({ approved: true })}
            disabled={mutation.isPending}
            style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mutation.isPending ? 0.5 : 1, boxShadow: '0 4px 14px rgba(124,58,237,.35)' }}>
            {mutation.isPending ? '…' : (isNl ? 'Goedkeuren' : 'Approve')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Manage Registers panel ───────────────────────────────────────────────────
function ManageRegistersPanel({ storeId, isNl }: { storeId: string; isNl: boolean }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState('')

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ['registers', storeId],
    queryFn: () => getRegisters(storeId),
    enabled: !!storeId,
  })

  const createMut = useMutation({
    mutationFn: () => createRegister(storeId, newName.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registers', storeId] }); setNewName(''); setError('') },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateRegister(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registers', storeId] }); setEditId(null) },
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deleteRegister(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['registers', storeId] }),
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Add new register */}
      <div style={{ background: '#f8f7ff', border: '1px solid #ede9fe', borderRadius: 14, padding: '18px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 12 }}>
          {isNl ? '+ Nieuwe kassa toevoegen' : '+ Add new register'}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder={isNl ? 'Naam (bijv. "Kassa 1" of "Servicebalie")' : 'Name (e.g. "Register 1" or "Service desk")'}
            style={{ flex: 1, height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }}
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={newName.trim().length < 2 || createMut.isPending}
            style={{ height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: newName.trim().length < 2 ? 'not-allowed' : 'pointer', opacity: newName.trim().length < 2 ? 0.5 : 1 }}
          >
            {createMut.isPending ? '…' : (isNl ? 'Toevoegen' : 'Add')}
          </button>
        </div>
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>

      {/* Register list */}
      {isLoading ? (
        <p style={{ fontSize: 13, color: '#9090a0', textAlign: 'center', padding: 20 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
      ) : registers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏧</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{isNl ? 'Nog geen kassas aangemaakt' : 'No registers yet'}</p>
          <p style={{ fontSize: 12, color: '#9090a0' }}>{isNl ? 'Voeg een kassa toe om te beginnen.' : 'Add a register above to get started.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(registers as Register[]).map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#7c3aed', flexShrink: 0 }}>
                {r.number}
              </div>
              {editId === r.id ? (
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                  style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 7, border: '1.5px solid #7c3aed', fontSize: 13 }}
                />
              ) : (
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{r.name}</span>
              )}
              <StatusBadge status={r.status} isNl={isNl} />
              {editId === r.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, name: editName })}
                    disabled={editName.trim().length < 1}
                    style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {isNl ? 'Opslaan' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setEditId(r.id); setEditName(r.name) }}
                    title={isNl ? 'Hernoemen' : 'Rename'}
                    style={{ height: 30, width: 30, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', cursor: 'pointer', fontSize: 14 }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => { if (confirm(isNl ? 'Kassa deactiveren?' : 'Deactivate register?')) deactivateMut.mutate(r.id) }}
                    title={isNl ? 'Deactiveren' : 'Deactivate'}
                    disabled={r.status === 'open'}
                    style={{ height: 30, width: 30, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: r.status === 'open' ? 'not-allowed' : 'pointer', fontSize: 14, opacity: r.status === 'open' ? 0.4 : 1 }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RegistersScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore(s => s.isSuperAdmin())
  const currentUser  = useDashboardAuthStore(s => s.user)

  const [activeTab,        setActiveTab]        = useState<'sessions' | 'manage'>('sessions')
  const [selectedOrgId,   setSelectedOrgId]   = useState(isSuperAdmin ? '' : (currentUser?.organisation_id ?? ''))
  const [selectedStoreId, setSelectedStoreId] = useState('')

  // If the user object arrives after first render (Zustand hydration race),
  // sync selectedOrgId once. Super Admin keeps the empty string until they pick.
  useEffect(() => {
    if (!isSuperAdmin && currentUser?.organisation_id && !selectedOrgId) {
      setSelectedOrgId(currentUser.organisation_id)
    }
  }, [isSuperAdmin, currentUser, selectedOrgId])
  const [selectedDate,    setSelectedDate]    = useState(new Date().toISOString().split('T')[0])
  const [approveSession,  setApproveSession]  = useState<RegisterSession | null>(null)

  // The actual store_id we pass to every API call. Only ever a real store UUID
  // (never an organisation_id — that was the previous bug that broke the
  // Manage tab and made the Sessions tab return empty data).
  const effectiveStoreId = selectedStoreId

  // Super Admin needs to pick the organisation first; everyone else is locked
  // to their own org and gets the store dropdown immediately.
  const { data: orgs = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => import('@/api/organisations').then(m => m.getOrganisations()),
    enabled: isSuperAdmin,
  })

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', selectedOrgId],
    queryFn: () => getStores(selectedOrgId || undefined),
    enabled: !!selectedOrgId,
  })

  // Auto-pick the only store if there's exactly one — saves a click in the
  // common single-shop case for org-admin and store-manager.
  useEffect(() => {
    if (!selectedStoreId && stores.length === 1) {
      setSelectedStoreId((stores as Store[])[0].id)
    }
  }, [stores, selectedStoreId])

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['register-sessions', effectiveStoreId, selectedDate],
    queryFn: () => getStoreSessions(effectiveStoreId, selectedDate),
    enabled: !!effectiveStoreId,
    refetchInterval: 30_000,
  })

  // Stats
  const openCount    = sessions.filter(s => s.status === 'open').length
  const closedCount  = sessions.filter(s => s.status === 'closed').length
  const pendingCount = sessions.filter(s => s.status === 'reopen_requested').length

  const noStore = !selectedStoreId

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Kassabeheer' : 'Register Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Bekijk en beheer kassasessies. Goedkeuren van heropeningen.' : 'View and manage register sessions. Approve re-open requests.'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #e9e9ef' }}>
        {([
          { key: 'sessions', nl: 'Kassasessies', en: 'Register Sessions' },
          { key: 'manage',   nl: 'Kassas beheren', en: 'Manage Registers' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? '#7c3aed' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #7c3aed' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {isNl ? t.nl : t.en}
          </button>
        ))}
      </div>

      {/* Shared org + store selector (visible on both tabs, for every role) */}
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        {isSuperAdmin && (
          <select value={selectedOrgId} onChange={e => { setSelectedOrgId(e.target.value); setSelectedStoreId('') }}
            style={{ padding: '8px 32px 8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 200 }}>
            <option value="">{isNl ? '— Kies organisatie —' : '— Choose organisation —'}</option>
            {(orgs as Organisation[]).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
          disabled={!selectedOrgId}
          style={{ padding: '8px 32px 8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 200, opacity: !selectedOrgId ? 0.5 : 1 }}>
          <option value="">{isNl ? '— Kies vestiging —' : '— Choose store —'}</option>
          {(stores as Store[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {!selectedStoreId && (
          <span style={{ fontSize: 12, color: '#9090a0' }}>
            {isNl ? 'Kies een vestiging om kassas te beheren of sessies te bekijken.' : 'Pick a store to manage registers or view sessions.'}
          </span>
        )}
      </div>

      {/* Manage tab */}
      {activeTab === 'manage' && (
        selectedStoreId
          ? <ManageRegistersPanel storeId={selectedStoreId} isNl={isNl} />
          : <p style={{ color: '#6b7280', fontSize: 14 }}>{isNl ? 'Kies eerst een vestiging hierboven.' : 'Pick a store above first.'}</p>
      )}

      {activeTab === 'sessions' && (<>

      {/* Date + pending banner (org/store selector is now above the tabs) */}
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        {pendingCount > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
              {pendingCount} {isNl ? 'heropening(en) wacht op goedkeuring' : 'reopen request(s) pending'}
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {!noStore && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: isNl ? 'Open kassas' : 'Open registers',     value: openCount,    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
            { label: isNl ? 'Gesloten'    : 'Closed',             value: closedCount,  color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
            { label: isNl ? 'Wacht op goedkeuring' : 'Pending approval', value: pendingCount, color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '18px 22px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* No store selected */}
      {noStore && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1c1c2e', marginBottom: 6 }}>
            {isNl ? 'Kies een vestiging' : 'Choose a store'}
          </p>
          <p style={{ fontSize: 13, color: '#9090a0' }}>
            {isNl ? 'Selecteer een organisatie en vestiging om kassasessies te bekijken.' : 'Select an organisation and store to view register sessions.'}
          </p>
        </div>
      )}

      {/* Sessions table */}
      {!noStore && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #f3f3f8' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f0f8' }} />
                  <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#f0f0f8', maxWidth: 180 }} />
                  <div style={{ width: 90, height: 22, borderRadius: 11, background: '#f5f5fb' }} />
                  <div style={{ width: 70, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                  {[
                    isNl ? 'Kassa' : 'Register',
                    isNl ? 'Kassier' : 'Cashier',
                    isNl ? 'Status' : 'Status',
                    isNl ? 'Opening float' : 'Opening float',
                    isNl ? 'Verwacht' : 'Expected',
                    isNl ? 'Geteld' : 'Counted',
                    isNl ? 'Verschil' : 'Discrepancy',
                    isNl ? 'Geopend' : 'Opened',
                    isNl ? 'Gesloten' : 'Closed',
                    isNl ? 'Actie' : 'Action',
                  ].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const disc = s.discrepancy ? parseFloat(s.discrepancy) : null
                  const discColor = disc === null ? '#6b7280' : disc < 0 ? '#dc2626' : disc > 0 ? '#16a34a' : '#6b7280'
                  return (
                    <tr key={s.id}
                      style={{ borderBottom: i < sessions.length - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#f0f0f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>
                            {s.register_number ?? '?'}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e' }}>{s.register_name ?? `Register ${s.register_number}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#1c1c2e' }}>{s.cashier_name}</p>
                        <p style={{ fontSize: 11, color: '#9090a0' }}>{s.cashier_email}</p>
                      </td>
                      <td style={{ padding: '12px 14px' }}><StatusBadge status={s.status} isNl={isNl} /></td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmt(s.opening_float)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{fmt(s.expected_cash)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{fmt(s.closing_cash_counted)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: discColor }}>
                        {disc !== null ? (disc === 0 ? '—' : `${disc > 0 ? '+' : ''}SRD ${disc.toFixed(2)}`) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{fmtTime(s.opened_at, isNl)}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>{fmtTime(s.closed_at, isNl)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        {s.status === 'reopen_requested' ? (
                          <button onClick={() => setApproveSession(s)}
                            style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {isNl ? 'Beoordelen' : 'Review'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🏧</div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                        {isNl ? 'Geen kassasessies op deze datum' : 'No register sessions on this date'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {sessions.length > 0 && (
            <div style={{ padding: '11px 20px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#9090a0' }}>{sessions.length} {isNl ? 'sessies' : 'sessions'}</span>
            </div>
          )}
        </div>
      )}

      </>)}

      {approveSession && (
        <ApproveReopenModal session={approveSession} isNl={isNl} onClose={() => setApproveSession(null)} />
      )}
    </div>
  )
}
