import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '@/api/client'
import { useDashboardAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/shared/Toast'
import {
  getOrganisations, getOrganisation, createOrganisation, updateOrganisation,
  getOrgStores, createStore,
  type Organisation, type Store, type CreateOrgPayload, type CreateStorePayload,
} from '@/api/organisations'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function pushCatalogue(orgId: string): Promise<{ product_count: number }> {
  const res = await apiClient.post('/products/push', {}, { headers: { 'X-Organisation-Push': orgId } })
  return res.data
}

const TYPE_CFG: Record<string, { bg: string; color: string; border: string; icon: string; nl: string; en: string }> = {
  retail:    { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: '🛍️', nl: 'Detailhandel', en: 'Retail'      },
  govt:      { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: '🏛️', nl: 'Overheid',     en: 'Government'  },
  wholesale: { bg: '#fffbeb', color: '#92400e', border: '#fde68a', icon: '📦', nl: 'Groothandel',  en: 'Wholesale'   },
}

const TIER_CFG: Record<string, { bg: string; color: string }> = {
  starter:      { bg: '#f3f4f6', color: '#4b5563' },
  professional: { bg: '#ede9fe', color: '#6d28d9' },
  enterprise:   { bg: '#dbeafe', color: '#1e40af' },
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 14, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box',
}

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#7c3aed'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,.12)'
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#e5e7eb'
  e.currentTarget.style.boxShadow = 'none'
}

function TypeBadge({ type, isNl }: { type: string; isNl: boolean }) {
  const c = TYPE_CFG[type] ?? TYPE_CFG.retail
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c[isNl ? 'nl' : 'en']}
    </span>
  )
}

