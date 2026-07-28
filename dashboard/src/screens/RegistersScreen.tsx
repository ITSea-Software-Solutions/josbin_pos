import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getStoreSessions, approveReopen, getRegisters, createRegister, updateRegister, deleteRegister, clearClosedToday, closeSession,
  type RegisterSession, type Register,
} from '@/api/registers'
import type { Organisation } from '@/api/organisations'
import { getStores, type Store } from '@/api/stores'

// ─── Shared styles ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; color: string; border: string; dot: string; label_nl: string; label_en: string }> = {
  open:             { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label_nl: 'In gebruik',         label_en: 'In use' },
  closed:           { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', dot: '#d1d5db', label_nl: 'Gesloten',           label_en: 'Closed' },
  closed_today:     { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b', label_nl: 'Vandaag gesloten',   label_en: 'Closed today' },
  available:        { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label_nl: 'Beschikbaar',        label_en: 'Available' },
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
function CloseSessionModal({ register, isNl, onClose }: { register: Register; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const session = register.session

  const mut = useMutation({
    mutationFn: () => closeSession(session!.id, parseFloat(counted), note.trim() || undefined),
    onSuccess: (closed) => {
      qc.invalidateQueries({ queryKey: ['registers'] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      const d = parseFloat(String((closed as { discrepancy?: string }).discrepancy ?? '0'))
      if (d !== 0) {
        alert(isNl
          ? `Sessie gesloten. Kasverschil: SRD ${d.toFixed(2)} — vastgelegd in het schichtrapport.`
          : `Session closed. Cash difference: SRD ${d.toFixed(2)} — recorded on the shift report.`)
      }
      onClose()
    },
    onError: (e: unknown) => setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  const valid = counted.trim() !== '' && !isNaN(parseFloat(counted)) && parseFloat(counted) >= 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '26px 28px', width: 420, maxWidth: '94vw', boxShadow: '0 24px 64px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#16203a', margin: 0 }}>
            {isNl ? `Sessie sluiten — ${register.name}` : `Close session — ${register.name}`}
          </h3>
          <button onClick={onClose} style={{ background: '#f2f5fb', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>
        <p style={{ fontSize: 12.5, color: '#7e88a0', margin: '0 0 14px', lineHeight: 1.5 }}>
          {isNl
            ? `Open sinds ${session?.opened_at?.slice(11, 16) ?? '—'} door ${session?.cashier_name ?? '—'}. Tel de la en leg het bedrag vast — uw naam wordt bij de sluiting genoteerd.`
            : `Open since ${session?.opened_at?.slice(11, 16) ?? '—'} by ${session?.cashier_name ?? '—'}. Count the drawer and record the amount — your name is recorded on the close.`}
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 5 }}>
          {isNl ? 'Geteld in de la (SRD)' : 'Counted in the drawer (SRD)'} *
        </label>
        <input
          type="number" min="0" step="0.01" value={counted} autoFocus
          onChange={e => setCounted(e.target.value)}
          data-testid="close-session-counted"
          style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid #d9e1f1', padding: '0 12px', fontSize: 15, fontFamily: 'ui-monospace, monospace', boxSizing: 'border-box' }}
        />
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', margin: '12px 0 5px' }}>
          {isNl ? 'Toelichting (aanbevolen bij verschil)' : 'Note (recommended on a difference)'}
        </label>
        <input
          type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={isNl ? 'bijv. caissière ziek naar huis, la geteld door manager' : 'e.g. cashier went home sick, drawer counted by manager'}
          style={{ width: '100%', height: 40, borderRadius: 10, border: '1px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
        />
        {err && <p style={{ color: '#dc2626', fontSize: 12, margin: '10px 0 0' }}>{err}</p>}
        <button
          onClick={() => mut.mutate()}
          disabled={!valid || mut.isPending}
          data-testid="close-session-submit"
          style={{ marginTop: 16, width: '100%', height: 44, borderRadius: 12, border: 'none', background: valid ? 'linear-gradient(135deg,#003366,#1f2a63)' : '#e5e7eb', color: valid ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 800, cursor: valid && !mut.isPending ? 'pointer' : 'not-allowed' }}
        >
          {mut.isPending ? '…' : (isNl ? 'Sessie sluiten & telling vastleggen' : 'Close session & record count')}
        </button>
      </div>
    </div>
  )
}

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
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#16203a', marginBottom: 4 }}>
              {isNl ? 'Heropening beoordelen' : 'Review re-open request'}
            </h3>
            <p style={{ fontSize: 12.5, color: '#7e88a0' }}>
              {session.register_name ?? `Register ${session.register_number}`} · {session.cashier_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f2f5fb', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>

        {/* Request details */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 8 }}>
            {isNl ? 'Reden van verzoek' : 'Reason for request'}
          </p>
          <p style={{ fontSize: 13.5, color: '#16203a', lineHeight: 1.5 }}>"{session.reopen_reason}"</p>
          <p style={{ fontSize: 11, color: '#7e88a0', marginTop: 8 }}>
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
                <p style={{ fontSize: 10.5, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>{value}</p>
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
            style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mutation.isPending ? 0.5 : 1, boxShadow: '0 4px 14px rgba(0,51,102,.35)' }}>
            {mutation.isPending ? '…' : (isNl ? 'Goedkeuren' : 'Approve')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reopen-for-next-shift modal ──────────────────────────────────────────────
function ReopenRegisterModal({
  register, storeId, isNl, onClose,
}: { register: Register; storeId: string; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [forCashier, setForCashier] = useState('')
  const [error, setError] = useState('')

  const closedAt = register.closed_today?.closed_at
    ? new Date(register.closed_today.closed_at).toLocaleTimeString(isNl ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : '—'
  const closedBy = register.closed_today?.cashier_name ?? '—'

  const mutation = useMutation({
    mutationFn: () => clearClosedToday(register.id, reason.trim(), forCashier.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registers', storeId] })
      onClose()
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (isNl ? 'Fout opgetreden' : 'An error occurred'))
    },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #eef2fb' }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#16203a' }}>
            {isNl ? 'Kassa heropenen voor volgende ploeg' : 'Reopen register for next shift'}
          </h3>
          <p style={{ fontSize: 12, color: '#7e88a0', marginTop: 4 }}>{register.name}</p>
        </div>
        <div style={{ padding: '18px 24px 20px' }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 12.5, color: '#92400e', lineHeight: 1.55 }}>
            <strong>{isNl ? 'Eerder vandaag gesloten' : 'Closed earlier today'}</strong>
            <br />
            {isNl ? 'Om' : 'At'} {closedAt} {isNl ? 'door' : 'by'} <strong>{closedBy}</strong>.
            <br />
            {isNl
              ? 'Door te heropenen wordt de Z-Rapport-vergrendeling van deze kassa voor vandaag opgeheven, zodat een nieuwe sessie geopend kan worden. De oude sessie blijft afgesloten in het auditlogboek.'
              : 'Reopening clears the Z-Report lock on this register for today so a new session can be opened. The previous session stays closed in the audit log.'}
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>
          )}

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {isNl ? 'Reden voor heropening *' : 'Reason for reopening *'}
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={isNl
              ? 'Bijv.: avondploeg start, eerdere sluiting was per ongeluk, korte handover…'
              : 'E.g.: evening shift starting, earlier close was a mistake, brief handover…'}
            style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '10px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 14, marginBottom: 6 }}>
            {isNl ? 'Voor welke kassamedewerker? (optioneel)' : 'For which cashier? (optional)'}
          </label>
          <input
            value={forCashier}
            onChange={e => setForCashier(e.target.value)}
            placeholder={isNl ? 'Bijv.: Sandra (avondploeg)' : 'E.g.: Sandra (evening shift)'}
            style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 11, color: '#7e88a0', marginTop: 6 }}>
            {isNl
              ? 'Wordt vastgelegd in het auditlogboek samen met uw naam en het tijdstip.'
              : 'Recorded in the audit log together with your name and the timestamp.'}
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
            <button onClick={() => mutation.mutate()}
              disabled={reason.trim().length < 3 || mutation.isPending}
              style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (reason.trim().length < 3 || mutation.isPending) ? 0.5 : 1 }}>
              {mutation.isPending ? '…' : (isNl ? 'Heropenen' : 'Reopen')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add / deactivate note prompts ────────────────────────────────────────────
function NotePrompt({
  title, body, placeholder, confirmLabel, confirmColor, isNl, onCancel, onConfirm, required = false, busy,
}: {
  title: string; body?: string; placeholder: string; confirmLabel: string; confirmColor: string; isNl: boolean
  onCancel: () => void; onConfirm: (note: string) => void; required?: boolean; busy?: boolean
}) {
  const [note, setNote] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.35)', padding: '22px 24px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#16203a', marginBottom: body ? 6 : 14 }}>{title}</h3>
        {body && <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5 }}>{body}</p>}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
          {required ? (isNl ? 'Reden *' : 'Reason *') : (isNl ? 'Reden (optioneel)' : 'Reason (optional)')}
        </label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder={placeholder}
          style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '10px 12px', fontSize: 13, resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
        <p style={{ fontSize: 11, color: '#7e88a0', marginTop: 6 }}>
          {isNl ? 'Wordt vastgelegd in het auditlogboek.' : 'Recorded in the audit log.'}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => onConfirm(note.trim())}
            disabled={busy || (required && note.trim().length < 3)}
            style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: confirmColor, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (busy || (required && note.trim().length < 3)) ? 0.5 : 1 }}>
            {busy ? '…' : confirmLabel}
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
  const [reopenTarget, setReopenTarget] = useState<Register | null>(null)
  const [closeTarget, setCloseTarget] = useState<Register | null>(null)
  const [createNoteOpen, setCreateNoteOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<Register | null>(null)

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ['registers', storeId],
    queryFn: () => getRegisters(storeId),
    enabled: !!storeId,
  })

  const createMut = useMutation({
    mutationFn: (note: string | undefined) => createRegister(storeId, newName.trim(), note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registers', storeId] })
      setNewName(''); setError(''); setCreateNoteOpen(false)
    },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateRegister(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['registers', storeId] }); setEditId(null) },
  })

  const deactivateMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => deleteRegister(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['registers', storeId] })
      setDeactivateTarget(null)
    },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Add new register */}
      <div style={{ background: '#f4f6fc', border: '1px solid #e6ebf7', borderRadius: 14, padding: '18px 20px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#003366', marginBottom: 12 }}>
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
            onClick={() => setCreateNoteOpen(true)}
            disabled={newName.trim().length < 2 || createMut.isPending}
            style={{ height: 38, padding: '0 18px', borderRadius: 8, border: 'none', background: '#003366', color: '#fff', fontSize: 13, fontWeight: 700, cursor: newName.trim().length < 2 ? 'not-allowed' : 'pointer', opacity: newName.trim().length < 2 ? 0.5 : 1 }}
          >
            {createMut.isPending ? '…' : (isNl ? 'Toevoegen' : 'Add')}
          </button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#7e88a0' }}>
          {isNl
            ? 'De volgende stap vraagt een korte reden (optioneel) voor het auditlogboek.'
            : 'Next step asks for a short reason (optional) for the audit log.'}
        </p>
        {error && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>

      {/* Register list */}
      {isLoading ? (
        <p style={{ fontSize: 13, color: '#7e88a0', textAlign: 'center', padding: 20 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
      ) : registers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 14, border: '1px solid #e6ecf5' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏧</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{isNl ? 'Nog geen kassas aangemaakt' : 'No registers yet'}</p>
          <p style={{ fontSize: 12, color: '#7e88a0' }}>{isNl ? 'Voeg een kassa toe om te beginnen.' : 'Add a register above to get started.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(registers as Register[]).map(r => {
            const closedSub = r.status === 'closed_today' && r.closed_today
              ? (isNl
                  ? `Gesloten ${new Date(r.closed_today.closed_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} door ${r.closed_today.cashier_name ?? '—'}`
                  : `Closed ${new Date(r.closed_today.closed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} by ${r.closed_today.cashier_name ?? '—'}`)
              : r.status === 'open' && r.session
              ? (isNl ? `In gebruik door ${r.session.cashier_name ?? '—'}` : `In use by ${r.session.cashier_name ?? '—'}`)
              : null
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#003366', flexShrink: 0 }}>
                  {r.number}
                </div>
                {editId === r.id ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    autoFocus
                    style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 7, border: '1.5px solid #003366', fontSize: 13 }}
                  />
                ) : (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{r.name}</div>
                    {closedSub && <div style={{ fontSize: 11.5, color: '#7e88a0', marginTop: 2 }}>{closedSub}</div>}
                  </div>
                )}
                <StatusBadge status={r.status} isNl={isNl} />
                {editId === r.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => updateMut.mutate({ id: r.id, name: editName })}
                      disabled={editName.trim().length < 1}
                      style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: '#003366', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
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
                    {r.status === 'open' && r.session && (
                      <button
                        onClick={() => setCloseTarget(r)}
                        data-testid="btn-close-session"
                        title={isNl ? 'Sessie sluiten (la tellen)' : 'Close session (count drawer)'}
                        style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isNl ? 'Sluiten' : 'Close'}
                      </button>
                    )}
                    {r.status === 'closed_today' && (
                      <button
                        onClick={() => setReopenTarget(r)}
                        title={isNl ? 'Heropenen voor volgende ploeg' : 'Reopen for next shift'}
                        style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        ↻ {isNl ? 'Heropenen' : 'Reopen'}
                      </button>
                    )}
                    <button
                      onClick={() => { setEditId(r.id); setEditName(r.name) }}
                      title={isNl ? 'Hernoemen' : 'Rename'}
                      style={{ height: 30, width: 30, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', cursor: 'pointer', fontSize: 14 }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setDeactivateTarget(r)}
                      title={isNl ? 'Deactiveren' : 'Deactivate'}
                      disabled={r.status === 'open'}
                      style={{ height: 30, width: 30, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: r.status === 'open' ? 'not-allowed' : 'pointer', fontSize: 14, opacity: r.status === 'open' ? 0.4 : 1 }}
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {closeTarget && (
        <CloseSessionModal register={closeTarget} isNl={isNl} onClose={() => setCloseTarget(null)} />
      )}
      {reopenTarget && (
        <ReopenRegisterModal register={reopenTarget} storeId={storeId} isNl={isNl} onClose={() => setReopenTarget(null)} />
      )}
      {createNoteOpen && (
        <NotePrompt
          title={isNl ? `Kassa "${newName.trim()}" toevoegen` : `Add register "${newName.trim()}"`}
          body={isNl
            ? 'Korte aantekening — bijv. waarom u deze kassa toevoegt of waar hij staat.'
            : 'Short note — e.g. why you\'re adding this register or where it sits.'}
          placeholder={isNl ? 'Bijv.: extra kassa voor zaterdagdrukte' : 'E.g.: extra register for Saturday rush'}
          confirmLabel={isNl ? 'Kassa toevoegen' : 'Add register'}
          confirmColor="#003366"
          isNl={isNl}
          onCancel={() => setCreateNoteOpen(false)}
          onConfirm={(note) => createMut.mutate(note || undefined)}
          busy={createMut.isPending}
        />
      )}
      {deactivateTarget && (
        <NotePrompt
          title={isNl ? `Kassa "${deactivateTarget.name}" deactiveren?` : `Deactivate register "${deactivateTarget.name}"?`}
          body={isNl
            ? 'Een gedeactiveerde kassa verdwijnt uit de kassakeuze maar blijft in alle rapporten en het auditlogboek staan.'
            : 'A deactivated register disappears from the register picker but remains in all reports and the audit log.'}
          placeholder={isNl ? 'Bijv.: kapot, vervangen door nieuwe kassa…' : 'E.g.: broken, replaced by new register…'}
          confirmLabel={isNl ? 'Deactiveren' : 'Deactivate'}
          confirmColor="#dc2626"
          isNl={isNl}
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={(note) => deactivateMut.mutate({ id: deactivateTarget.id, note: note || undefined })}
          busy={deactivateMut.isPending}
        />
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

  // Column sort (shared hook → identical behaviour across all dashboard tables).
  const { sorted: sortedSessions, sort, toggle: toggleSort, indicator } = useTableSort(sessions, {
    register:    (s) => (s.register_name ?? (s.register_number != null ? `Register ${s.register_number}` : '')).toLowerCase(),
    cashier:     (s) => (s.cashier_name ?? '').toLowerCase(),
    status:      (s) => (s.status ?? '').toLowerCase(),
    float:       (s) => Number(s.opening_float) || 0,
    expected:    (s) => (s.expected_cash != null ? Number(s.expected_cash) || 0 : null),
    counted:     (s) => (s.closing_cash_counted != null ? Number(s.closing_cash_counted) || 0 : null),
    discrepancy: (s) => (s.discrepancy != null ? Number(s.discrepancy) || 0 : null),
    opened:      (s) => (s.opened_at ? new Date(s.opened_at).getTime() : null),
    closed:      (s) => (s.closed_at ? new Date(s.closed_at).getTime() : null),
  })

  const noStore = !selectedStoreId

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Kassabeheer' : 'Register Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Bekijk en beheer kassasessies. Goedkeuren van heropeningen.' : 'View and manage register sessions. Approve re-open requests.'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #e6ecf5' }}>
        {([
          { key: 'sessions', nl: 'Kassasessies', en: 'Register Sessions' },
          { key: 'manage',   nl: 'Kassas beheren', en: 'Manage Registers' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? '#003366' : '#6b7280',
              borderBottom: activeTab === t.key ? '2px solid #003366' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {isNl ? t.nl : t.en}
          </button>
        ))}
      </div>

      {/* Shared org + store selector (visible on both tabs, for every role) */}
      <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
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
          <span style={{ fontSize: 12, color: '#7e88a0' }}>
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
      <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
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
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#16203a', marginBottom: 6 }}>
            {isNl ? 'Kies een vestiging' : 'Choose a store'}
          </p>
          <p style={{ fontSize: 13, color: '#7e88a0' }}>
            {isNl ? 'Selecteer een organisatie en vestiging om kassasessies te bekijken.' : 'Select an organisation and store to view register sessions.'}
          </p>
        </div>
      )}

      {/* Sessions table */}
      {!noStore && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #f1f4fb' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eef2fb' }} />
                  <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#eef2fb', maxWidth: 180 }} />
                  <div style={{ width: 90, height: 22, borderRadius: 11, background: '#f2f5fb' }} />
                  <div style={{ width: 70, height: 22, borderRadius: 11, background: '#eef2fb' }} />
                </div>
              ))}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                  {[
                    { key: 'register',    label: isNl ? 'Kassa' : 'Register' },
                    { key: 'cashier',     label: isNl ? 'Kassier' : 'Cashier' },
                    { key: 'status',      label: isNl ? 'Status' : 'Status' },
                    { key: 'float',       label: isNl ? 'Opening float' : 'Opening float' },
                    { key: 'expected',    label: isNl ? 'Verwacht' : 'Expected' },
                    { key: 'counted',     label: isNl ? 'Geteld' : 'Counted' },
                    { key: 'discrepancy', label: isNl ? 'Verschil' : 'Discrepancy' },
                    { key: 'opened',      label: isNl ? 'Geopend' : 'Opened' },
                    { key: 'closed',      label: isNl ? 'Gesloten' : 'Closed' },
                    { key: null,          label: isNl ? 'Actie' : 'Action' },
                  ].map(h => (
                    <th key={h.label} onClick={h.key ? () => toggleSort(h.key as string) : undefined}
                      style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                      {h.label}
                      {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#003366' : '#c0c0cc' }}>{indicator(h.key)}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((s, i) => {
                  const disc = s.discrepancy ? parseFloat(s.discrepancy) : null
                  const discColor = disc === null ? '#6b7280' : disc < 0 ? '#dc2626' : disc > 0 ? '#16a34a' : '#6b7280'
                  return (
                    <tr key={s.id}
                      style={{ borderBottom: i < sortedSessions.length - 1 ? '1px solid #f1f4fb' : 'none', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,51,102,.025)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#003366' }}>
                            {s.register_number ?? '?'}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#16203a' }}>{s.register_name ?? `Register ${s.register_number}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#16203a' }}>{s.cashier_name}</p>
                        <p style={{ fontSize: 11, color: '#7e88a0' }}>{s.cashier_email}</p>
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
            <div style={{ padding: '11px 20px', borderTop: '1px solid #f1f4fb', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#7e88a0' }}>{sessions.length} {isNl ? 'sessies' : 'sessions'}</span>
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
