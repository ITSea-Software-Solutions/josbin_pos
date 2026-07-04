import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getMySalesSummary, getMyShifts, updateMyProfile, changeMyPassword,
  getMyActivity, getMySessions, revokeMySession,
  type SalesWindow, type Shift,
} from '@/api/me'

type Tab = 'performance' | 'profile' | 'shifts' | 'activity' | 'sessions'

const ROLE_LABEL: Record<string, { nl: string; en: string }> = {
  super_admin:        { nl: 'Super Admin',         en: 'Super Admin' },
  organisation_admin: { nl: 'Organisatiebeheerder', en: 'Organisation Admin' },
  store_manager:      { nl: 'Winkelbeheerder',     en: 'Store Manager' },
  cashier:            { nl: 'Kassamedewerker',     en: 'Cashier' },
  auditor:            { nl: 'Controleur',          en: 'Auditor' },
  api_integration:    { nl: 'API-integratie',      en: 'API Integration' },
}

/**
 * Roles that actually ring up sales / open a register. Only those see
 * "My performance" + "My shifts" — everyone else (SA, OA, Auditor, API)
 * operates at the org level and has no sales/shifts of their own, so
 * showing those tabs to them would just render empty cards forever.
 */
const RINGS_UP_ROLES = ['cashier', 'store_manager'] as const

