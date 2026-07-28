/**
 * Stores screen — Org Admin's home for store CRUD.
 *
 * Why this exists separately from OrganisationsScreen + StoreSettingsScreen:
 *   - OrganisationsScreen is SA-only (manages multiple orgs).
 *   - StoreSettingsScreen edits ONE store deeply (logo upload, receipt
 *     template, live preview).
 *   - This screen is the list view + add / rename / deactivate for an
 *     OA / SM. Click into a row to open Store Settings for that store.
 *
 * Org metadata (name, BTW number, address) is shown read-only at the top
 * so the OA can confirm context. OA cannot edit those — the org row is
 * created and owned by Super Admin.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getOrganisations, getOrgStores, createStore, updateStore, deactivateStore,
  type Organisation, type Store, type CreateStorePayload,
} from '@/api/organisations'
import { getLicenses, type License } from '@/api/licenses'
import { useVendor } from '@/hooks/useVendor'
import EmptyState from '@/components/shared/EmptyState'

const TYPE_LABEL: Record<string, { nl: string; en: string }> = {
  retail:    { nl: 'Detailhandel', en: 'Retail' },
  govt:      { nl: 'Overheid',     en: 'Government' },
  wholesale: { nl: 'Groothandel',  en: 'Wholesale' },
}

function StatusBadge({ active, isNl }: { active: boolean; isNl: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: active ? '#f0fdf4' : '#fef2f2',
      color:      active ? '#15803d' : '#dc2626',
      border:     `1px solid ${active ? '#bbf7d0' : '#fecaca'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#22c55e' : '#dc2626' }} />
      {active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
    </span>
  )
}

// ─── Add store modal ─────────────────────────────────────────────────────────
function AddStoreModal({ orgId, isNl, onClose }: { orgId: string; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const vendor = useVendor()
  const [form, setForm] = useState<CreateStorePayload>({
    name: '', address: '', city: '', default_btw_rate: '10.00', pos_type: 'native',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => createStore(orgId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-stores', orgId] }); qc.invalidateQueries({ queryKey: ['licenses'] }); onClose() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      // Three distinct licence failure modes. Name the vendor (Josbin) and
      // their email explicitly — "ask the Super Admin" is meaningless to an
      // OA who doesn't know what a Super Admin is. Source: useVendor hook →
      // /api/environment → config('josbin_pos.vendor').
      switch (r?.code) {
        case 'LICENSE_REQUIRED':
          setError(isNl
            ? `Geen actieve licentie. E-mail ${vendor.name} op ${vendor.email} om een licentie aan te vragen voor deze organisatie.`
            : `No active licence. Email ${vendor.name} at ${vendor.email} to request a licence for this organisation.`)
          break
        case 'LICENSE_EXPIRED':
          setError(isNl
            ? `${r.message ?? 'Licentie verlopen.'} E-mail ${vendor.name} (${vendor.email}) voor vernieuwing.`
            : `${r.message ?? 'Licence expired.'} Email ${vendor.name} (${vendor.email}) to renew.`)
          break
        case 'LICENSE_STORE_LIMIT_REACHED':
          setError(isNl
            ? `${r.message ?? 'Licentielimiet bereikt.'} E-mail ${vendor.name} (${vendor.email}) voor een hoger pakket of limietverhoging.`
            : `${r.message ?? 'License limit reached.'} Email ${vendor.name} (${vendor.email}) for a higher tier or limit extension.`)
          break
        default:
          setError(r?.message ?? (isNl ? 'Aanmaken mislukt' : 'Create failed'))
      }
    },
  })

  const ok = form.name.trim().length >= 2 && form.city && form.address

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #eef2fb' }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#16203a' }}>
            {isNl ? 'Nieuwe vestiging' : 'New store'}
          </h3>
          <p style={{ fontSize: 12, color: '#7e88a0', marginTop: 4 }}>
            {isNl ? 'De vestiging is meteen actief. Per-vestiging instellingen kunt u later in Vestigingsinstellingen aanpassen.' : 'The store is active immediately. Per-store settings can be tweaked in Store Settings later.'}
          </p>
        </div>
        <div style={{ padding: '18px 24px 20px' }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#dc2626' }}>{error}</div>}

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Naam vestiging' : 'Store name'} *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={isNl ? 'bv. De Hoop — Paramaribo Centrum' : 'e.g. De Hoop — Paramaribo Centrum'}
              style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Stad' : 'City'} *</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Standaard BTW (%)' : 'Default BTW (%)'}</label>
              <input value={form.default_btw_rate} onChange={(e) => setForm({ ...form, default_btw_rate: e.target.value })}
                style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Adres' : 'Address'} *</label>
            <input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={{ width: '100%', height: 36, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>POS type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['native', 'external'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, pos_type: t })}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: form.pos_type === t ? '2px solid #003366' : '1.5px solid #e5e7eb', background: form.pos_type === t ? '#f5f0ff' : '#fff', fontSize: 12, fontWeight: 700, color: form.pos_type === t ? '#003366' : '#6b7280', cursor: 'pointer' }}>
                  {t === 'native' ? 'Josbin POS (native)' : 'External POS (API only)'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {isNl ? 'Annuleren' : 'Cancel'}
            </button>
            <button onClick={() => mutation.mutate()} disabled={!ok || mutation.isPending}
              style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!ok || mutation.isPending) ? 0.5 : 1 }}>
              {mutation.isPending ? '…' : (isNl ? 'Vestiging aanmaken' : 'Create store')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Inline rename modal ─────────────────────────────────────────────────────
function RenameStoreModal({ store, isNl, onClose }: { store: Store; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(store.name)
  const mutation = useMutation({
    mutationFn: () => updateStore(store.id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-stores'] }); onClose() },
  })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)', padding: '22px 24px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#16203a', marginBottom: 12 }}>
          {isNl ? 'Vestiging hernoemen' : 'Rename store'}
        </h3>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          style={{ width: '100%', height: 38, borderRadius: 8, border: '1.5px solid #e5e7eb', padding: '0 12px', fontSize: 13, boxSizing: 'border-box', marginBottom: 14 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={name.trim().length < 2 || mutation.isPending}
            style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (name.trim().length < 2 || mutation.isPending) ? 0.5 : 1 }}>
            {mutation.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function StoresScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore((s) => s.isSuperAdmin())
  const user = useDashboardAuthStore((s) => s.user)
  const vendor = useVendor()
  const qc = useQueryClient()

  // SA can switch orgs via dropdown; OA + SM are locked to their own org.
  const { data: orgs = [] } = useQuery({ queryKey: ['organisations'], queryFn: getOrganisations, enabled: isSuperAdmin })
  const [selectedOrgId, setSelectedOrgId] = useState<string>(isSuperAdmin ? '' : (user?.organisation_id ?? ''))
  const activeOrgId = isSuperAdmin ? selectedOrgId : (user?.organisation_id ?? '')

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['org-stores', activeOrgId],
    queryFn: () => getOrgStores(activeOrgId),
    enabled: !!activeOrgId,
  })

  // Licence info for the active org. The /api/licenses endpoint already
  // scopes by the caller's role (SA sees all, OA sees only their own), so
  // we filter client-side by activeOrgId to pick the latest active one.
  const { data: licenses = [] } = useQuery<License[]>({
    queryKey: ['licenses'],
    queryFn: getLicenses,
    enabled: !!activeOrgId,
  })
  const orgLicense: License | undefined = licenses
    .filter((l) => l.organisation_id === activeOrgId && l.is_active)
    .sort((a, b) => (a.valid_until < b.valid_until ? 1 : -1))[0]

  // Compute whether store creation is allowed under the current licence.
  // Mirrors the backend gate in OrganisationController::storeCreate so the
  // button state matches the 422 the API would return.
  const storeCount = (stores as Store[]).length
  const noLicense    = !orgLicense
  const expired      = orgLicense?.renewal_status === 'soft_lock' || orgLicense?.renewal_status === 'hard_lock'
  const atLimit      = !!orgLicense && storeCount >= orgLicense.max_stores
  const canCreate    = !!activeOrgId && !noLicense && !expired && !atLimit
  // Concrete tooltip text on the disabled "+ Nieuwe vestiging" button so
  // the OA doesn't have to guess who to contact. Names Josbin explicitly
  // because that's who they need to email — they don't know what a
  // "Super Admin" is. Mirrors the banner copy below for consistency.
  const blockReason  = !activeOrgId ? null
    : noLicense ? (isNl
        ? `Geen actieve licentie — vraag ${vendor.name} (${vendor.email}) om er een uit te geven.`
        : `No active licence — ask ${vendor.name} (${vendor.email}) to issue one.`)
    : expired ? (isNl
        ? `Licentie verlopen op ${orgLicense!.valid_until}. Vraag ${vendor.name} (${vendor.email}) om vernieuwing.`
        : `Licence expired on ${orgLicense!.valid_until}. Ask ${vendor.name} (${vendor.email}) to renew.`)
    : atLimit ? (isNl
        ? `Licentielimiet bereikt: ${storeCount}/${orgLicense!.max_stores} vestigingen. Vraag ${vendor.name} om een hoger pakket (${vendor.email}).`
        : `Licence limit reached: ${storeCount}/${orgLicense!.max_stores} stores. Ask ${vendor.name} for a higher tier (${vendor.email}).`)
    : null

  // For OA/SM, fetch their own org row to show the read-only header.
  const { data: ownOrg } = useQuery({
    queryKey: ['my-organisation', user?.organisation_id],
    queryFn: async () => (await getOrganisations())[0],
    enabled: !isSuperAdmin && !!user?.organisation_id,
  })
  const headerOrg: Organisation | undefined = isSuperAdmin
    ? (orgs as Organisation[]).find((o) => o.id === activeOrgId)
    : ownOrg

  const [addOpen, setAddOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Store | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Store | null>(null)

  const deactivateMut = useMutation({
    mutationFn: (id: string) => deactivateStore(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-stores', activeOrgId] }); setConfirmDeactivate(null) },
  })

  // Client-side column sort (shared hook → identical behaviour across all
  // dashboard tables).
  const { sorted: sortedStores, sort, toggle, indicator } = useTableSort(stores as Store[], {
    name:   (s) => (s.name ?? '').toLowerCase(),
    city:   (s) => (s.city ?? '').toLowerCase(),
    pos:    (s) => (s.pos_type ?? '').toLowerCase(),
    status: (s) => (s.is_active ? 1 : 0),
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Vestigingen' : 'Stores'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl
              ? 'Beheer de vestigingen van uw organisatie. Klik op een vestiging om bonopmaak, logo en BTW-instellingen te bewerken.'
              : 'Manage your organisation’s stores. Click a store to edit its receipt template, logo, and BTW settings.'}
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} disabled={!canCreate}
          title={blockReason ?? undefined}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#003366,#1f2a63)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: canCreate ? 'pointer' : 'not-allowed', opacity: canCreate ? 1 : 0.5, boxShadow: '0 4px 12px rgba(0,51,102,.3)', whiteSpace: 'nowrap' }}>
          + {isNl ? 'Nieuwe vestiging' : 'New store'}
        </button>
      </div>

      {/* Super-Admin org dropdown */}
      {isSuperAdmin && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f4f6fc', border: '1px solid #e6ebf7', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#003366' }}>{isNl ? 'Organisatie' : 'Organisation'}:</span>
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
            style={{ flex: 1, height: 32, borderRadius: 8, border: '1.5px solid #d5deef', padding: '0 10px', fontSize: 13, background: '#fff' }}>
            <option value="">{isNl ? '— kies een organisatie —' : '— pick an organisation —'}</option>
            {(orgs as Organisation[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {/* Read-only org context for OA / SM */}
      {!isSuperAdmin && headerOrg && (
        <div style={{ marginBottom: 16, padding: '14px 18px', background: '#fff', border: '1px solid #e6ecf5', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {isNl ? 'Organisatie' : 'Organisation'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#16203a', marginTop: 2 }}>{headerOrg.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
              <span><strong>BTW:</strong> {headerOrg.btw_number || '—'}</span>
              <span><strong>{isNl ? 'Type' : 'Type'}:</strong> {TYPE_LABEL[headerOrg.type]?.[isNl ? 'nl' : 'en'] ?? headerOrg.type}</span>
              <span><strong>{isNl ? 'Taal' : 'Locale'}:</strong> {headerOrg.locale.toUpperCase()}</span>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: '#7e88a0' }}>
            {isNl
              ? `Organisatiegegevens worden door ${vendor.name} (uw Josbin POS leverancier) beheerd en zijn alleen-lezen. Voor wijzigingen: e-mail `
              : `Organisation details are managed by ${vendor.name} (your Josbin POS vendor) and are read-only. For changes, email `}
            <a href={`mailto:${vendor.email}?subject=${encodeURIComponent(`[${headerOrg.name}] Organisation details change request`)}`}
               style={{ color: '#003366', fontWeight: 700 }}>{vendor.email}</a>
            {isNl ? ' of bel ' : ' or call '}
            <a href={`tel:${vendor.phone.replace(/\s/g, '')}`} style={{ color: '#003366', fontWeight: 700 }}>{vendor.phone}</a>.
          </p>
        </div>
      )}

      {/* Licence banner — shows tier, expiry, usage and any block reason.
          Rendered whenever an org is selected so the OA always knows their
          licence state at a glance. Mirrors the backend gate so disabled
          buttons in this screen have a visible justification right above.

          The "no licence" variant gives a one-click mailto with the org name
          pre-filled in the subject and body, so the OA doesn't have to think
          about what to write or who to write to. */}
      {activeOrgId && (
        noLicense ? (() => {
          const orgName = headerOrg?.name ?? (isNl ? '(uw organisatie)' : '(your organisation)')
          const subject = isNl
            ? `Licentie aanvragen voor ${orgName}`
            : `License request for ${orgName}`
          const body = isNl
            ? `Beste ${vendor.name},\n\nWij willen graag een Josbin POS licentie aanvragen voor onze organisatie:\n\nOrganisatie: ${orgName}\nContactpersoon: ${user?.name ?? ''}\nE-mail: ${user?.email ?? ''}\n\nGraag horen wij welke pakketten en prijzen beschikbaar zijn.\n\nMet vriendelijke groet,\n${user?.name ?? ''}`
            : `Hello ${vendor.name},\n\nWe would like to request a Josbin POS license for our organisation:\n\nOrganisation: ${orgName}\nContact: ${user?.name ?? ''}\nEmail: ${user?.email ?? ''}\n\nPlease let us know which tiers and pricing are available.\n\nKind regards,\n${user?.name ?? ''}`
          const mailto = `mailto:${vendor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
          return (
            <div style={{ marginBottom: 16, padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>⚠️</div>
              <div style={{ flex: 1, fontSize: 13, color: '#991b1b' }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>
                  {isNl ? 'Geen actieve licentie' : 'No active licence'}
                </strong>
                <p style={{ margin: '0 0 8px' }}>
                  {isNl
                    ? `${orgName} heeft nog geen Josbin POS licentie. Zonder licentie kunt u geen vestigingen aanmaken of nieuwe gebruikers koppelen.`
                    : `${orgName} doesn't have a Josbin POS license yet. Without one you can't create stores or add new users.`}
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  {isNl ? 'Vraag een licentie aan bij ' : 'Request a license from '}
                  <strong>{vendor.name}</strong>:
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a href={mailto}
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#dc2626', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    ✉ {isNl ? 'Stuur e-mail' : 'Send email'}
                  </a>
                  <span style={{ fontSize: 11.5, color: '#7f1d1d' }}>
                    {isNl ? 'opent uw e-mailprogramma met een kant-en-klaar bericht aan ' : 'opens your email client with a pre-filled message to '}
                    <a href={`mailto:${vendor.email}`} style={{ color: '#7f1d1d', fontWeight: 700 }}>{vendor.email}</a>
                    {' · '}
                    <a href={`tel:${vendor.phone.replace(/\s/g, '')}`} style={{ color: '#7f1d1d', fontWeight: 700 }}>{vendor.phone}</a>
                  </span>
                </div>
              </div>
            </div>
          )
        })() : (() => {
          const lic = orgLicense!
          const statusColor: Record<string, { bg: string; fg: string; border: string }> = {
            active:     { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
            warning_30: { bg: '#fefce8', fg: '#a16207', border: '#fde68a' },
            warning_14: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
            grace:      { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
            soft_lock:  { bg: '#fef2f2', fg: '#991b1b', border: '#fca5a5' },
            hard_lock:  { bg: '#1f1f1f', fg: '#fecaca', border: '#7f1d1d' },
          }
          const c = statusColor[lic.renewal_status ?? 'active'] ?? statusColor.active
          return (
            <div style={{ marginBottom: 16, padding: '14px 18px', background: '#fff', border: `1px solid ${c.border}`, borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#7e88a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    {isNl ? 'Licentie' : 'Licence'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#16203a', marginTop: 2, textTransform: 'capitalize' }}>
                    {lic.tier}
                    <span style={{ marginLeft: 8, padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, textTransform: 'none' }}>
                      {lic.renewal_status === 'active' ? (isNl ? 'Actief' : 'Active') :
                       lic.renewal_status === 'warning_30' ? (isNl ? 'Verloopt < 30 dagen' : 'Expires < 30 days') :
                       lic.renewal_status === 'warning_14' ? (isNl ? 'Verloopt < 14 dagen' : 'Expires < 14 days') :
                       lic.renewal_status === 'grace'      ? (isNl ? 'Verlopen (grace)'   : 'Expired (grace)') :
                       lic.renewal_status === 'soft_lock'  ? (isNl ? 'Soft-lock'          : 'Soft-lock') :
                                                              (isNl ? 'Hard-lock'         : 'Hard-lock')}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 24, marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
                  <span><strong>{isNl ? 'Geldig' : 'Valid'}:</strong> {lic.valid_from} → {lic.valid_until}</span>
                  <span style={{ color: atLimit ? '#dc2626' : '#15803d', fontWeight: 700 }}>
                    <strong>{isNl ? 'Vestigingen' : 'Stores'}:</strong> {storeCount} / {lic.max_stores}
                  </span>
                  <span><strong>Ref:</strong> {lic.reference}</span>
                </div>
              </div>
              {blockReason && (
                <p style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                  ⚠️ {blockReason}
                </p>
              )}
            </div>
          )
        })()
      )}

      {/* Stores list */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6ecf5', overflow: 'hidden' }}>
        {!activeOrgId ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#7e88a0', fontSize: 13 }}>
            {isNl ? 'Kies eerst een organisatie hierboven.' : 'Pick an organisation above first.'}
          </div>
        ) : isLoading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#7e88a0', fontSize: 13 }}>{isNl ? 'Laden…' : 'Loading…'}</div>
        ) : stores.length === 0 ? (
          <EmptyState
            icon="🏬"
            isNl={isNl}
            title={{ nl: 'Nog geen vestigingen', en: 'No stores yet' }}
            description={{ nl: 'Voeg uw eerste vestiging toe om te beginnen.', en: 'Add your first store to get started.' }}
            cta={{
              label: { nl: '+ Nieuwe vestiging', en: '+ New store' },
              onClick: () => setAddOpen(true),
              disabled: !canCreate,
              title: blockReason ?? undefined,
            }}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f4f6fc', borderBottom: '1px solid #e9eef9' }}>
                {[
                  { key: 'name',   label: isNl ? 'Naam' : 'Name' },
                  { key: 'city',   label: isNl ? 'Stad' : 'City' },
                  { key: 'pos',    label: 'POS' },
                  { key: 'status', label: isNl ? 'Status' : 'Status' },
                  { key: '',       label: '' },
                ].map((h) => (
                  <th key={h.label || 'actions'}
                    onClick={h.key ? () => toggle(h.key) : undefined}
                    style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                    {h.label}
                    {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#003366' : '#c0c0cc' }}>{indicator(h.key)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedStores.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f4fb' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#16203a' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{s.city || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.pos_type === 'native' ? '#eef2ff' : '#fef9c3', color: s.pos_type === 'native' ? '#1a234f' : '#92400e' }}>
                      {s.pos_type === 'native' ? 'Josbin' : 'External'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge active={s.is_active} isNl={isNl} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => setRenameTarget(s)} title={isNl ? 'Hernoemen' : 'Rename'}
                        style={{ height: 28, width: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', cursor: 'pointer', fontSize: 12 }}>✎</button>
                      <button onClick={() => setConfirmDeactivate(s)} title={isNl ? 'Deactiveren' : 'Deactivate'} disabled={!s.is_active}
                        style={{ height: 28, width: 28, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: s.is_active ? 'pointer' : 'not-allowed', fontSize: 12, opacity: s.is_active ? 1 : 0.4 }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: 14, fontSize: 11.5, color: '#7e88a0' }}>
        💡 {isNl
          ? 'Bonopmaak (header, footer, logo, BTW-nummer) per vestiging: ga naar Vestigingsinstellingen in het zijmenu en kies de vestiging.'
          : 'Per-store receipt template (header, footer, logo, BTW number): go to Store Settings in the sidebar and pick the store.'}
      </p>

      {addOpen && activeOrgId && (
        <AddStoreModal orgId={activeOrgId} isNl={isNl} onClose={() => setAddOpen(false)} />
      )}
      {renameTarget && (
        <RenameStoreModal store={renameTarget} isNl={isNl} onClose={() => setRenameTarget(null)} />
      )}
      {confirmDeactivate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeactivate(null) }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#16203a', marginBottom: 10 }}>
              {isNl ? 'Vestiging deactiveren?' : 'Deactivate store?'}
            </h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              <strong>{confirmDeactivate.name}</strong> — {isNl
                ? 'Deze vestiging verdwijnt uit de POS-kiezer maar blijft in alle rapporten en het auditlogboek. Alle bestaande verkopen blijven leesbaar.'
                : 'This store disappears from the POS picker but remains in all reports and the audit log. Existing sales stay readable.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDeactivate(null)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button onClick={() => deactivateMut.mutate(confirmDeactivate.id)} disabled={deactivateMut.isPending}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deactivateMut.isPending ? 0.5 : 1 }}>
                {deactivateMut.isPending ? '…' : (isNl ? 'Deactiveren' : 'Deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
