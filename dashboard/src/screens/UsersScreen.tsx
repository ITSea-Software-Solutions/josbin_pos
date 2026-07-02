import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import { getUsers, createUser, updateUser, type User, type CreateUserPayload } from '@/api/users'
import { getOrganisations, getOrgStores, type Organisation, type Store } from '@/api/organisations'
import { getTwoFactorPolicy, updateTwoFactorPolicy } from '@/api/securityPolicy'
import { useDashboardAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CFG: Record<string, { bg: string; color: string; border: string; label: { nl: string; en: string } }> = {
  super_admin:        { bg: '#f3f0ff', color: '#6d28d9', border: '#ddd6fe', label: { nl: 'Super Admin',      en: 'Super Admin'     } },
  organisation_admin: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: { nl: 'Org. Beheerder',   en: 'Org. Admin'      } },
  store_manager:      { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe', label: { nl: 'Winkelbeheerder',  en: 'Store Manager'   } },
  cashier:            { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: { nl: 'Kassamedewerker',  en: 'Cashier'         } },
  auditor:            { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: { nl: 'Controleur',       en: 'Auditor'         } },
  api_integration:    { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: { nl: 'API Integratie',   en: 'API Integration' } },
}

// Roles that require an organisation to be selected
const ROLES_NEED_ORG = ['organisation_admin', 'store_manager', 'cashier', 'auditor', 'api_integration']

const ALL_ROLES = [
  { value: 'organisation_admin', nl: 'Org. Beheerder',  en: 'Org. Admin'      },
  { value: 'store_manager',      nl: 'Winkelbeheerder', en: 'Store Manager'   },
  { value: 'cashier',            nl: 'Kassamedewerker', en: 'Cashier'         },
  { value: 'auditor',            nl: 'Controleur',      en: 'Auditor'         },
  { value: 'api_integration',    nl: 'API Integratie',  en: 'API Integration' },
  { value: 'super_admin',        nl: 'Super Admin',     en: 'Super Admin'     },
]

/**
 * Mirrors backend MANAGEABLE_ROLES in UserController. Each role's list is what
 * that role can CREATE/EDIT. Keep in sync if backend changes.
 */
const MANAGEABLE_ROLES: Record<string, string[]> = {
  super_admin:        ['organisation_admin', 'store_manager', 'cashier', 'auditor', 'api_integration', 'super_admin'],
  organisation_admin: ['store_manager', 'cashier', 'auditor', 'api_integration'],
  store_manager:      ['cashier'],
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%&*'
  const all = upper + lower + digits + special
  // Ensure at least one of each type
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ]
  const rest = Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)])
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('')
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box',
}
function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#7c3aed'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,.12)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#e5e7eb'
  e.currentTarget.style.boxShadow = 'none'
}

function RoleBadge({ role, isNl }: { role: string; isNl: boolean }) {
  const cfg = ROLE_CFG[role] ?? { bg: '#f9fafb', color: '#374151', border: '#e5e7eb', label: { nl: role, en: role } }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label[isNl ? 'nl' : 'en']}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const hue = (name.charCodeAt(0) + name.charCodeAt(1 % name.length)) % 360
  return (
    <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
      {initials}
    </div>
  )
}

// ─── StoreAssignmentPicker ───────────────────────────────────────────────────
// Single-store picker. A user belongs to exactly one store (product decision —
// no "floating cashiers", no "all stores in org" implicit grant). Required for
// cashier + store_manager; hidden for every other role. Backend validates the
// selection with StoreBelongsToOrg.
function StoreAssignmentPicker({ orgId, value, onChange, isNl, role }: {
  orgId: string | null
  value: string | null
  onChange: (id: string | null) => void
  isNl: boolean
  role: string
}) {
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['org-stores-picker', orgId],
    queryFn: () => orgId ? getOrgStores(orgId) : Promise.resolve([] as Store[]),
    enabled: !!orgId,
  })

  if (!orgId) {
    return (
      <div style={{ padding: '10px 12px', background: '#f9fafb', border: '1px dashed #e5e7eb', borderRadius: 8, fontSize: 12, color: '#9090a0' }}>
        {isNl ? 'Kies eerst een organisatie hierboven.' : 'Pick an organisation above first.'}
      </div>
    )
  }

  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

  const helpText = role === 'cashier'
    ? (isNl ? 'Kassamedewerker werkt op één vestiging — selecteer welke.' : 'Cashier works at one store — pick which one.')
    : (isNl ? 'Winkelbeheerder beheert één vestiging — selecteer welke.' : 'Store manager runs one store — pick which one.')

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
        {isNl ? 'Toegewezen vestiging' : 'Assigned store'} *
      </label>
      {isLoading ? (
        <div style={{ padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 12, color: '#9090a0', background: '#fff' }}>
          {isNl ? 'Vestigingen laden…' : 'Loading stores…'}
        </div>
      ) : stores.length === 0 ? (
        <div style={{ padding: '10px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e' }}>
          {isNl
            ? '⚠️ Deze organisatie heeft nog geen vestigingen. Maak eerst een vestiging aan onder Vestigingen.'
            : '⚠️ This organisation has no stores yet. Create one via Stores first.'}
        </div>
      ) : (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
          onFocus={focusIn} onBlur={focusOut}
        >
          <option value="">{isNl ? '— Selecteer vestiging —' : '— Select store —'}</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.city ? ` · ${s.city}` : ''}
            </option>
          ))}
        </select>
      )}
      <p style={{ fontSize: 11.5, color: '#9090a0', marginTop: 5 }}>
        {helpText} {isNl ? 'Eén gebruiker, één vestiging.' : 'One user, one store.'}
      </p>
    </div>
  )
}

