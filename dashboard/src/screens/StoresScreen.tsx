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
import { useDashboardAuthStore } from '@/store/authStore'
import {
  getOrganisations, getOrgStores, createStore, updateStore, deactivateStore,
  type Organisation, type Store, type CreateStorePayload,
} from '@/api/organisations'

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
  const [form, setForm] = useState<CreateStorePayload>({
    name: '', address: '', city: '', default_btw_rate: '10.00', pos_type: 'native',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => createStore(orgId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org-stores', orgId] }); onClose() },
    onError: (e: unknown) => {
      const r = (e as { response?: { data?: { message?: string; code?: string } } })?.response?.data
      setError(r?.code === 'LICENSE_STORE_LIMIT_REACHED'
        ? (isNl
            ? `${r.message ?? 'Licentie-limiet bereikt.'} Vraag uw vendor om de licentie uit te breiden.`
            : `${r.message ?? 'License limit reached.'} Ask your vendor to extend the licence.`)
        : (r?.message ?? (isNl ? 'Aanmaken mislukt' : 'Create failed')))
    },
  })

  const ok = form.name.trim().length >= 2 && form.city && form.address

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f0f0f8' }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
            {isNl ? 'Nieuwe vestiging' : 'New store'}
          </h3>
          <p style={{ fontSize: 12, color: '#9090a0', marginTop: 4 }}>
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
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: form.pos_type === t ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: form.pos_type === t ? '#f5f0ff' : '#fff', fontSize: 12, fontWeight: 700, color: form.pos_type === t ? '#7c3aed' : '#6b7280', cursor: 'pointer' }}>
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
              style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!ok || mutation.isPending) ? 0.5 : 1 }}>
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
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1c1c2e', marginBottom: 12 }}>
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
            style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (name.trim().length < 2 || mutation.isPending) ? 0.5 : 1 }}>
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

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Vestigingen' : 'Stores'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl
              ? 'Beheer de vestigingen van uw organisatie. Klik op een vestiging om bonopmaak, logo en BTW-instellingen te bewerken.'
              : 'Manage your organisation’s stores. Click a store to edit its receipt template, logo, and BTW settings.'}
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} disabled={!activeOrgId}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: activeOrgId ? 'pointer' : 'not-allowed', opacity: activeOrgId ? 1 : 0.5, boxShadow: '0 4px 12px rgba(124,58,237,.3)', whiteSpace: 'nowrap' }}>
          + {isNl ? 'Nieuwe vestiging' : 'New store'}
        </button>
      </div>

      {/* Super-Admin org dropdown */}
      {isSuperAdmin && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f9f7ff', border: '1px solid #ede9fe', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{isNl ? 'Organisatie' : 'Organisation'}:</span>
          <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
            style={{ flex: 1, height: 32, borderRadius: 8, border: '1.5px solid #ddd6fe', padding: '0 10px', fontSize: 13, background: '#fff' }}>
            <option value="">{isNl ? '— kies een organisatie —' : '— pick an organisation —'}</option>
            {(orgs as Organisation[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      )}

      {/* Read-only org context for OA / SM */}
      {!isSuperAdmin && headerOrg && (
        <div style={{ marginBottom: 16, padding: '14px 18px', background: '#fff', border: '1px solid #e9e9ef', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {isNl ? 'Organisatie' : 'Organisation'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1c1c2e', marginTop: 2 }}>{headerOrg.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
              <span><strong>BTW:</strong> {headerOrg.btw_number || '—'}</span>
              <span><strong>{isNl ? 'Type' : 'Type'}:</strong> {TYPE_LABEL[headerOrg.type]?.[isNl ? 'nl' : 'en'] ?? headerOrg.type}</span>
              <span><strong>{isNl ? 'Taal' : 'Locale'}:</strong> {headerOrg.locale.toUpperCase()}</span>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: 11, color: '#9090a0' }}>
            {isNl
              ? 'Organisatiegegevens worden door uw Josbin POS leverancier beheerd en zijn alleen-lezen. Neem contact op met support voor wijzigingen.'
              : 'Organisation details are managed by your Josbin POS vendor and are read-only. Contact support for changes.'}
          </p>
        </div>
      )}

      {/* Stores list */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef', overflow: 'hidden' }}>
        {!activeOrgId ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9090a0', fontSize: 13 }}>
            {isNl ? 'Kies eerst een organisatie hierboven.' : 'Pick an organisation above first.'}
          </div>
        ) : isLoading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9090a0', fontSize: 13 }}>{isNl ? 'Laden…' : 'Loading…'}</div>
        ) : stores.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏬</div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              {isNl ? 'Nog geen vestigingen' : 'No stores yet'}
            </p>
            <p style={{ fontSize: 12, color: '#9090a0', marginBottom: 16 }}>
              {isNl ? 'Voeg uw eerste vestiging toe om te beginnen.' : 'Add your first store to get started.'}
            </p>
            <button onClick={() => setAddOpen(true)}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + {isNl ? 'Nieuwe vestiging' : 'New store'}
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f7ff', borderBottom: '1px solid #eeeef8' }}>
                {[isNl ? 'Naam' : 'Name', isNl ? 'Stad' : 'City', 'POS', isNl ? 'Status' : 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stores as Store[]).map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f3f8' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{s.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{s.city || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.pos_type === 'native' ? '#eef2ff' : '#fef9c3', color: s.pos_type === 'native' ? '#4338ca' : '#92400e' }}>
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

      <p style={{ marginTop: 14, fontSize: 11.5, color: '#9090a0' }}>
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
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1c1c2e', marginBottom: 10 }}>
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