function StatusBadge({ active, isNl }: { active: boolean; isNl: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: active ? '#f0fdf4' : '#f9fafb',
      color: active ? '#15803d' : '#9ca3af',
      border: `1px solid ${active ? '#bbf7d0' : '#e5e7eb'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#22c55e' : '#d1d5db' }} />
      {active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
    </span>
  )
}

// ─── OrgRow ───────────────────────────────────────────────────────────────────
function OrgRow({
  org, isNl,
  onView, onEdit,
}: {
  org: Organisation; isNl: boolean
  onView: (o: Organisation) => void
  onEdit: (o: Organisation) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [pushState, setPushState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [showConfirm, setShowConfirm] = useState(false)

  const typeCfg = TYPE_CFG[org.type] ?? TYPE_CFG.retail
  const tierCfg = TIER_CFG[org.subscription_tier ?? 'starter'] ?? TIER_CFG.starter

  const toggleStatus = useMutation({
    mutationFn: () => updateOrganisation(org.id, { is_active: !org.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisations'] })
      setShowConfirm(false)
      toast.success(
        org.is_active
          ? (isNl ? 'Organisatie gedeactiveerd' : 'Organisation deactivated')
          : (isNl ? 'Organisatie geactiveerd'   : 'Organisation activated'),
      )
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Bewerking mislukt: ${msg}` : `Operation failed: ${msg}`)
    },
  })

  async function handlePush() {
    if (pushState === 'sending') return
    setPushState('sending')
    try { await pushCatalogue(org.id); setPushState('done'); setTimeout(() => setPushState('idle'), 3000) }
    catch { setPushState('error'); setTimeout(() => setPushState('idle'), 3000) }
  }

  const pushLabel = { idle: isNl ? 'Push catalogus' : 'Push catalogue', sending: '…', done: isNl ? 'Verstuurd ✓' : 'Sent ✓', error: isNl ? 'Mislukt' : 'Failed' }[pushState]

  return (
    <tr style={{ borderBottom: '1px solid #f3f3f8', transition: 'background .12s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
    >
      {/* Name */}
      <td style={{ padding: '15px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: typeCfg.bg, border: `1px solid ${typeCfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
            {typeCfg.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {org.is_government && (
                <span style={{ padding: '1px 7px', background: '#dbeafe', color: '#1e40af', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase' }}>GOV</span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{org.name}</span>
            </div>
            {org.btw_number && (
              <div style={{ fontSize: 11, color: '#9090a0', marginTop: 2, fontFamily: 'monospace' }}>BTW: {org.btw_number}</div>
            )}
            {org.admin_user && (
              <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>
                👤 {org.admin_user.name}
              </div>
            )}
          </div>
        </div>
      </td>
      {/* Type */}
      <td style={{ padding: '15px 20px' }}><TypeBadge type={org.type} isNl={isNl} /></td>
      {/* Stores */}
      <td style={{ padding: '15px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{org.store_count}</span>
          <span style={{ fontSize: 12, color: '#9090a0' }}>{isNl ? 'vestiging(en)' : 'store(s)'}</span>
        </div>
      </td>
      {/* Status */}
      <td style={{ padding: '15px 20px' }}><StatusBadge active={org.is_active} isNl={isNl} /></td>
      {/* Tier */}
      <td style={{ padding: '15px 20px' }}>
        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: tierCfg.bg, color: tierCfg.color, textTransform: 'capitalize' }}>
          {org.subscription_tier ?? 'starter'}
        </span>
      </td>
      {/* Actions */}
      <td style={{ padding: '15px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* View */}
          <button
            onClick={() => onView(org)}
            title={isNl ? 'Bekijken' : 'View'}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e0e0ed', background: '#f8f7ff', color: '#6d28d9', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            {isNl ? 'Bekijken' : 'View'}
          </button>
          {/* Edit */}
          <button
            onClick={() => onEdit(org)}
            title={isNl ? 'Bewerken' : 'Edit'}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e0e0ed', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {isNl ? 'Bewerken' : 'Edit'}
          </button>
          {/* Push catalogue */}
          <button
            onClick={handlePush} disabled={pushState === 'sending'}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all .15s', whiteSpace: 'nowrap',
              ...(pushState === 'done'    ? { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
                : pushState === 'error'   ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                : pushState === 'sending' ? { background: '#f5f3ff', color: '#c4b5fd', borderColor: '#ddd6fe', cursor: 'wait' }
                :                           { background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }),
            }}
          >
            {pushLabel}
          </button>
          {/* Activate / Deactivate */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={toggleStatus.isPending}
            title={org.is_active ? (isNl ? 'Deactiveren' : 'Deactivate') : (isNl ? 'Activeren' : 'Activate')}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              ...(org.is_active
                ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                : { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }),
            }}
          >
            {org.is_active ? (isNl ? 'Deactiveren' : 'Deactivate') : (isNl ? 'Activeren' : 'Activate')}
          </button>
        </div>

        {/* Styled confirm replaces window.confirm() — surfaces what
            happens (stores stop accepting sales, users stay locked out). */}
        <ConfirmDialog
          isOpen={showConfirm}
          loading={toggleStatus.isPending}
          tone={org.is_active ? 'danger' : 'default'}
          title={
            org.is_active
              ? (isNl ? `${org.name} deactiveren?` : `Deactivate ${org.name}?`)
              : (isNl ? `${org.name} activeren?`   : `Activate ${org.name}?`)
          }
          message={
            org.is_active
              ? (isNl
                  ? `Alle gebruikers van ${org.name} kunnen niet meer inloggen. POS-terminals stoppen met verkopen tot heractivatie.`
                  : `Every user in ${org.name} will be unable to sign in. POS terminals stop accepting sales until reactivated.`)
              : (isNl
                  ? `${org.name} en al hun vestigingen zijn weer beschikbaar. Bestaande wachtwoorden blijven werken.`
                  : `${org.name} and all its stores become available again. Existing passwords remain valid.`)
          }
          confirmLabel={org.is_active ? (isNl ? 'Deactiveer' : 'Deactivate') : (isNl ? 'Activeer' : 'Activate')}
          cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => toggleStatus.mutate()}
        />
      </td>
    </tr>
  )
}

// ─── OrgViewModal ─────────────────────────────────────────────────────────────
function OrgViewModal({ orgId, isNl, onClose, onEdit }: {
  orgId: string; isNl: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [tab, setTab] = useState<'details' | 'stores'>('details')
  const [showAddStore, setShowAddStore] = useState(false)
  const qc = useQueryClient()

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['organisation', orgId],
    queryFn: () => getOrganisation(orgId),
  })

  const { data: stores, isLoading: storesLoading, refetch: refetchStores } = useQuery({
    queryKey: ['org-stores', orgId],
    queryFn: () => getOrgStores(orgId),
    enabled: tab === 'stores',
  })

  const toggleImpersonation = useMutation({
    mutationFn: () => updateOrganisation(orgId, { allow_impersonation: !org?.allow_impersonation }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisation', orgId] })
      qc.invalidateQueries({ queryKey: ['organisations'] })
    },
  })

  const tabs = [
    { id: 'details' as const, nl: 'Gegevens',    en: 'Details' },
    { id: 'stores'  as const, nl: 'Vestigingen', en: 'Stores'  },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 50 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 520, height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,.18)' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 0', borderBottom: '1px solid #eeeef8' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {org && (
                <div style={{ width: 42, height: 42, borderRadius: 12, background: TYPE_CFG[org.type]?.bg ?? '#f5f5fb', border: `1px solid ${TYPE_CFG[org.type]?.border ?? '#e0e0ed'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {TYPE_CFG[org.type]?.icon ?? '🏢'}
                </div>
              )}
              <div>
                {orgLoading ? (
                  <div style={{ width: 180, height: 16, borderRadius: 8, background: '#f0f0f8' }} />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {org?.is_government && <span style={{ padding: '1px 7px', background: '#dbeafe', color: '#1e40af', borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase' }}>GOV</span>}
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>{org?.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9090a0', marginTop: 2 }}>
                      {org && <TypeBadge type={org.type} isNl={isNl} />}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onEdit}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#6d28d9', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                {isNl ? 'Bewerken' : 'Edit'}
              </button>
              <button onClick={onClose} style={{ width: 32, height: 32, background: '#f5f5f8', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#6b7280', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {tabs.map((t) => (
              <button
                key={t.id} onClick={() => setTab(t.id)}
                style={{
                  padding: '9px 18px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  color: tab === t.id ? '#7c3aed' : '#9090a0',
                  borderBottom: tab === t.id ? '2px solid #7c3aed' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {isNl ? t.nl : t.en}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* ── Details tab ── */}
          {tab === 'details' && (
            <>
              {orgLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ height: 14, borderRadius: 7, background: '#f0f0f8', maxWidth: i % 2 === 0 ? '80%' : '60%' }} />
                  ))}
                </div>
              ) : org ? (
                <>
                  {/* Info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                    {[
                      { label: isNl ? 'BTW-nummer'  : 'BTW number',   value: org.btw_number || '—' },
                      { label: isNl ? 'Valuta'       : 'Currency',     value: org.currency },
                      { label: isNl ? 'Taal'         : 'Language',     value: org.locale.toUpperCase() },
                      { label: isNl ? 'Abonnement'   : 'Tier',         value: org.subscription_tier ?? 'starter', capitalize: true },
                      { label: isNl ? 'Vestigingen'  : 'Stores',       value: String(org.store_count) },
                      { label: isNl ? 'Aangemaakt'   : 'Created',      value: new Date(org.created_at).toLocaleDateString(isNl ? 'nl-SR' : 'en-US') },
                    ].map((item) => (
                      <div key={item.label} style={{ background: '#f8f7ff', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e', textTransform: item.capitalize ? 'capitalize' : 'none' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Status + admin user */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <div style={{ flex: 1, background: '#f8f7ff', borderRadius: 10, padding: '14px' }}>
                      <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{isNl ? 'Status' : 'Status'}</div>
                      <StatusBadge active={org.is_active} isNl={isNl} />
                    </div>
                    {org.admin_user && (
                      <div style={{ flex: 1, background: '#f8f7ff', borderRadius: 10, padding: '14px' }}>
                        <div style={{ fontSize: 11, color: '#9090a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{isNl ? 'Beheerder' : 'Admin'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e' }}>{org.admin_user.name}</div>
                        <div style={{ fontSize: 11, color: '#9090a0', marginTop: 2, fontFamily: 'monospace' }}>{org.admin_user.email}</div>
                      </div>
                    )}
                  </div>

                  {/* Impersonation section */}
                  <div style={{ background: org.is_government ? '#fffbeb' : '#f8f7ff', borderRadius: 12, border: `1px solid ${org.is_government ? '#fde68a' : '#e0e0ff'}`, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1c2e', marginBottom: 4 }}>
                          {isNl ? 'Super Admin inloggen als Org' : 'Super Admin Impersonation'}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                          {org.is_government
                            ? (isNl
                                ? '🔒 Geblokkeerd voor overheidsinstelling — WBP-S & Rekenkamer compliance.'
                                : '🔒 Blocked for government org — WBP-S & Rekenkamer compliance.')
                            : (isNl
                                ? 'Staat toe dat Super Admin tijdelijk als een gebruiker van deze organisatie inlogt. Volledig geregistreerd in het auditlogboek.'
                                : 'Allows Super Admin to temporarily sign in as a user of this organisation. Fully logged in the audit trail.')}
                        </div>
                      </div>
                      {org.is_government ? (
                        <div style={{ padding: '5px 12px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          🔒 {isNl ? 'Vergrendeld' : 'Locked'}
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleImpersonation.mutate()}
                          disabled={toggleImpersonation.isPending}
                          style={{
                            position: 'relative', width: 44, height: 24, borderRadius: 12, border: 'none',
                            background: org.allow_impersonation ? '#7c3aed' : '#d1d5db',
                            cursor: 'pointer', transition: 'background .2s', flexShrink: 0,
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 2, left: org.allow_impersonation ? 22 : 2,
                            width: 20, height: 20, borderRadius: '50%', background: '#fff',
                            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                          }} />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* ── Stores tab ── */}
          {tab === 'stores' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  {storesLoading ? '…' : `${stores?.length ?? 0} ${isNl ? 'vestiging(en)' : 'store(s)'}`}
                </span>
                <button
                  onClick={() => setShowAddStore(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  {isNl ? 'Vestiging toevoegen' : 'Add store'}
                </button>
              </div>

              {storesLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: 68, borderRadius: 12, background: '#f0f0f8' }} />
                  ))}
                </div>
              ) : (stores ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🏪</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>{isNl ? 'Geen vestigingen' : 'No stores yet'}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{isNl ? 'Voeg de eerste vestiging toe.' : 'Add the first store.'}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(stores ?? []).map((store) => (
                    <StoreCard key={store.id} store={store} isNl={isNl} />
                  ))}
                </div>
              )}

              {showAddStore && org && (
                <AddStoreModal
                  orgId={org.id} isNl={isNl}
                  onClose={() => setShowAddStore(false)}
                  onCreated={() => { setShowAddStore(false); refetchStores() }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── StoreCard ────────────────────────────────────────────────────────────────
function StoreCard({ store, isNl }: { store: Store; isNl: boolean }) {
  return (
    <div style={{ background: '#f8f7ff', borderRadius: 12, border: '1px solid #e0e0ff', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{store.name}</span>
            <span style={{
              padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: store.pos_type === 'native' ? '#ede9fe' : '#fff7ed',
              color: store.pos_type === 'native' ? '#6d28d9' : '#c2410c',
            }}>
              {store.pos_type === 'native' ? 'Josbin POS' : 'External'}
            </span>
          </div>
          {store.city && <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {store.city}{store.address ? ` — ${store.address}` : ''}</div>}
          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 3 }}>
            BTW: {store.default_btw_rate}%
          </div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: store.is_active ? '#f0fdf4' : '#f9fafb',
          color: store.is_active ? '#15803d' : '#9ca3af',
          border: `1px solid ${store.is_active ? '#bbf7d0' : '#e5e7eb'}`,
          flexShrink: 0,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: store.is_active ? '#22c55e' : '#d1d5db' }} />
          {store.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
        </span>
      </div>
    </div>
  )
}

// ─── AddStoreModal ────────────────────────────────────────────────────────────
function AddStoreModal({ orgId, isNl, onClose, onCreated }: {
  orgId: string; isNl: boolean; onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState<CreateStorePayload>({ name: '', city: '', address: '', default_btw_rate: '10', pos_type: 'native' })
  const mutation = useMutation({
    mutationFn: () => createStore(orgId, form),
    onSuccess: onCreated,
  })

  function set(f: keyof CreateStorePayload, v: string) { setForm((p) => ({ ...p, [f]: v })) }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 18, padding: '28px 28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>{isNl ? 'Vestiging toevoegen' : 'Add store'}</h3>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { field: 'name' as const, label: isNl ? 'Naam vestiging' : 'Store name', placeholder: isNl ? 'bijv. Hoofdkantoor Paramaribo' : 'e.g. Main Branch Paramaribo' },
            { field: 'city' as const, label: isNl ? 'Stad' : 'City', placeholder: 'Paramaribo' },
            { field: 'address' as const, label: isNl ? 'Adres' : 'Address', placeholder: isNl ? 'Straatnaam 12' : 'Street name 12' },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</label>
              <input type="text" value={(form[field] as string) ?? ''} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Standaard BTW (%)' : 'Default BTW (%)'}</label>
              <input type="number" min="0" max="100" step="0.5" value={form.default_btw_rate} onChange={(e) => set('default_btw_rate', e.target.value)} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'POS type' : 'POS type'}</label>
              <select value={form.pos_type} onChange={(e) => set('pos_type', e.target.value)} style={{ ...inputSt, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }} onFocus={focusIn} onBlur={focusOut}>
                <option value="native">Josbin POS (native)</option>
                <option value="external">External POS</option>
              </select>
            </div>
          </div>
        </div>
        {mutation.isError && (
          <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginTop: 14 }}>
            {isNl ? 'Er is een fout opgetreden.' : 'An error occurred.'}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}
            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name ? 0.5 : 1 }}>
            {mutation.isPending ? '…' : (isNl ? 'Aanmaken' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── OrgEditModal ─────────────────────────────────────────────────────────────
function OrgEditModal({ org, isNl, onClose }: { org: Organisation; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<CreateOrgPayload> & { is_active?: boolean }>({
    name: org.name,
    type: org.type,
    btw_number: org.btw_number,
    locale: org.locale,
    subscription_tier: (org.subscription_tier as 'starter' | 'professional' | 'enterprise') ?? 'starter',
    is_government: org.is_government,
    is_active: org.is_active,
  })

  const mutation = useMutation({
    mutationFn: () => updateOrganisation(org.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organisations'] })
      qc.invalidateQueries({ queryKey: ['organisation', org.id] })
      onClose()
    },
  })

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 500, padding: '32px 32px 28px', boxShadow: '0 32px 80px rgba(0,0,0,.25)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-.3px' }}>
              {isNl ? 'Organisatie bewerken' : 'Edit organisation'}
            </h2>
            <p style={{ fontSize: 13, color: '#9090a0', marginTop: 3 }}>{org.name}</p>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {mutation.isError && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Er is een fout opgetreden' : 'An error occurred')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{isNl ? 'Organisatienaam' : 'Organisation name'}</label>
            <input type="text" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)}
              placeholder={isNl ? 'bijv. Supermarkt De Hoop' : 'e.g. Supermarkt De Hoop'} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
          </div>
          {/* BTW number */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{isNl ? 'BTW-nummer' : 'BTW number'}</label>
            <input type="text" value={form.btw_number ?? ''} onChange={(e) => set('btw_number', e.target.value)}
              placeholder="SR-BTW-XXXXXXXXX" style={inputSt} onFocus={focusIn} onBlur={focusOut} />
          </div>
          {/* Type + Locale */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { field: 'type' as const, label: isNl ? 'Type' : 'Type', options: [{ value: 'retail', label: isNl ? 'Detailhandel' : 'Retail' }, { value: 'govt', label: isNl ? 'Overheid' : 'Government' }, { value: 'wholesale', label: isNl ? 'Groothandel' : 'Wholesale' }] },
              { field: 'locale' as const, label: isNl ? 'Taal' : 'Language', options: [{ value: 'nl', label: 'Nederlands' }, { value: 'en', label: 'English' }] },
            ].map(({ field, label, options }) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{label}</label>
                <select value={(form[field] as string) ?? ''} onChange={(e) => set(field, e.target.value)}
                  style={{ ...inputSt, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Tier */}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{isNl ? 'Abonnement' : 'Subscription tier'}</label>
            <select value={form.subscription_tier ?? 'starter'} onChange={(e) => set('subscription_tier', e.target.value)}
              style={{ ...inputSt, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                field: 'is_active' as const,
                title: isNl ? 'Actief' : 'Active',
                desc: isNl ? 'Organisatie en alle vestigingen toegankelijk.' : 'Organisation and all stores accessible.',
              },
              {
                field: 'is_government' as const,
                title: isNl ? 'Overheidsinstelling' : 'Government organisation',
                desc: isNl ? 'Verplicht 2FA, Rekenkamer-export, aparte database.' : 'Mandatory 2FA, Rekenkamer export, isolated database.',
              },
            ].map(({ field, title, desc }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked={(form[field] as boolean) ?? false}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: '#9090a0', marginTop: 1 }}>{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}>
            {mutation.isPending ? (isNl ? 'Opslaan…' : 'Saving…') : (isNl ? 'Opslaan' : 'Save changes')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CreateOrgModal ───────────────────────────────────────────────────────────
function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()

  const [form, setForm] = useState<CreateOrgPayload>({ name: '', type: 'retail', btw_number: '', locale: 'nl', subscription_tier: 'starter', is_government: false })
  const mutation = useMutation({
    mutationFn: createOrganisation,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['organisations'] }); onCreated() },
  })

  function set(field: keyof CreateOrgPayload, value: string) { setForm((p) => ({ ...p, [field]: value })) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, padding: '32px 32px 28px', boxShadow: '0 32px 80px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-.3px' }}>
              {isNl ? 'Nieuwe organisatie' : 'New organisation'}
            </h2>
            <p style={{ fontSize: 13, color: '#9090a0', marginTop: 3 }}>
              {isNl ? 'Vul de gegevens in om een organisatie aan te maken' : 'Fill in the details to create an organisation'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {mutation.error && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Er is een fout opgetreden' : 'An error occurred')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[
            { field: 'name' as const, label: isNl ? 'Organisatienaam' : 'Organisation name', placeholder: isNl ? 'bijv. Supermarkt De Hoop' : 'e.g. Supermarkt De Hoop' },
            { field: 'btw_number' as const, label: isNl ? 'BTW-nummer' : 'BTW number', placeholder: 'SR-BTW-XXXXXXXXX' },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{label}</label>
              <input type="text" value={form[field] ?? ''} onChange={(e) => set(field, e.target.value)} placeholder={placeholder} style={inputSt} onFocus={focusIn} onBlur={focusOut} />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { field: 'type' as const, label: isNl ? 'Type' : 'Type', options: [{ value: 'retail', label: isNl ? 'Detailhandel' : 'Retail' }, { value: 'govt', label: isNl ? 'Overheid' : 'Government' }, { value: 'wholesale', label: isNl ? 'Groothandel' : 'Wholesale' }] },
              { field: 'locale' as const, label: isNl ? 'Taal' : 'Language', options: [{ value: 'nl', label: 'Nederlands' }, { value: 'en', label: 'English' }] },
            ].map(({ field, label, options }) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>{label}</label>
                <select value={form[field] ?? ''} onChange={(e) => set(field, e.target.value)}
                  style={{ ...inputSt, paddingRight: 36, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 7 }}>
              {isNl ? 'Abonnement' : 'Subscription tier'}
            </label>
            <select value={form.subscription_tier ?? 'starter'} onChange={(e) => set('subscription_tier', e.target.value)}
              style={{ ...inputSt, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', cursor: 'pointer' }}
              onFocus={focusIn} onBlur={focusOut}
            >
              <option value="starter">Starter</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
            <input type="checkbox" checked={form.is_government ?? false}
              onChange={(e) => setForm((f) => ({ ...f, is_government: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: '#7c3aed', cursor: 'pointer' }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>
                {isNl ? 'Overheidsinstelling' : 'Government organisation'}
              </div>
              <div style={{ fontSize: 11.5, color: '#9090a0', marginTop: 1 }}>
                {isNl ? 'Verplicht 2FA, Rekenkamer-export, aparte database' : 'Mandatory 2FA, Rekenkamer export, isolated database'}
              </div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#374151', background: '#fff', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending || !form.name}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}>
            {mutation.isPending ? (isNl ? 'Aanmaken…' : 'Creating…') : (isNl ? 'Aanmaken' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function OrganisationsScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore((s) => s.isSuperAdmin())

  const [showCreate, setShowCreate] = useState(false)
  const [viewTarget, setViewTarget] = useState<Organisation | null>(null)
  const [editTarget, setEditTarget] = useState<Organisation | null>(null)
  const [search, setSearch] = useState('')

  const { data: orgs, isLoading } = useQuery({ queryKey: ['organisations'], queryFn: getOrganisations })

  // For non-Super-Admin, the API only returns the user's own org. If that
  // single org has zero stores, the next step is "+ Add store" on the
  // Stores tab — auto-open the org and land on the Stores tab so it's
  // obvious. (Skipped for SA who manages many orgs from a list view.)
  const singleOrg = !isSuperAdmin && orgs?.length === 1 ? orgs[0] : null
  const filtered = orgs?.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.btw_number ?? '').includes(search),
  )

  const total    = orgs?.length ?? 0
  const active   = orgs?.filter((o) => o.is_active).length ?? 0
  const govCount = orgs?.filter((o) => o.is_government).length ?? 0

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-.5px', marginBottom: 4 }}>
            {isSuperAdmin
              ? (isNl ? 'Organisaties' : 'Organisations')
              : (isNl ? 'Mijn organisatie' : 'My organisation')}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isSuperAdmin
              ? (isNl ? 'Beheer klantorganisaties, vestigingen en toegangsbeheer.' : 'Manage client organisations, stores and access control.')
              : (isNl ? 'Beheer uw vestigingen en organisatiegegevens. Tik op uw organisatie hieronder om vestigingen toe te voegen.' : 'Manage your stores and organisation details. Tap your organisation below to add stores.')}
          </p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setShowCreate(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', border: 'none', borderRadius: 12,
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124,58,237,.35)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {isNl ? 'Nieuwe organisatie' : 'New organisation'}
          </button>
        )}
      </div>

      {/* Stats row */}
      {!isLoading && orgs && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24, maxWidth: 580 }}>
          {[
            { label: isNl ? 'Totaal'     : 'Total',       value: total,    color: '#7c3aed' },
            { label: isNl ? 'Actief'     : 'Active',      value: active,   color: '#16a34a' },
            { label: isNl ? 'Overheid'   : 'Government',  value: govCount, color: '#1d4ed8' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#9090a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="search" placeholder={isNl ? 'Zoeken op naam of BTW-nummer…' : 'Search by name or BTW number…'}
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#1c1c2e', background: 'transparent', fontFamily: 'inherit' }} />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9090a0', fontSize: 16, lineHeight: 1 }}>×</button>}
      </div>

      {/* Empty-store hint for OA: their single org has zero stores yet. */}
      {singleOrg && singleOrg.store_count === 0 && (
        <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 14, background: '#fff7ed', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🏬</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: '#9a3412', marginBottom: 2 }}>
              {isNl ? 'Geen vestiging aangemaakt' : 'No store created yet'}
            </p>
            <p style={{ fontSize: 12.5, color: '#9a3412' }}>
              {isNl
                ? 'Tik op uw organisatie hieronder → tabblad Vestigingen → + Vestiging toevoegen.'
                : 'Tap your organisation below → Stores tab → + Add store.'}
            </p>
          </div>
          <button onClick={() => setViewTarget(singleOrg)}
            style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#ea580c', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {isNl ? 'Open' : 'Open'} →
          </button>
        </div>
      )}

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f3f3f8' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0f0f8' }} />
                <div style={{ flex: 1, height: 14, borderRadius: 7, background: '#f0f0f8', maxWidth: 220 }} />
                <div style={{ width: 80, height: 22, borderRadius: 11, background: '#f5f5fb' }} />
                <div style={{ width: 60, height: 14, borderRadius: 7, background: '#f5f5fb' }} />
                <div style={{ width: 200, height: 28, borderRadius: 8, background: '#f0f0f8' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[
                  isNl ? 'Organisatie' : 'Organisation',
                  isNl ? 'Type' : 'Type',
                  isNl ? 'Vestigingen' : 'Stores',
                  isNl ? 'Status' : 'Status',
                  isNl ? 'Abonnement' : 'Tier',
                  isNl ? 'Acties' : 'Actions',
                ].map((h) => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '.7px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(filtered ?? []).map((org) => (
                <OrgRow
                  key={org.id} org={org} isNl={isNl}
                  onView={(o) => setViewTarget(o)}
                  onEdit={(o) => setEditTarget(o)}
                />
              ))}
              {(filtered ?? []).length === 0 && (
                <tr><td colSpan={6} style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                    {search ? (isNl ? 'Geen resultaten voor uw zoekopdracht' : 'No results for your search') : (isNl ? 'Geen organisaties gevonden' : 'No organisations found')}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
        {!isLoading && (filtered ?? []).length > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: '#9090a0' }}>
              {filtered?.length} {isNl ? 'van' : 'of'} {total} {isNl ? 'organisaties' : 'organisations'}
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} />
      )}
      {viewTarget && (
        <OrgViewModal
          orgId={viewTarget.id} isNl={isNl}
          onClose={() => setViewTarget(null)}
          onEdit={() => { setEditTarget(viewTarget); setViewTarget(null) }}
        />
      )}
      {editTarget && (
        <OrgEditModal
          org={editTarget} isNl={isNl}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  )
}