// ─── OrgSelect helper ─────────────────────────────────────────────────────────
function OrgSelect({ value, onChange, orgs, isNl }: {
  value: string; onChange: (v: string) => void
  orgs: Organisation[]; isNl: boolean; required?: boolean
}) {
  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
      onFocus={focusIn} onBlur={focusOut}
    >
      <option value="">{isNl ? '— Selecteer organisatie —' : '— Select organisation —'}</option>
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.is_government ? '🏛️ ' : o.type === 'wholesale' ? '📦 ' : '🛍️ '}{o.name}
        </option>
      ))}
    </select>
  )
}

// ─── Created-user banner ──────────────────────────────────────────────────────
function CreatedUserBanner({ user, password, isNl, onDismiss }: {
  user: User; password: string; isNl: boolean; onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(`Email: ${user.email}\nWachtwoord: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginBottom: 24, padding: '18px 22px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #86efac', borderRadius: 14, boxShadow: '0 2px 8px rgba(34,197,94,.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>
          {isNl ? `Gebruiker aangemaakt — ${user.name}` : `User created — ${user.name}`}
        </span>
        <button onClick={onDismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      <p style={{ fontSize: 12.5, color: '#166534', marginBottom: 12 }}>
        {isNl
          ? 'Deel de onderstaande inloggegevens met de gebruiker. Het wachtwoord wordt slechts één keer getoond.'
          : 'Share the login credentials below with the user. The password is shown only once.'}
      </p>
      <div style={{ background: '#fff', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div><strong>Email:</strong> {user.email}</div>
        <div><strong>{isNl ? 'Wachtwoord' : 'Password'}:</strong> {password}</div>
      </div>
      <button onClick={copy} style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: '1px solid #86efac', background: copied ? '#22c55e' : '#fff', color: copied ? '#fff' : '#166534', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
        {copied ? (isNl ? 'Gekopieerd ✓' : 'Copied ✓') : (isNl ? 'Kopieer inloggegevens' : 'Copy credentials')}
      </button>
    </div>
  )
}

// ─── CreateUserModal ──────────────────────────────────────────────────────────
function CreateUserModal({ orgs, isNl, onClose, onCreated }: {
  orgs: Organisation[]; isNl: boolean
  onClose: () => void
  onCreated: (user: User, password: string) => void
}) {
  const qc = useQueryClient()
  const currentUser = useDashboardAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === 'super_admin'

  // Roles the CURRENT user is allowed to create. Backend enforces the same
  // list (UserController::MANAGEABLE_ROLES) so this is just UI hygiene —
  // hide what a 422 would reject anyway. Store Manager → only cashier;
  // Org Admin → store_manager, cashier, auditor, api_integration.
  const allowedRoles = MANAGEABLE_ROLES[currentUser?.role ?? ''] ?? []
  const roleOptions = ALL_ROLES.filter(r => allowedRoles.includes(r.value))
  const defaultRole = roleOptions[0]?.value ?? 'cashier'

  const [form, setForm] = useState<CreateUserPayload>({
    name: '', email: '', password: '', role: defaultRole,
    organisation_id: null, locale: 'nl', send_welcome_email: true,
  })
  const [showPassword, setShowPassword] = useState(false)

  const needsOrg = ROLES_NEED_ORG.includes(form.role)

  const mutation = useMutation({
    mutationFn: () => {
      // Non-super-admin actors must NOT send organisation_id — the backend
      // rejects it as `prohibited` and auto-fills from the actor's own org.
      // Super Admin must send it (they could be creating users in any org).
      const payload: CreateUserPayload = isSuperAdmin
        ? form
        : { ...form, organisation_id: null as unknown as string | null }
      // Strip the key entirely if not super admin so the backend sees no value.
      if (!isSuperAdmin) {
        const { organisation_id: _drop, ...rest } = payload
        return createUser(rest as CreateUserPayload)
      }
      return createUser(payload)
    },
    onSuccess: (user) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onCreated(user, form.password)
    },
  })

  function set<K extends keyof CreateUserPayload>(field: K, value: CreateUserPayload[K]) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  const isStoreScoped = form.role === 'cashier' || form.role === 'store_manager'
  const canSubmit = !!form.name && !!form.email && !!form.password &&
    // Org is required ONLY for Super Admin creating a new user — for other
    // actors the backend fills it from their own org.
    (!needsOrg || !isSuperAdmin || !!form.organisation_id) &&
    // Store-scoped roles must have a store picked. The backend would 422 the
    // request anyway, but blocking the button gives faster feedback.
    (!isStoreScoped || !!form.store_id)

  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, padding: '32px', boxShadow: '0 32px 80px rgba(0,0,0,.25)', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-.3px', marginBottom: 3 }}>
              {isNl ? 'Gebruiker aanmaken' : 'Create user'}
            </h2>
            <p style={{ fontSize: 13, color: '#9090a0' }}>
              {isNl ? 'Vul alle gegevens in en stuur de inloggegevens naar de gebruiker.' : 'Fill in all details and share the credentials with the user.'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {mutation.isError && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Er is een fout opgetreden' : 'An error occurred')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Name + Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Volledige naam' : 'Full name'} *</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder={isNl ? 'John Doe' : 'John Doe'} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'E-mailadres' : 'Email address'} *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="john@example.com" style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
          </div>

          {/* Role */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Rol' : 'Role'} *</label>
            <select
              value={form.role}
              onChange={(e) => { set('role', e.target.value); if (!ROLES_NEED_ORG.includes(e.target.value)) set('organisation_id', null) }}
              style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{isNl ? r.nl : r.en}</option>)}
            </select>
            {/* Role description hint */}
            <p style={{ fontSize: 11.5, color: '#9090a0', marginTop: 5 }}>
              {form.role === 'organisation_admin' && (isNl ? 'Beheert één organisatie — vestigingen, gebruikers, catalogus.' : 'Manages one organisation — stores, users, catalogue.')}
              {form.role === 'store_manager'      && (isNl ? 'Beheert toegewezen vestiging(en), maakt kassamedewerkers aan.' : 'Manages assigned store(s), creates cashier accounts.')}
              {form.role === 'cashier'            && (isNl ? 'Toegang tot POS-scherm alleen — kan geen rapporten of instellingen zien.' : 'Access to POS screen only — cannot view reports or settings.')}
              {form.role === 'auditor'            && (isNl ? 'Alleen-lezen toegang voor compliance controle (Rekenkamer).' : 'Read-only access for compliance review (Rekenkamer).')}
              {form.role === 'api_integration'    && (isNl ? 'Machine-account voor externe POS-integraties via API.' : 'Machine account for external POS integrations via API.')}
              {form.role === 'super_admin'        && (isNl ? 'Volledige platformtoegang — geen organisatie vereist.' : 'Full platform access — no organisation required.')}
            </p>
          </div>

          {/* Organisation — Super Admin only. For Org Admin / Store Manager
              the backend auto-attaches the actor's own organisation and rejects
              the field as `prohibited` if it's sent. */}
          {needsOrg && isSuperAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Organisatie' : 'Organisation'} *</label>
              <OrgSelect
                value={form.organisation_id ?? ''}
                onChange={(v) => set('organisation_id', v || null)}
                orgs={orgs} isNl={isNl} required
              />
            </div>
          )}
          {needsOrg && !isSuperAdmin && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              {isNl
                ? `Deze gebruiker wordt automatisch toegevoegd aan uw organisatie (${currentUser?.organisation_id?.slice(0,8) ?? ''}…).`
                : `This user will be added to your organisation (${currentUser?.organisation_id?.slice(0,8) ?? ''}…).`}
            </p>
          )}

          {/* Store assignment — cashier + store_manager only. One user, one
              store. Backend rejects creates with no store_id for these roles
              and rejects any store_id at all for other roles. */}
          {(form.role === 'cashier' || form.role === 'store_manager') && (
            <StoreAssignmentPicker
              orgId={isSuperAdmin ? form.organisation_id : (currentUser?.organisation_id ?? null)}
              value={form.store_id ?? null}
              onChange={(id) => set('store_id' as keyof CreateUserPayload, id as never)}
              isNl={isNl}
              role={form.role}
            />
          )}

          {/* Locale */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Taal (interface)' : 'Language (interface)'}</label>
            <select
              value={form.locale}
              onChange={(e) => set('locale', e.target.value as 'nl' | 'en')}
              style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              <option value="nl">🇳🇱 Nederlands</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          {/* Temporary password */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Tijdelijk wachtwoord' : 'Temporary password'} *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={isNl ? 'Min. 8 tekens' : 'Min. 8 characters'}
                  style={{ ...inputSt, paddingRight: 40 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9090a0', padding: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => { const p = generatePassword(); set('password', p); setShowPassword(true) }}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {isNl ? 'Genereer' : 'Generate'}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: '#9090a0', marginTop: 5 }}>
              {isNl
                ? 'De gebruiker moet dit wachtwoord wijzigen bij de eerste login.'
                : 'The user must change this password on first login.'}
            </p>
          </div>

          {/* Welcome email */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <input
              type="checkbox"
              checked={form.send_welcome_email ?? true}
              onChange={(e) => set('send_welcome_email', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>
                {isNl ? 'Welkom-e-mail versturen' : 'Send welcome email'}
              </div>
              <div style={{ fontSize: 11.5, color: '#9090a0', marginTop: 1 }}>
                {isNl
                  ? 'Stuur automatisch een welkomst-e-mail met inloggegevens naar de gebruiker.'
                  : 'Automatically send a welcome email with login credentials to the user.'}
              </div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSubmit}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !canSubmit ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}
          >
            {mutation.isPending ? (isNl ? 'Aanmaken…' : 'Creating…') : (isNl ? 'Gebruiker aanmaken' : 'Create user')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── EditUserModal ────────────────────────────────────────────────────────────
function EditUserModal({ user, orgs, isNl, onClose }: {
  user: User; orgs: Organisation[]; isNl: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const currentUser = useDashboardAuthStore((s) => s.user)

  // Same role-filtering rule as Create: limit role dropdown to what the
  // current actor can manage. Keep the user's CURRENT role in the list so
  // an Org Admin editing their own Org Admin self can still see their role.
  const allowedRoles = MANAGEABLE_ROLES[currentUser?.role ?? ''] ?? []
  const roleOptions = ALL_ROLES.filter(r => allowedRoles.includes(r.value) || r.value === user.role)

  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    role: user.role,
    organisation_id: user.organisation_id,
    locale: user.locale as 'nl' | 'en',
    is_active: user.is_active,
    password: '',
    // Pre-fill the user's single store assignment so editing doesn't silently
    // wipe it. Null for org-scoped roles (auditor, api_integration, OA, SA).
    store_id: user.store_id ?? null,
  })
  const [showPassword, setShowPassword] = useState(false)
  const needsOrg = ROLES_NEED_ORG.includes(form.role)

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof updateUser>[1] = {
        name: form.name, email: form.email, role: form.role,
        organisation_id: needsOrg ? form.organisation_id : null,
        locale: form.locale, is_active: form.is_active,
      }
      if (form.password) payload.password = form.password
      // Only send store_id for store-scoped roles. For other roles the
      // backend rejects the field as `prohibited`, and the controller
      // auto-nulls store_id when role flips org-scoped — so omitting it
      // here keeps the audit diff clean.
      if (form.role === 'cashier' || form.role === 'store_manager') {
        payload.store_id = form.store_id
      }
      return updateUser(user.id, payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose() },
  })

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, padding: '32px', boxShadow: '0 32px 80px rgba(0,0,0,.25)', maxHeight: '92vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={user.name} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-.3px', marginBottom: 2 }}>
                {isNl ? 'Gebruiker bewerken' : 'Edit user'}
              </h2>
              <p style={{ fontSize: 12.5, color: '#9090a0' }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {mutation.isError && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Er is een fout opgetreden' : 'An error occurred')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Naam' : 'Name'}</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'E-mail' : 'Email'}</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Rol' : 'Role'}</label>
            <select value={form.role} onChange={(e) => { set('role', e.target.value); if (!ROLES_NEED_ORG.includes(e.target.value)) set('organisation_id', null) }}
              style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              {roleOptions.map((r) => <option key={r.value} value={r.value}>{isNl ? r.nl : r.en}</option>)}
            </select>
          </div>

          {needsOrg && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Organisatie' : 'Organisation'}</label>
              <OrgSelect value={form.organisation_id ?? ''} onChange={(v) => set('organisation_id', v || null)} orgs={orgs} isNl={isNl} />
            </div>
          )}

          {/* Store assignment — same single-store picker as create form,
              pre-filled with the user's current store. */}
          {(form.role === 'cashier' || form.role === 'store_manager') && (
            <StoreAssignmentPicker
              orgId={form.organisation_id ?? currentUser?.organisation_id ?? null}
              value={form.store_id}
              onChange={(id) => set('store_id', id)}
              isNl={isNl}
              role={form.role}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Taal' : 'Language'}</label>
              <select value={form.locale} onChange={(e) => set('locale', e.target.value as 'nl' | 'en')}
                style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="nl">🇳🇱 Nederlands</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Status' : 'Status'}</label>
              <select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => set('is_active', e.target.value === 'active')}
                style={{ ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="active">{isNl ? 'Actief' : 'Active'}</option>
                <option value="inactive">{isNl ? 'Inactief' : 'Inactive'}</option>
              </select>
            </div>
          </div>

          {/* Password reset (optional) */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {isNl ? 'Nieuw wachtwoord (optioneel)' : 'New password (optional)'}
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder={isNl ? 'Leeg laten om niet te wijzigen' : 'Leave empty to keep current'}
                  style={{ ...inputSt, paddingRight: 40 }} onFocus={focusIn} onBlur={focusOut}
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9090a0', padding: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                  </svg>
                </button>
              </div>
              <button type="button"
                onClick={() => { const p = generatePassword(); set('password', p); setShowPassword(true) }}
                style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {isNl ? 'Reset' : 'Reset'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.email}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name || !form.email ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}>
            {mutation.isPending ? (isNl ? 'Opslaan…' : 'Saving…') : (isNl ? 'Opslaan' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Per-role 2FA policy panel (Super Admin only) ─────────────────────────────
function TwoFactorPolicyPanel({ isNl }: { isNl: boolean }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[] | null>(null)

  const { data: policy, isLoading } = useQuery({
    queryKey: ['two-factor-policy'],
    queryFn: getTwoFactorPolicy,
  })

  const selected = draft ?? policy?.two_factor_required_roles ?? []
  const dirty = draft !== null && policy !== undefined &&
    JSON.stringify([...draft].sort()) !== JSON.stringify([...policy.two_factor_required_roles].sort())

  const save = useMutation({
    mutationFn: () => updateTwoFactorPolicy(selected),
    onSuccess: (updated) => {
      qc.setQueryData(['two-factor-policy'], updated)
      setDraft(null)
    },
  })

  function toggleRole(role: string) {
    const base = draft ?? policy?.two_factor_required_roles ?? []
    setDraft(base.includes(role) ? base.filter((r) => r !== role) : [...base, role])
  }

  function roleLabel(role: string) {
    const cfg = ROLE_CFG[role]
    return cfg ? cfg.label[isNl ? 'nl' : 'en'] : role
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, marginBottom: 24, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 22px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(135deg,#7c3aed20,#4f46e520)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            🔐
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
              {isNl ? 'Tweestapsverificatie per rol' : 'Two-factor authentication per role'}
            </div>
            <div style={{ fontSize: 12, color: '#9090a0', marginTop: 1 }}>
              {isNl
                ? 'Bepaal welke rollen verplicht 2FA moeten gebruiken.'
                : 'Choose which roles must use 2FA.'}
            </div>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 22px 22px', borderTop: '1px solid #f0f0f8' }}>
          {isLoading || !policy ? (
            <p style={{ fontSize: 13, color: '#9090a0', marginTop: 14 }}>{isNl ? 'Laden…' : 'Loading…'}</p>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: '#6b7280', margin: '14px 0 16px' }}>
                {isNl
                  ? 'Super Admins en alle accounts van overheidsorganisaties zijn altijd verplicht — dit kan niet worden uitgeschakeld.'
                  : 'Super Admins and all government-organisation accounts are always required — this cannot be disabled.'}
              </p>

              {/* Always-on roles */}
              {policy.always_roles.map((role) => (
                <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f3f8' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>{roleLabel(role)}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: '#f3f0ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                    🔒 {isNl ? 'Altijd verplicht' : 'Always required'}
                  </span>
                </div>
              ))}

              {/* Configurable roles */}
              {policy.configurable_roles.map((role) => {
                const on = selected.includes(role)
                return (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f3f8' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>{roleLabel(role)}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggleRole(role)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: on ? '#7c3aed' : '#d1d5db', padding: 2, transition: 'background .15s',
                        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
                    </button>
                  </div>
                )
              })}

              {save.isError && (
                <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginTop: 14 }}>
                  {isNl ? 'Opslaan mislukt.' : 'Failed to save.'}
                </p>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <button
                  onClick={() => save.mutate()}
                  disabled={!dirty || save.isPending}
                  style={{
                    padding: '9px 20px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: (!dirty || save.isPending) ? 0.5 : 1,
                  }}
                >
                  {save.isPending ? (isNl ? 'Opslaan…' : 'Saving…') : (isNl ? 'Beleid opslaan' : 'Save policy')}
                </button>
                {dirty && (
                  <button
                    onClick={() => setDraft(null)}
                    style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isNl ? 'Herstellen' : 'Reset'}
                  </button>
                )}
                {save.isSuccess && !dirty && (
                  <span style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>
                    ✓ {isNl ? 'Beleid opgeslagen' : 'Policy saved'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function UsersScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const currentUser = useDashboardAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  // Which users the current actor may create/edit (mirrors backend
  // MANAGEABLE_ROLES). Empty for cashier/auditor → no bulk bar for them.
  const manageableRoles = MANAGEABLE_ROLES[currentUser?.role ?? ''] ?? []
  const canManageUsers = manageableRoles.length > 0
  // A row is bulk-selectable only when the actor can manage that role AND it
  // isn't the actor's own account (self-deactivate is a footgun; backend
  // blocks it anyway — hide it to avoid confusing partial-failure toasts).
  const canManage = (u: User) => canManageUsers && manageableRoles.includes(u.role) && u.id !== currentUser?.id

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [createdUser, setCreatedUser] = useState<{ user: User; password: string } | null>(null)
  // Replaces the browser confirm() — keeps the user pinned in the modal
  // while the mutation runs, with consistent styling + Escape support.
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  // Bulk selection + confirm dialog for activate/deactivate.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const toast = useToast()

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: orgs = [] } = useQuery({ queryKey: ['organisations'], queryFn: getOrganisations })

  // Build a map of org id → org name for display in the table
  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]))

  // Build a store-id → store-name map for the Stores column. For non-SA the
  // /api/stores list is already org-scoped, so this is a single cheap fetch.
  const { data: allStores = [] } = useQuery({
    queryKey: ['stores-for-users-table'],
    queryFn: () => import('@/api/stores').then((m) => m.getStores()),
  })
  const storeMap = Object.fromEntries((allStores as Array<{ id: string; name: string }>).map((s) => [s.id, s.name]))

  const active  = users?.filter((u) => u.is_active).length ?? 0
  const with2fa = users?.filter((u) => u.two_factor_enabled).length ?? 0
  const total   = users?.length ?? 0

  const toggleStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateUser(id, { is_active: active }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setStatusTarget(null)
      toast.success(
        vars.active
          ? (isNl ? 'Gebruiker geactiveerd' : 'User activated')
          : (isNl ? 'Gebruiker gedeactiveerd' : 'User deactivated'),
      )
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Kon status niet wijzigen: ${msg}` : `Could not change status: ${msg}`)
    },
  })

  // Client-side column sort (shared hook → identical behaviour across all
  // dashboard tables). Accessors mirror what each cell displays so the order
  // matches what the user reads (role → localized label, store → resolved name).
  const { sorted: sortedUsers, sort, toggle, indicator } = useTableSort(users ?? [], {
    name:      (u) => (u.name ?? '').toLowerCase(),
    email:     (u) => (u.email ?? '').toLowerCase(),
    role:      (u) => (ROLE_CFG[u.role]?.label[isNl ? 'nl' : 'en'] ?? u.role ?? '').toLowerCase(),
    store:     (u) => (u.store_name ?? (u.store_id ? storeMap[u.store_id] : '') ?? '').toLowerCase(),
    license:   (u) => (u.org_license?.tier ?? '').toLowerCase(),
    twofactor: (u) => (u.two_factor_enabled ? 1 : 0),
    lastlogin: (u) => (u.last_login_at ? new Date(u.last_login_at).getTime() : null),
    status:    (u) => (u.is_active ? 1 : 0),
  })

  // Bulk selection over the manageable rows only. Select-all targets every
  // manageable user; per-row checkboxes render only for manageable users.
  const selectableIds = (users ?? []).filter(canManage).map((u) => u.id)
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
  const selectedUsers = (users ?? []).filter((u) => selectedIds.has(u.id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds))
  }

  // Run the single-user update sequentially so we can show progress and keep
  // the backend's per-user policy checks intact. Skips no-ops (already in the
  // target state) so "activate 5" on 3 active + 2 inactive only touches 2.
  async function runBulk(activate: boolean) {
    const targets = selectedUsers.filter((u) => u.is_active !== activate)
    setBulkAction(null)
    if (targets.length === 0) {
      toast.info(isNl ? 'Niets te wijzigen — geselecteerde gebruikers hebben al deze status.' : 'Nothing to change — selected users already have this status.')
      setSelectedIds(new Set())
      return
    }
    setBulkProgress({ done: 0, total: targets.length })
    let ok = 0, failed = 0
    for (const u of targets) {
      try {
        await updateUser(u.id, { is_active: activate })
        ok++
      } catch {
        failed++
      }
      setBulkProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }
    setBulkProgress(null)
    setSelectedIds(new Set())
    qc.invalidateQueries({ queryKey: ['users'] })
    const verb = activate ? (isNl ? 'geactiveerd' : 'activated') : (isNl ? 'gedeactiveerd' : 'deactivated')
    if (failed === 0) {
      toast.success(isNl ? `${ok} gebruiker(s) ${verb}.` : `${ok} user(s) ${verb}.`)
    } else {
      toast.warning(isNl ? `${ok} ${verb}, ${failed} mislukt.` : `${ok} ${verb}, ${failed} failed.`)
    }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Gebruikers' : 'Users'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl ? 'Alle gebruikersaccounts in het platform.' : 'All user accounts across the platform.'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          {isNl ? 'Gebruiker aanmaken' : 'Create user'}
        </button>
      </div>

      {/* Created user credentials banner */}
      {createdUser && (
        <CreatedUserBanner
          user={createdUser.user}
          password={createdUser.password}
          isNl={isNl}
          onDismiss={() => setCreatedUser(null)}
        />
      )}

      {/* Per-role 2FA policy — Super Admin only */}
      {isSuperAdmin && <TwoFactorPolicyPanel isNl={isNl} />}

      {/* Stats row */}
      {!isLoading && users && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28, maxWidth: 580 }}>
          {[
            { label: isNl ? 'Totaal gebruikers' : 'Total users', value: total,   color: '#7c3aed' },
            { label: isNl ? 'Actief' : 'Active',                  value: active,  color: '#16a34a' },
            { label: isNl ? 'Met 2FA' : 'With 2FA',              value: with2fa, color: '#2563eb' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9090a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk action bar — sticky, appears when manageable rows are selected.
          Only rendered for actors who can manage users (super_admin,
          organisation_admin, store_manager). */}
      {canManageUsers && selectedIds.size > 0 && (
        <div style={{ position: 'sticky', top: 12, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '12px 18px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', borderRadius: 12, color: '#fff', boxShadow: '0 6px 18px rgba(124,58,237,.35)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>
            {bulkProgress
              ? (isNl ? `Bezig… ${bulkProgress.done}/${bulkProgress.total}` : `Working… ${bulkProgress.done}/${bulkProgress.total}`)
              : `${selectedIds.size} ${isNl ? 'geselecteerd' : 'selected'}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())} disabled={!!bulkProgress}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600, opacity: bulkProgress ? 0.6 : 1 }}>
              {isNl ? 'Wissen' : 'Clear'}
            </button>
            <button onClick={() => setBulkAction('activate')} disabled={!!bulkProgress}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#f0fdf4', color: '#15803d', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkProgress ? 0.6 : 1 }}>
              ✓ {isNl ? 'Activeren' : 'Activate'}
            </button>
            <button onClick={() => setBulkAction('deactivate')} disabled={!!bulkProgress}
              style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#dc2626', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkProgress ? 0.6 : 1 }}>
              {isNl ? 'Deactiveren' : 'Deactivate'}
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f3f3f8' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0f0f8' }} />
                <div style={{ flex: 1, height: 14, borderRadius: 7, background: '#f0f0f8', maxWidth: 200 }} />
                <div style={{ width: 120, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 80, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {canManageUsers && (
                  <th style={{ padding: '12px 8px 12px 20px', width: 38 }}>
                    <input type="checkbox" checked={allSelected} disabled={selectableIds.length === 0}
                      onChange={toggleAll} title={isNl ? 'Alles selecteren' : 'Select all'}
                      style={{ width: 16, height: 16, cursor: selectableIds.length ? 'pointer' : 'not-allowed', accentColor: '#7c3aed' }} />
                  </th>
                )}
                {[
                  { key: 'name',  label: isNl ? 'Gebruiker' : 'User' },
                  { key: 'email', label: isNl ? 'E-mailadres' : 'Email' },
                  { key: 'role',  label: isNl ? 'Rol' : 'Role' },
                  { key: 'store', label: isNl ? 'Vestiging' : 'Store' },
                  // SA-only: licence info is only meaningful to whoever can
                  // issue / extend / revoke licences. Other roles see a
                  // cleaner table without it.
                  ...(isSuperAdmin ? [{ key: 'license', label: isNl ? 'Licentie' : 'Licence' }] : []),
                  { key: 'twofactor', label: '2FA' },
                  { key: 'lastlogin', label: isNl ? 'Laatste login' : 'Last login' },
                  { key: 'status',    label: isNl ? 'Status' : 'Status' },
                  { key: '',          label: isNl ? 'Acties' : 'Actions' },
                ].map((h) => (
                  <th key={h.label}
                    onClick={h.key ? () => toggle(h.key) : undefined}
                    style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                    {h.label}
                    {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#7c3aed' : '#c0c0cc' }}>{indicator(h.key)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user, i) => (
                <tr key={user.id}
                  style={{ borderBottom: i < sortedUsers.length - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {/* Bulk-select checkbox — only for rows the actor can manage
                      (and never their own account). */}
                  {canManageUsers && (
                    <td style={{ padding: '14px 8px 14px 20px' }}>
                      {canManage(user) ? (
                        <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleOne(user.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#7c3aed' }} />
                      ) : (
                        <span style={{ display: 'inline-block', width: 16 }} />
                      )}
                    </td>
                  )}
                  {/* User */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={user.name} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>
                          {user.locale?.toUpperCase() ?? '—'}
                          {user.organisation_id
                            ? ` · ${orgMap[user.organisation_id] ?? user.organisation_id.slice(0, 8) + '…'}`
                            : ' · Platform'}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Email */}
                  <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#4b5563', fontFamily: 'monospace' }}>
                    {user.email}
                  </td>
                  {/* Role */}
                  <td style={{ padding: '14px 20px' }}>
                    <RoleBadge role={user.role} isNl={isNl} />
                  </td>
                  {/* Store assignment — only meaningful for cashier +
                      store_manager. One user, one store. The store_name
                      column comes from the backend's eager-loaded relation
                      so the table renders without a per-row fetch. */}
                  <td style={{ padding: '14px 20px', fontSize: 12 }}>
                    {(user.role === 'cashier' || user.role === 'store_manager') ? (
                      user.store_id ? (
                        <span style={{ color: '#374151', fontWeight: 600 }}>
                          {user.store_name ?? storeMap[user.store_id] ?? user.store_id.slice(0, 8) + '…'}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}
                          title={isNl ? 'Wijs een vestiging toe via Bewerken.' : 'Assign a store via Edit.'}>
                          ⚠️ {isNl ? 'Geen vestiging' : 'No store'}
                        </span>
                      )
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 11.5 }}>{isNl ? 'n.v.t.' : 'n/a'}</span>
                    )}
                  </td>
                  {/* Licence — SA-only column. Shows tier · valid_from →
                      valid_until + a status pill. Lets the SA spot at a
                      glance which orgs are running on which licence, when
                      it expires, and whether anyone's in grace/lock. */}
                  {isSuperAdmin && (
                    <td style={{ padding: '14px 20px', fontSize: 12 }}>
                      {user.org_license ? (() => {
                        const lic = user.org_license
                        const statusColor: Record<string, { bg: string; fg: string; border: string }> = {
                          active:     { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
                          warning_30: { bg: '#fefce8', fg: '#a16207', border: '#fde68a' },
                          warning_14: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
                          grace:      { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
                          soft_lock:  { bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' },
                          hard_lock:  { bg: '#1f1f1f', fg: '#fecaca', border: '#7f1d1d' },
                        }
                        const c = statusColor[lic.renewal_status] ?? statusColor.active
                        const statusLabel: Record<string, { nl: string; en: string }> = {
                          active:     { nl: 'Actief',          en: 'Active' },
                          warning_30: { nl: '< 30 dagen',      en: '< 30 days' },
                          warning_14: { nl: '< 14 dagen',      en: '< 14 days' },
                          grace:      { nl: 'Verlopen (grace)', en: 'Expired (grace)' },
                          soft_lock:  { nl: 'Soft-lock',       en: 'Soft-lock' },
                          hard_lock:  { nl: 'Hard-lock',       en: 'Hard-lock' },
                        }
                        const sl = statusLabel[lic.renewal_status] ?? statusLabel.active
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: '#1c1c2e', textTransform: 'capitalize' }}>{lic.tier}</span>
                              <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 10.5, fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
                                {sl[isNl ? 'nl' : 'en']}
                              </span>
                            </div>
                            <div style={{ color: '#9090a0', fontSize: 11 }}>
                              {lic.valid_from ?? '—'} → {lic.valid_until ?? '—'}
                            </div>
                          </div>
                        )
                      })() : (
                        user.organisation_id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: 11.5 }}
                            title={isNl ? 'Geen actieve licentie — vestigingen kunnen niet aangemaakt worden tot er een licentie is uitgegeven.' : 'No active licence — stores cannot be created until one is issued.'}>
                            ⚠️ {isNl ? 'Geen licentie' : 'No licence'}
                          </span>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: 11.5 }}>{isNl ? 'n.v.t.' : 'n/a'}</span>
                        )
                      )}
                    </td>
                  )}
                  {/* 2FA */}
                  <td style={{ padding: '14px 20px' }}>
                    {user.two_factor_enabled ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {isNl ? 'Actief' : 'Active'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>—</span>
                    )}
                  </td>
                  {/* Last login */}
                  <td style={{ padding: '14px 20px', fontSize: 12.5, color: '#9090a0' }}>
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString(isNl ? 'nl-SR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  {/* Status */}
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: user.is_active ? '#f0fdf4' : '#f9fafb', color: user.is_active ? '#15803d' : '#9ca3af', border: `1px solid ${user.is_active ? '#bbf7d0' : '#e5e7eb'}` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: user.is_active ? '#22c55e' : '#d1d5db' }} />
                      {user.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
                    </span>
                  </td>
                  {/* Actions */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setEditTarget(user)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e0e0ed', background: '#f8f7ff', color: '#6d28d9', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        {isNl ? 'Bewerken' : 'Edit'}
                      </button>
                      <button
                        onClick={() => setStatusTarget(user)}
                        style={{
                          padding: '5px 10px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                          ...(user.is_active
                            ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                            : { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }),
                        }}
                      >
                        {user.is_active ? (isNl ? 'Deactiveren' : 'Deactivate') : (isNl ? 'Activeren' : 'Activate')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(users ?? []).length === 0 && (
                <tr>
                  <td colSpan={8 + (canManageUsers ? 1 : 0) + (isSuperAdmin ? 1 : 0)} style={{ padding: 0 }}>
                    <EmptyState
                      icon="👥"
                      isNl={isNl}
                      title={{ nl: 'Geen gebruikers gevonden', en: 'No users found' }}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isLoading && total > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: '#9090a0' }}>
              {total} {isNl ? 'gebruikers in totaal' : 'users total'}
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          orgs={orgs} isNl={isNl}
          onClose={() => setShowCreate(false)}
          onCreated={(user, password) => { setShowCreate(false); setCreatedUser({ user, password }) }}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget} orgs={orgs} isNl={isNl}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Styled confirm replaces window.confirm() — Escape closes,
          mutation pin keeps dialog open while update is in flight. */}
      <ConfirmDialog
        isOpen={statusTarget !== null}
        loading={toggleStatus.isPending}
        tone={statusTarget?.is_active ? 'danger' : 'default'}
        title={
          statusTarget?.is_active
            ? (isNl ? 'Gebruiker deactiveren?' : 'Deactivate user?')
            : (isNl ? 'Gebruiker activeren?' : 'Activate user?')
        }
        message={
          statusTarget?.is_active
            ? (isNl
                ? `${statusTarget?.name} kan vanaf nu niet meer inloggen op het Dashboard of de POS.`
                : `${statusTarget?.name} will no longer be able to sign in to the Dashboard or POS.`)
            : (isNl
                ? `${statusTarget?.name} krijgt opnieuw toegang met hun bestaande wachtwoord.`
                : `${statusTarget?.name} will regain access using their existing password.`)
        }
        confirmLabel={
          statusTarget?.is_active
            ? (isNl ? 'Deactiveer' : 'Deactivate')
            : (isNl ? 'Activeer'   : 'Activate')
        }
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => statusTarget && toggleStatus.mutate({ id: statusTarget.id, active: !statusTarget.is_active })}
      />

      {/* Bulk activate / deactivate confirm — spell out how many rows will
          actually change (skipping those already in the target state). */}
      <ConfirmDialog
        isOpen={bulkAction !== null}
        tone={bulkAction === 'deactivate' ? 'danger' : 'default'}
        title={
          bulkAction === 'deactivate'
            ? (isNl ? 'Geselecteerde gebruikers deactiveren?' : 'Deactivate selected users?')
            : (isNl ? 'Geselecteerde gebruikers activeren?' : 'Activate selected users?')
        }
        message={(() => {
          const n = selectedUsers.filter((u) => u.is_active !== (bulkAction === 'activate')).length
          return bulkAction === 'deactivate'
            ? (isNl
                ? `${n} gebruiker(s) kunnen niet meer inloggen op het Dashboard of de POS.`
                : `${n} user(s) will no longer be able to sign in to the Dashboard or POS.`)
            : (isNl
                ? `${n} gebruiker(s) krijgen opnieuw toegang met hun bestaande wachtwoord.`
                : `${n} user(s) will regain access using their existing password.`)
        })()}
        confirmLabel={
          bulkAction === 'deactivate'
            ? (isNl ? 'Deactiveer' : 'Deactivate')
            : (isNl ? 'Activeer'   : 'Activate')
        }
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => runBulk(bulkAction === 'activate')}
      />
    </div>
  )
}