export default function MyAccountScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user = useDashboardAuthStore((s) => s.user)

  // Build the tab list per role BEFORE the useState so the initial tab
  // is one this role can actually see. Without this an SA lands on a
  // hidden "performance" tab and gets a blank page.
  const ringsUp = !!user && (RINGS_UP_ROLES as readonly string[]).includes(user.role)
  const tabs: { id: Tab; nl: string; en: string }[] = ringsUp
    ? [
        { id: 'performance', nl: 'Mijn prestaties',        en: 'My performance' },
        { id: 'shifts',      nl: 'Mijn diensten',          en: 'My shifts' },
        { id: 'activity',    nl: 'Mijn activiteit',        en: 'My activity' },
        { id: 'sessions',    nl: 'Actieve apparaten',      en: 'Active sessions' },
        { id: 'profile',     nl: 'Profiel & wachtwoord',   en: 'Profile & password' },
      ]
    : [
        // SA / OA / Auditor / API Integration — no sales/shifts, but they
        // have an audit trail of their own actions worth seeing + active
        // sessions worth being able to revoke (security hygiene).
        { id: 'activity',    nl: 'Mijn activiteit',        en: 'My activity' },
        { id: 'sessions',    nl: 'Actieve apparaten',      en: 'Active sessions' },
        { id: 'profile',     nl: 'Profiel & wachtwoord',   en: 'Profile & password' },
      ]

  const [tab, setTab] = useState<Tab>(tabs[0].id)

  if (!user) return null

  return (
    <div style={{ padding: 28, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#293371,#1f2a63)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 800 }}>
          {(user.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{user.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
            {ROLE_LABEL[user.role]?.[isNl ? 'nl' : 'en'] ?? user.role}  ·  {user.email}
          </p>
          {/* Surface the user's single-store scope so they (and a supervisor
              over their shoulder) can confirm exactly where they can act. Only
              meaningful for cashier + store_manager; org-scoped roles operate
              at the org level and don't have a single store. */}
          {(user.role === 'cashier' || user.role === 'store_manager') && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: user.store_id ? '#293371' : '#dc2626', fontWeight: 600 }}>
              📍 {user.store_id
                ? (isNl
                    ? `Toegewezen aan ${user.store_name ?? '—'}`
                    : `Assigned to ${user.store_name ?? '—'}`)
                : (isNl
                    ? 'Geen vestiging toegewezen — vraag uw beheerder om u te koppelen.'
                    : 'No store assigned — ask your administrator to assign one.')}
            </p>
          )}
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        {tabs.map(x => (
          <button key={x.id} onClick={() => setTab(x.id)}
            style={{
              padding: '10px 18px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              color: tab === x.id ? '#1f2a63' : '#6b7280',
              borderBottom: tab === x.id ? '2px solid #1f2a63' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {isNl ? x.nl : x.en}
          </button>
        ))}
      </div>

      {/* Render guards mirror the role gate above — defence in depth in case
          a future deep-link / state restore tries to land on a hidden tab. */}
      {tab === 'performance' && ringsUp && <PerformanceTab isNl={isNl} />}
      {tab === 'shifts'      && ringsUp && <ShiftsTab isNl={isNl} />}
      {tab === 'activity'                && <ActivityTab isNl={isNl} />}
      {tab === 'sessions'                && <SessionsTab isNl={isNl} />}
      {tab === 'profile'                 && <ProfileTab isNl={isNl} />}
    </div>
  )
}

// ─── Performance ─────────────────────────────────────────────────────────────

function PerformanceTab({ isNl }: { isNl: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['me', 'sales-summary'],
    queryFn:  getMySalesSummary,
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>{isNl ? 'Laden…' : 'Loading…'}</p>
  if (error || !data) return <p style={{ color: '#dc2626' }}>{isNl ? 'Kon gegevens niet laden.' : 'Could not load data.'}</p>

  const windows: { key: keyof typeof data; nl: string; en: string }[] = [
    { key: 'today', nl: 'Vandaag',     en: 'Today' },
    { key: 'week',  nl: 'Deze week',   en: 'This week' },
    { key: 'month', nl: 'Deze maand',  en: 'This month' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {windows.map(w => {
          const v = data[w.key] as SalesWindow
          return (
            <div key={w.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                {isNl ? w.nl : w.en}
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 800, color: '#16203a' }}>
                SRD {Number(v.total_srd).toLocaleString(isNl ? 'nl-NL' : 'en-GB', { minimumFractionDigits: 2 })}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
                {v.count} {isNl ? 'verkopen' : 'sales'}  ·  ø SRD {v.avg_basket}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#7e88a0' }}>
                BTW: SRD {v.btw_srd}
              </p>
            </div>
          )
        })}
      </div>

      {data.top_product_this_month && (
        <div style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #fbbf24', borderRadius: 14, padding: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#78350f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🏆  {isNl ? 'Topproduct deze maand' : 'Top product this month'}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 800, color: '#16203a' }}>
            {data.top_product_this_month.name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#78350f' }}>
            {data.top_product_this_month.units} {isNl ? 'eenheden' : 'units'}  ·  SRD {data.top_product_this_month.revenue_srd}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

function ShiftsTab({ isNl }: { isNl: boolean }) {
  const { data, isLoading } = useQuery({ queryKey: ['me', 'shifts'], queryFn: getMyShifts })

  if (isLoading) return <p style={{ color: '#6b7280' }}>{isNl ? 'Laden…' : 'Loading…'}</p>
  if (!data?.length) return <p style={{ color: '#6b7280' }}>{isNl ? 'Nog geen diensten.' : 'No shifts yet.'}</p>

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={th()}>{isNl ? 'Geopend' : 'Opened'}</th>
            <th style={th()}>{isNl ? 'Kassa' : 'Register'}</th>
            <th style={th()}>{isNl ? 'Status' : 'Status'}</th>
            <th style={{ ...th(), textAlign: 'right' }}>{isNl ? 'Geteld (SRD)' : 'Counted (SRD)'}</th>
            <th style={{ ...th(), textAlign: 'right' }}>{isNl ? 'Verschil' : 'Discrepancy'}</th>
          </tr>
        </thead>
        <tbody>
          {data.map(s => (
            <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
              <td style={td()}>{fmtDate(s.opened_at)}</td>
              <td style={td()}>{s.register_name} · {s.store_name}</td>
              <td style={td()}>
                <StatusPill status={s.status} isNl={isNl} />
              </td>
              <td style={{ ...td(), textAlign: 'right' }}>{s.closing_cash_counted ? `SRD ${s.closing_cash_counted}` : '—'}</td>
              <td style={{ ...td(), textAlign: 'right', color: discrepancyColor(s.discrepancy) }}>
                {s.discrepancy && Number(s.discrepancy) !== 0 ? `SRD ${Math.abs(Number(s.discrepancy)).toFixed(2)} ${Number(s.discrepancy) < 0 ? (isNl ? 'tekort' : 'short') : (isNl ? 'overschot' : 'surplus')}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusPill({ status, isNl }: { status: Shift['status']; isNl: boolean }) {
  const cfg: Record<Shift['status'], { bg: string; color: string; nl: string; en: string }> = {
    open:               { bg: '#d1fae5', color: '#065f46', nl: 'Open',          en: 'Open' },
    closed:             { bg: '#e5e7eb', color: '#374151', nl: 'Gesloten',      en: 'Closed' },
    reopen_requested:   { bg: '#fef3c7', color: '#92400e', nl: 'Heropenen?',    en: 'Reopen?' },
  }
  const c = cfg[status]
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: c.bg, color: c.color, fontSize: 11, fontWeight: 700 }}>{isNl ? c.nl : c.en}</span>
}

const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const discrepancyColor = (d: string | null) => !d || Number(d) === 0 ? '#374151' : Number(d) < 0 ? '#dc2626' : '#15803d'
const th = (): React.CSSProperties => ({ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' })
const td = (): React.CSSProperties => ({ padding: '12px 16px', color: '#16203a' })

// ─── Activity log (own actions) ──────────────────────────────────────────────
//
// Pulls /api/me/activity — rows from audit_logs where this user is the actor
// or the target. Useful for SA/OA/Auditor reviewing "what did I touch today",
// and for cashiers wanting to see their own action trail.

const EVENT_LABEL: Record<string, { nl: string; en: string; tint: string }> = {
  'auth.login_success':         { nl: 'Ingelogd',                    en: 'Logged in',                tint: '#16a34a' },
  'single_device_logout':       { nl: 'Andere apparaten uitgelogd',  en: 'Other devices logged out', tint: '#f59e0b' },
  'geo_alert_login':            { nl: '⚠️ Login buiten Suriname',     en: '⚠️ Login outside Suriname', tint: '#dc2626' },
  'session.revoked_self':       { nl: 'Sessie ingetrokken',          en: 'Session revoked',          tint: '#293371' },
  'user.store_assigned':        { nl: 'Vestiging-toewijzing aangepast', en: 'Store assignment changed', tint: '#2563eb' },
  'btw.submitted':              { nl: 'BTW-aangifte ingediend',      en: 'BTW submission filed',     tint: '#16a34a' },
  'btw.accepted':               { nl: 'BTW-aangifte geaccepteerd',   en: 'BTW submission accepted',  tint: '#15803d' },
  'btw.disputed':               { nl: 'BTW-aangifte betwist',        en: 'BTW submission disputed',  tint: '#dc2626' },
  'btw.superseded':             { nl: 'BTW-aangifte vervangen',      en: 'BTW submission superseded',tint: '#a16207' },
  'sale.payment_confirmed':     { nl: 'Betaling bevestigd',          en: 'Payment confirmed',        tint: '#15803d' },
  'sale.refunded':              { nl: 'Verkoop terugbetaald',        en: 'Sale refunded',            tint: '#f59e0b' },
  'sale.voided':                { nl: 'Verkoop geannuleerd',         en: 'Sale voided',              tint: '#dc2626' },
  'z_report.closed':            { nl: 'Z-Rapport gesloten',          en: 'Z-Report closed',          tint: '#293371' },
  'z_report.submitted':         { nl: 'Z-Rapport verstuurd naar HQ', en: 'Z-Report sent to HQ',      tint: '#293371' },
}

function ActivityTab({ isNl }: { isNl: boolean }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['me', 'activity'],
    queryFn:  () => getMyActivity(100),
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>{isNl ? 'Laden…' : 'Loading…'}</p>
  if (rows.length === 0) return <p style={{ color: '#6b7280' }}>{isNl ? 'Geen recente activiteit.' : 'No recent activity.'}</p>

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th style={th()}>{isNl ? 'Wanneer' : 'When'}</th>
            <th style={th()}>{isNl ? 'Wat' : 'What'}</th>
            <th style={th()}>{isNl ? 'Doel' : 'Target'}</th>
            <th style={th()}>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const label = EVENT_LABEL[r.event] ?? { nl: r.event, en: r.event, tint: '#6b7280' }
            return (
              <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <td style={{ ...td(), fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                <td style={{ ...td(), fontSize: 13 }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: label.tint, marginRight: 8 }} />
                  <strong style={{ color: label.tint }}>{label[isNl ? 'nl' : 'en']}</strong>
                </td>
                <td style={{ ...td(), fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
                  {r.auditable_type}{r.auditable_id ? ` · ${String(r.auditable_id).slice(0, 8)}…` : ''}
                </td>
                <td style={{ ...td(), fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>{r.ip_address ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Active sessions (own tokens) ────────────────────────────────────────────

function SessionsTab({ isNl }: { isNl: boolean }) {
  const qc = useQueryClient()
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['me', 'sessions'],
    queryFn:  getMySessions,
  })

  const revoke = useMutation({
    mutationFn: revokeMySession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  })

  if (isLoading) return <p style={{ color: '#6b7280' }}>{isNl ? 'Laden…' : 'Loading…'}</p>

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
        {isNl
          ? 'Elk apparaat / browser waarmee u bent ingelogd is een sessie. Intrekken om een verloren of vergeten apparaat direct uit te loggen.'
          : 'Each device or browser you logged in from is a session. Revoke to immediately log out a lost or forgotten one.'}
      </p>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={th()}>{isNl ? 'Apparaat / naam' : 'Device / name'}</th>
              <th style={th()}>{isNl ? 'Laatst gebruikt' : 'Last used'}</th>
              <th style={th()}>{isNl ? 'Aangemaakt' : 'Created'}</th>
              <th style={th()}>{isNl ? 'Verloopt' : 'Expires'}</th>
              <th style={th()}>{isNl ? 'Actie' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid #f3f4f6' : 'none', background: s.is_current ? 'rgba(41,51,113,0.04)' : undefined }}>
                <td style={{ ...td(), fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.is_current && <div style={{ fontSize: 11, color: '#293371', fontWeight: 700 }}>{isNl ? '◉ Deze sessie' : '◉ This session'}</div>}
                </td>
                <td style={{ ...td(), fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(s.last_used_at)}</td>
                <td style={{ ...td(), fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(s.created_at)}</td>
                <td style={{ ...td(), fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(s.expires_at)}</td>
                <td style={{ ...td() }}>
                  {s.is_current ? (
                    <span style={{ fontSize: 11.5, color: '#9ca3af', fontStyle: 'italic' }}>
                      {isNl ? 'gebruik uitloggen' : 'use logout'}
                    </span>
                  ) : (
                    <button onClick={() => revoke.mutate(s.id)} disabled={revoke.isPending}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      ✗ {isNl ? 'Intrekken' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Profile + password ──────────────────────────────────────────────────────

function ProfileTab({ isNl }: { isNl: boolean }) {
  const user = useDashboardAuthStore((s) => s.user)
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [locale, setLocale] = useState<'nl' | 'en'>((user?.locale as 'nl' | 'en') ?? 'nl')
  const [profileSaved, setProfileSaved] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const profileMut = useMutation({
    mutationFn: () => updateMyProfile({ name, email, locale }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2000) },
  })

  const pwMut = useMutation({
    mutationFn: () => changeMyPassword({ current_password: curPw, new_password: newPw, new_password_confirmation: newPw2 }),
    onSuccess: () => { setPwSaved(true); setCurPw(''); setNewPw(''); setNewPw2(''); setPwError(null); setTimeout(() => setPwSaved(false), 3000) },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setPwError(msg ?? (isNl ? 'Wijziging mislukt.' : 'Change failed.'))
    },
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Profile */}
      <form onSubmit={(e) => { e.preventDefault(); profileMut.mutate() }} style={card()}>
        <h3 style={cardHeading()}>{isNl ? 'Profiel' : 'Profile'}</h3>
        <Field label={isNl ? 'Naam' : 'Name'}><input value={name} onChange={e => setName(e.target.value)} style={input()} /></Field>
        <Field label={isNl ? 'E-mail' : 'Email'}><input type="email" value={email} onChange={e => setEmail(e.target.value)} style={input()} /></Field>
        <Field label={isNl ? 'Taal' : 'Language'}>
          <select value={locale} onChange={e => setLocale(e.target.value as 'nl' | 'en')} style={input()}>
            <option value="nl">Nederlands</option>
            <option value="en">English</option>
          </select>
        </Field>
        <button type="submit" disabled={profileMut.isPending} style={primaryBtn()}>
          {profileMut.isPending ? '…' : (isNl ? 'Profiel opslaan' : 'Save profile')}
        </button>
        {profileSaved && <p style={{ color: '#15803d', fontSize: 13, marginTop: 10 }}>✓ {isNl ? 'Opgeslagen' : 'Saved'}</p>}
      </form>

      {/* Password */}
      <form onSubmit={(e) => { e.preventDefault(); pwMut.mutate() }} style={card()}>
        <h3 style={cardHeading()}>{isNl ? 'Wachtwoord wijzigen' : 'Change password'}</h3>
        <Field label={isNl ? 'Huidig wachtwoord' : 'Current password'}>
          <input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} style={input()} autoComplete="current-password" />
        </Field>
        <Field label={isNl ? 'Nieuw wachtwoord (≥10, met letters en cijfers)' : 'New password (≥10, letters and numbers)'}>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={input()} autoComplete="new-password" />
        </Field>
        <Field label={isNl ? 'Herhaal nieuw wachtwoord' : 'Repeat new password'}>
          <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={input()} autoComplete="new-password" />
        </Field>
        <button type="submit" disabled={pwMut.isPending || !curPw || !newPw || newPw !== newPw2} style={primaryBtn()}>
          {pwMut.isPending ? '…' : (isNl ? 'Wachtwoord wijzigen' : 'Change password')}
        </button>
        {pwSaved && <p style={{ color: '#15803d', fontSize: 13, marginTop: 10 }}>✓ {isNl ? 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.' : 'Password changed. Other devices have been logged out.'}</p>}
        {pwError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{pwError}</p>}
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  )
}

const card = (): React.CSSProperties => ({ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24 })
const cardHeading = (): React.CSSProperties => ({ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#16203a' })
const input = (): React.CSSProperties => ({ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' })
const primaryBtn = (): React.CSSProperties => ({ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#293371,#1f2a63)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(41,51,113,.35)' })
