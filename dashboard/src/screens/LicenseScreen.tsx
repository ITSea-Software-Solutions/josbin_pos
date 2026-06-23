import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import { getOrganisations, type Organisation } from '@/api/organisations'
import {
  getLicenses, requestRenewal, createLicense, updateLicense, deleteLicense,
  type License,
} from '@/api/licenses'

/** Compose a printable / emailable certificate text. */
function buildLicenseSummary(lic: License, isNl: boolean): string {
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString(isNl ? 'nl-NL' : 'en-GB') : '—'
  return [
    isNl ? 'Josbin POS — Licentiecertificaat' : 'Josbin POS — License Certificate',
    '═════════════════════════════════════════',
    '',
    `${isNl ? 'Referentie'      : 'Reference'      }:  ${lic.reference}`,
    `${isNl ? 'Organisatie'     : 'Organisation'   }:  ${lic.organisation_name}`,
    `${isNl ? 'Tier'            : 'Tier'           }:  ${lic.tier}`,
    `${isNl ? 'Max. vestigingen': 'Max. stores'    }:  ${lic.max_stores}`,
    `${isNl ? 'Max. terminals'  : 'Max. terminals' }:  ${lic.max_terminals}`,
    `${isNl ? 'Geldig vanaf'    : 'Valid from'     }:  ${fmt(lic.valid_from)}`,
    `${isNl ? 'Geldig tot'      : 'Valid until'    }:  ${fmt(lic.valid_until)}`,
    `${isNl ? 'Status'          : 'Status'         }:  ${lic.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Geannuleerd' : 'Cancelled')}`,
    lic.issued_at ? `${isNl ? 'Uitgegeven op' : 'Issued on'}:  ${fmt(lic.issued_at)}` : '',
    '',
    isNl
      ? 'Quote dit referentienummer in alle communicatie met Josbin POS support.'
      : 'Quote this reference number in all communication with Josbin POS support.',
  ].filter(Boolean).join('\n')
}

function buildEmailSubject(lic: License, isNl: boolean): string {
  return isNl
    ? `Uw Josbin POS licentie — ${lic.reference}`
    : `Your Josbin POS license — ${lic.reference}`
}

// Licence fetchers + mutations now live in @/api/licenses (imported at top).

// ─── Sub-components ───────────────────────────────────────────────────────────
const URGENCY_CFG = {
  ok:       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: { nl: 'Geldig',     en: 'Valid'    } },
  medium:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b', label: { nl: '30 dagen',   en: '30 days'  } },
  high:     { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', dot: '#f97316', label: { nl: 'Vernieuwen', en: 'Renew'    } },
  critical: { bg: '#fef2f2', color: '#7f1d1d', border: '#fecaca', dot: '#ef4444', label: { nl: 'Kritiek',    en: 'Critical' } },
}

const TIER_CFG: Record<string, { bg: string; color: string }> = {
  standard:     { bg: '#eef2ff', color: '#4338ca' },
  professional: { bg: '#f3f0ff', color: '#6d28d9' },
  enterprise:   { bg: '#eff6ff', color: '#1d4ed8' },
}

function UrgencyBadge({ urgency, isNl }: { urgency: License['urgency']; isNl: boolean }) {
  const c = URGENCY_CFG[urgency]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label[isNl ? 'nl' : 'en']}
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const c = TIER_CFG[tier] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
      background: c.bg, color: c.color, textTransform: 'capitalize' as const, letterSpacing: '0.3px',
    }}>
      {tier}
    </span>
  )
}

function DaysGauge({ days, isNl }: { days: number; isNl: boolean }) {
  // Always render whole days even if the API ever sneaks in a float again.
  const n = Math.round(days)
  const expired = n < 0
  const color = expired ? '#dc2626' : n <= 14 ? '#ea580c' : n <= 30 ? '#d97706' : '#16a34a'
  const bg    = expired ? '#fef2f2' : n <= 14 ? '#fff7ed' : n <= 30 ? '#fffbeb' : '#f0fdf4'
  return (
    <span style={{ fontWeight: 800, fontSize: 15, color, background: bg, padding: '3px 10px', borderRadius: 8, whiteSpace: 'nowrap' as const }}>
      {expired
        ? `−${Math.abs(n)} ${isNl ? 'dag.' : 'days'}`
        : `${n} ${isNl ? 'dag.' : 'days'}`}
    </span>
  )
}

function OrgAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const hue = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % 360
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,30%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800,
    }}>
      {initials}
    </div>
  )
}

function RenewalModal({ license, isNl, onClose }: { license: License; isNl: boolean; onClose: () => void }) {
  const [notes, setNotes] = useState('')
  const [done, setDone]   = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => requestRenewal(license.id, notes),
    onSuccess: () => {
      setDone(true)
      qc.invalidateQueries({ queryKey: ['licenses'] })
    },
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#166534', marginBottom: 8 }}>
              {isNl ? 'Aanvraag ingediend' : 'Request submitted'}
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              {isNl ? 'U wordt binnen 1 werkdag gecontacteerd.' : 'You will be contacted within 1 business day.'}
            </p>
            <button onClick={onClose} style={{ padding: '11px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {isNl ? 'Sluiten' : 'Close'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1c1c2e', marginBottom: 3 }}>
                  {isNl ? 'Licentie vernieuwen' : 'Renew license'}
                </h3>
                <p style={{ fontSize: 13, color: '#9090a0' }}>
                  {license.organisation_name} · <span style={{ textTransform: 'capitalize' }}>{license.tier}</span>
                </p>
              </div>
              <button onClick={onClose} style={{ background: '#f5f5fb', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>×</button>
            </div>

            {/* License info card */}
            <div style={{ background: '#f5f5fb', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 20 }}>
              {[
                { label: isNl ? 'Geldig tot' : 'Valid until', value: new Date(license.valid_until).toLocaleDateString(isNl ? 'nl-SR' : 'en-US') },
                { label: isNl ? 'Vestigingen' : 'Stores',    value: `${license.max_stores}` },
                { label: isNl ? 'Terminals' : 'Terminals',   value: `${license.max_terminals}` },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1c1c2e' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                {isNl ? 'Opmerkingen (optioneel)' : 'Notes (optional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isNl ? 'Bijv. verlenging voor 12 maanden, zelfde tier…' : 'E.g. renewal for 12 months, same tier…'}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, resize: 'none', outline: 'none', lineHeight: 1.5 }}
              />
            </div>

            {mutation.isError && (
              <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
                {isNl ? 'Er is een fout opgetreden.' : 'An error occurred.'}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                style={{ flex: 1, padding: '11px 0', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mutation.isPending ? 0.6 : 1 }}
              >
                {mutation.isPending ? (isNl ? 'Versturen...' : 'Sending...') : (isNl ? 'Aanvraag versturen' : 'Submit request')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Issue / Edit license modal (Super Admin only) ───────────────────────────
function LicenseFormModal({
  license, isNl, onClose,
}: { license: License | 'new'; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const isNew = license === 'new'
  const today = new Date().toISOString().slice(0, 10)
  const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  const [orgId, setOrgId] = useState(isNew ? '' : license.organisation_id)
  const [tier, setTier] = useState<License['tier']>(isNew ? 'standard' : license.tier)
  const [maxStores, setMaxStores] = useState(isNew ? 1 : license.max_stores)
  const [maxTerminals, setMaxTerminals] = useState(isNew ? 4 : license.max_terminals)
  const [validFrom, setValidFrom] = useState(isNew ? today : license.valid_from.slice(0, 10))
  const [validUntil, setValidUntil] = useState(isNew ? nextYear : license.valid_until.slice(0, 10))
  const [isActive, setIsActive] = useState(isNew ? true : license.is_active)
  const [error, setError] = useState('')

  const { data: orgs = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => getOrganisations(),
    enabled: isNew, // only need the dropdown when issuing new
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { organisation_id: orgId, tier, max_stores: maxStores, max_terminals: maxTerminals, valid_from: validFrom, valid_until: validUntil }
      return isNew
        ? createLicense(payload)
        : updateLicense(license.id, { tier, max_stores: maxStores, max_terminals: maxTerminals, valid_from: validFrom, valid_until: validUntil, is_active: isActive })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['licenses'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Fout' : 'Error')),
  })

  const canSubmit = !!orgId && maxStores > 0 && maxTerminals > 0 && validFrom < validUntil

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f0f0f8' }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
            {isNew ? (isNl ? 'Nieuwe licentie uitgeven' : 'Issue new license')
                   : (isNl ? 'Licentie bewerken' : 'Edit license')}
          </h3>
          <p style={{ fontSize: 12, color: '#9090a0', marginTop: 4 }}>
            {isNew
              ? (isNl ? 'In-dashboard licentie. Voor on-prem IonCube-installaties: gebruik de Licence Server (zie hoofdstuk 16).' : 'In-dashboard licence. For on-prem IonCube installs use the Licence Server (see ch 16).')
              : (typeof license !== 'string' ? license.organisation_name : '')}
          </p>
        </div>
        <div style={{ padding: '18px 24px 20px' }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>}

          {isNew && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Organisatie *' : 'Organisation *'}</label>
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)}
                style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, background: '#fff' }}>
                <option value="">{isNl ? '— kies een organisatie —' : '— pick an organisation —'}</option>
                {(orgs as Organisation[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Tier</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['standard', 'professional', 'enterprise'] as const).map((t) => (
                <button key={t} onClick={() => setTier(t)} type="button"
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: tier === t ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: tier === t ? '#f5f0ff' : '#fff', fontSize: 12, fontWeight: 700, color: tier === t ? '#7c3aed' : '#6b7280', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Max. vestigingen' : 'Max. stores'}</label>
              <input type="number" min={1} max={200} value={maxStores} onChange={(e) => setMaxStores(parseInt(e.target.value) || 1)}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Max. terminals' : 'Max. terminals'}</label>
              <input type="number" min={1} max={2000} value={maxTerminals} onChange={(e) => setMaxTerminals(parseInt(e.target.value) || 1)}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Geldig vanaf' : 'Valid from'}</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Geldig tot' : 'Valid until'}</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13 }} />
            </div>
          </div>

          {!isNew && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {isNl ? 'Licentie actief' : 'License is active'}
            </label>
          )}

          <p style={{ fontSize: 11, color: '#9090a0', marginBottom: 14, lineHeight: 1.5 }}>
            {isNl
              ? 'De vestiging-limiet (max. vestigingen) wordt afgedwongen op het moment dat de Org Admin probeert een nieuwe vestiging aan te maken (409 LICENSE_STORE_LIMIT_REACHED).'
              : 'The store limit (max. stores) is enforced when an Org Admin tries to create a new store (409 LICENSE_STORE_LIMIT_REACHED).'}
          </p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
            <button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}
              style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!canSubmit || mutation.isPending) ? 0.5 : 1 }}>
              {mutation.isPending ? '…' : (isNew ? (isNl ? 'Licentie uitgeven' : 'Issue license') : (isNl ? 'Opslaan' : 'Save'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function LicenseScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore((s) => s.isSuperAdmin())
  const qc = useQueryClient()
  const [renewTarget, setRenewTarget] = useState<License | null>(null)
  const [formTarget, setFormTarget] = useState<License | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copyLicense(lic: License) {
    const txt = buildLicenseSummary(lic, isNl)
    try {
      await navigator.clipboard.writeText(txt)
      setCopiedId(lic.id)
      setTimeout(() => setCopiedId((curr) => (curr === lic.id ? null : curr)), 1600)
    } catch {
      // Older browsers / non-https — fall back to a hidden textarea select.
      const ta = document.createElement('textarea')
      ta.value = txt; ta.style.position = 'fixed'; ta.style.top = '-1000px'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedId(lic.id)
      setTimeout(() => setCopiedId((curr) => (curr === lic.id ? null : curr)), 1600)
    }
  }

  function emailLicense(lic: License) {
    const subject = encodeURIComponent(buildEmailSubject(lic, isNl))
    const body    = encodeURIComponent(buildLicenseSummary(lic, isNl))
    // mailto: opens the OS mail client — works without any backend mail config.
    // For server-side sending (BCC vendor, log to audit) wire a Mailable later.
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLicense(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['licenses'] }); setDeleteTarget(null) },
  })

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: getLicenses,
  })

  const total         = licenses?.length ?? 0
  const activeCount   = licenses?.filter((l) => l.is_active).length ?? 0
  const criticalCount = licenses?.filter((l) => l.urgency === 'critical').length ?? 0
  const highCount     = licenses?.filter((l) => l.urgency === 'high').length ?? 0

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Licentiebeheer' : 'License Management'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl
              ? 'Beheer en verleng licenties voor alle organisaties op het platform.'
              : 'Manage and renew licenses for all organisations on the platform.'}
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setFormTarget('new')}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            + {isNl ? 'Nieuwe licentie' : 'Issue license'}
          </button>
        )}
      </div>

      {/* Stats row */}
      {!isLoading && licenses && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24, maxWidth: 720 }}>
          {[
            { label: isNl ? 'Totaal'    : 'Total',    value: total,         color: '#7c3aed' },
            { label: isNl ? 'Actief'    : 'Active',   value: activeCount,   color: '#16a34a' },
            { label: isNl ? 'Verlopen'  : 'Expiring', value: highCount,     color: '#d97706' },
            { label: isNl ? 'Kritiek'   : 'Critical', value: criticalCount, color: '#dc2626' },
          ].map((s) => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14,
              padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9090a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alert banners */}
      {criticalCount > 0 && (
        <div style={{
          marginBottom: 14, padding: '14px 20px', borderRadius: 12,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: '#7f1d1d', fontWeight: 700 }}>
            {isNl
              ? `${criticalCount} licentie${criticalCount > 1 ? 's' : ''} vereisen onmiddellijke actie — verlopen of in noodperiode.`
              : `${criticalCount} license${criticalCount > 1 ? 's' : ''} require immediate action — expired or in grace period.`}
          </p>
        </div>
      )}
      {highCount > 0 && (
        <div style={{
          marginBottom: 20, padding: '14px 20px', borderRadius: 12,
          background: '#fff7ed', border: '1px solid #fed7aa',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, color: '#9a3412', fontWeight: 700 }}>
            {isNl
              ? `${highCount} licentie${highCount > 1 ? 's' : ''} verlopen binnen 14 dagen. Verleng zo snel mogelijk.`
              : `${highCount} license${highCount > 1 ? 's' : ''} expire within 14 days. Renew soon.`}
          </p>
        </div>
      )}

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', marginBottom: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f3f3f8' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f0f0f8', flexShrink: 0 }} />
                <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#f0f0f8', maxWidth: 200 }} />
                <div style={{ width: 70, height: 20, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 100, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                <div style={{ width: 60, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[
                  isNl ? 'Organisatie' : 'Organisation',
                  isNl ? 'Tier' : 'Tier',
                  isNl ? 'Limieten' : 'Limits',
                  isNl ? 'Geldig tot' : 'Valid until',
                  isNl ? 'Resterende dagen' : 'Days left',
                  isNl ? 'Laatste validatie' : 'Last validated',
                  isNl ? 'Status' : 'Status',
                  '',
                ].map((h) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(licenses ?? []).map((lic, i) => {
                const expired = lic.days_remaining < 0
                return (
                  <tr
                    key={lic.id}
                    style={{ borderBottom: i < (licenses?.length ?? 0) - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <OrgAvatar name={lic.organisation_name} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{lic.organisation_name}</div>
                          <div style={{ fontSize: 11.5, color: '#7c3aed', marginTop: 2, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600, letterSpacing: '0.3px' }}>
                            {lic.reference}
                          </div>
                          {lic.issued_at && (
                            <div style={{ fontSize: 10.5, color: '#9090a0', marginTop: 1 }}>
                              {isNl ? 'Uitgegeven' : 'Issued'}: {new Date(lic.issued_at).toLocaleDateString(isNl ? 'nl-NL' : 'en-GB')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <TierBadge tier={lic.tier} />
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 600 }}>
                        {lic.max_stores} {isNl ? 'vestig.' : 'stores'}
                      </div>
                      <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>
                        {lic.max_terminals} {isNl ? 'terminals' : 'terminals'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13.5, fontWeight: expired ? 700 : 600, color: expired ? '#dc2626' : '#1c1c2e' }}>
                        {new Date(lic.valid_until).toLocaleDateString(isNl ? 'nl-SR' : 'en-US')}
                      </div>
                      {lic.grace_period_ends_at && (
                        <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2, fontWeight: 600 }}>
                          {isNl ? 'Noodperiode tot ' : 'Grace until '}
                          {new Date(lic.grace_period_ends_at).toLocaleDateString(isNl ? 'nl-SR' : 'en-US')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <DaysGauge days={lic.days_remaining} isNl={isNl} />
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: '#9090a0' }}>
                      {lic.last_validated_at
                        ? new Date(lic.last_validated_at).toLocaleString(isNl ? 'nl-SR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      {lic.renewal_status === 'renewal_pending' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
                          {isNl ? 'In behandeling' : 'Pending'}
                        </span>
                      ) : (
                        <UrgencyBadge urgency={lic.urgency} isNl={isNl} />
                      )}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => copyLicense(lic)}
                          title={isNl ? 'Kopieer licentiecertificaat' : 'Copy license certificate'}
                          style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid ' + (copiedId === lic.id ? '#86efac' : '#e5e7eb'), background: copiedId === lic.id ? '#f0fdf4' : '#f9f9f9', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: copiedId === lic.id ? '#15803d' : '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {copiedId === lic.id ? (isNl ? '✓ Gekopieerd' : '✓ Copied') : (isNl ? '⧉ Kopiëren' : '⧉ Copy')}
                        </button>
                        <button onClick={() => emailLicense(lic)}
                          title={isNl ? 'Per e-mail naar klant verzenden' : 'Email to customer'}
                          style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          ✉ {isNl ? 'E-mail' : 'Email'}
                        </button>
                        {lic.renewal_status !== 'renewal_pending' && lic.urgency !== 'ok' && (
                          <button onClick={() => setRenewTarget(lic)}
                            style={{ padding: '6px 12px', borderRadius: 8, background: lic.urgency === 'critical' ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {isNl ? 'Vernieuwen' : 'Renew'}
                          </button>
                        )}
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => setFormTarget(lic)} title={isNl ? 'Bewerken' : 'Edit'}
                              style={{ height: 28, width: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', cursor: 'pointer', fontSize: 13 }}>✎</button>
                            <button onClick={() => setDeleteTarget(lic)} title={isNl ? 'Deactiveren' : 'Deactivate'}
                              disabled={!lic.is_active}
                              style={{ height: 28, width: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: lic.is_active ? 'pointer' : 'not-allowed', fontSize: 13, opacity: lic.is_active ? 1 : 0.4 }}>🗑</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(licenses ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                      {isNl ? 'Geen licenties gevonden' : 'No licenses found'}
                    </div>
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
              {total} {isNl ? 'licenties in totaal' : 'licenses total'}
            </span>
          </div>
        )}
      </div>

      {/* Timeline legend */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef', padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {isNl ? 'Verlooptijdlijn' : 'Expiry timeline'}
        </p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { color: '#22c55e', label: isNl ? '> 30 dagen — volledig operationeel'                          : '> 30 days — fully operational' },
            { color: '#f59e0b', label: isNl ? '≤ 30 dagen — gele banner + dagelijkse e-mail'               : '≤ 30 days — yellow banner + daily email' },
            { color: '#ea580c', label: isNl ? '≤ 14 dagen — oranje banner, POS normaal'                    : '≤ 14 days — orange banner, POS unaffected' },
            { color: '#dc2626', label: isNl ? 'Verlopen + 14 dgn noodperiode — rode banner'                : 'Expired + 14-day grace period — red banner' },
            { color: '#7f1d1d', label: isNl ? 'Noodperiode +30 dgn — SOFT LOCK nieuw verkopen geblokkeerd' : 'Grace + 30 days — SOFT LOCK new sales blocked' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Renewal modal */}
      {renewTarget && (
        <RenewalModal license={renewTarget} isNl={isNl} onClose={() => setRenewTarget(null)} />
      )}

      {/* Issue / Edit modal (Super Admin) */}
      {formTarget && (
        <LicenseFormModal license={formTarget} isNl={isNl} onClose={() => setFormTarget(null)} />
      )}

      {/* Deactivate confirm */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1c1c2e', marginBottom: 10 }}>
              {isNl ? `Licentie deactiveren?` : `Deactivate license?`}
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              <strong>{deleteTarget.organisation_name}</strong> — {deleteTarget.tier}.{' '}
              {isNl
                ? 'De licentierij blijft staan in het auditlogboek; alleen is_active wordt op false gezet. Vestiging-aanmaken stopt onmiddellijk.'
                : 'The licence row remains in the audit log; only is_active is set to false. Store-creation stops immediately.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button onClick={() => deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleteMut.isPending ? 0.5 : 1 }}>
                {deleteMut.isPending ? '…' : (isNl ? 'Deactiveren' : 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
