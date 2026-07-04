import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import apiClient from '@/api/client'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/shared/Toast'

interface ApiKey {
  id: string
  store_id: string
  store_name: string
  pos_system: string
  webhook_url: string | null
  webhook_events: string[]
  last_ping_at: string | null
  is_active: boolean
  created_at: string
}

interface CreateApiKeyPayload {
  store_id: string
  pos_system: string
  webhook_url: string
  webhook_events: string[]
}

interface UpdateApiKeyPayload {
  pos_system: string
  webhook_url: string
  webhook_events: string[]
}

async function getApiKeys(): Promise<ApiKey[]> {
  const res = await apiClient.get<{ data: ApiKey[] }>('/api-keys')
  return res.data.data
}

async function createApiKey(payload: CreateApiKeyPayload): Promise<{ api_key: string; api_key_prefix: string; id: string }> {
  const res = await apiClient.post('/api-keys', payload)
  return res.data.data
}

async function updateApiKey(id: string, payload: UpdateApiKeyPayload): Promise<void> {
  await apiClient.put(`/api-keys/${id}`, {
    pos_system: payload.pos_system,
    webhook_url: payload.webhook_url || null,
    webhook_events: payload.webhook_events,
  })
}

async function rotateWebhookSecret(id: string): Promise<{ webhook_secret: string }> {
  const res = await apiClient.post(`/api-keys/${id}/rotate-webhook-secret`)
  return res.data
}

async function revokeApiKey(id: string): Promise<void> {
  await apiClient.delete(`/api-keys/${id}`)
}

const ALL_EVENTS = ['sale.created', 'shift.closed', 'refund.issued'] as const

const EVENT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'sale.created':  { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'shift.closed':  { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'refund.issued': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
}

function PingStatus({ lastPingAt, isNl }: { lastPingAt: string | null; isNl: boolean }) {
  if (!lastPingAt) {
    return <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 500 }}>—</span>
  }
  const ms = Date.now() - new Date(lastPingAt).getTime()
  const minutes = Math.floor(ms / 60_000)
  const isRecent = minutes < 10
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRecent ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: isRecent ? '#15803d' : '#92400e', fontWeight: 600 }}>
          {isRecent ? (isNl ? 'Online' : 'Online') : (isNl ? 'Inactief' : 'Idle')}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 2 }}>
        {new Date(lastPingAt).toLocaleString(isNl ? 'nl-SR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
      </div>
    </div>
  )
}

export default function ApiKeysScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const toast = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState<CreateApiKeyPayload>({
    store_id: '',
    pos_system: '',
    webhook_url: '',
    webhook_events: ['sale.created'],
  })

  const [editTarget, setEditTarget] = useState<ApiKey | null>(null)
  const [editForm, setEditForm] = useState<UpdateApiKeyPayload>({
    pos_system: '',
    webhook_url: '',
    webhook_events: [],
  })
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null)

  // Styled confirms replace window.confirm() for the two destructive
  // actions on this screen — revoke (hard, irreversible) and rotate
  // (immediate cutover that breaks the integrator until they redeploy).
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: getApiKeys,
  })

  const create = useMutation({
    mutationFn: createApiKey,
    onSuccess: (result) => {
      setNewKey(result.api_key)
      setShowCreate(false)
      setForm({ store_id: '', pos_system: '', webhook_url: '', webhook_events: ['sale.created'] })
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      setRevokeTarget(null)
      toast.success(isNl ? 'API-sleutel ingetrokken' : 'API key revoked')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Intrekken mislukt: ${msg}` : `Revoke failed: ${msg}`)
    },
  })

  const update = useMutation({
    mutationFn: () => updateApiKey(editTarget!.id, editForm),
    onSuccess: () => {
      setEditTarget(null)
      qc.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  const rotate = useMutation({
    mutationFn: () => rotateWebhookSecret(editTarget!.id),
    onSuccess: (result) => {
      setRotatedSecret(result.webhook_secret)
      setConfirmRotate(false)
      toast.success(isNl
        ? 'Geheim geroteerd — kopieer het nu, het wordt niet opnieuw getoond.'
        : 'Secret rotated — copy it now, it will not be shown again.')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Roteren mislukt: ${msg}` : `Rotate failed: ${msg}`)
    },
  })

  function toggleEvent(event: string) {
    setForm((f) => ({
      ...f,
      webhook_events: f.webhook_events.includes(event)
        ? f.webhook_events.filter((e) => e !== event)
        : [...f.webhook_events, event],
    }))
  }

  function toggleEditEvent(event: string) {
    setEditForm((f) => ({
      ...f,
      webhook_events: f.webhook_events.includes(event)
        ? f.webhook_events.filter((e) => e !== event)
        : [...f.webhook_events, event],
    }))
  }

  function openEdit(key: ApiKey) {
    setEditTarget(key)
    setRotatedSecret(null)
    rotate.reset()
    update.reset()
    setEditForm({
      pos_system: key.pos_system,
      webhook_url: key.webhook_url ?? '',
      webhook_events: key.webhook_events ?? [],
    })
  }

  function handleCopy() {
    if (!newKey) return
    navigator.clipboard.writeText(newKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const total  = keys?.length ?? 0
  const active = keys?.filter((k) => k.is_active).length ?? 0

  // Column sort (shared hook → identical behaviour across all dashboard tables).
  const { sorted: sortedKeys, sort, toggle: toggleSort, indicator } = useTableSort(keys ?? [], {
    store:    (k) => (k.store_name ?? '').toLowerCase(),
    system:   (k) => (k.pos_system ?? '').toLowerCase(),
    webhook:  (k) => (k.webhook_url ?? '').toLowerCase(),
    events:   (k) => k.webhook_events?.length ?? 0,
    lastping: (k) => (k.last_ping_at ? new Date(k.last_ping_at).getTime() : null),
    status:   (k) => (k.is_active ? 1 : 0),
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'API Integraties' : 'API Integrations'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl
              ? 'Beheer API-sleutels en webhooks voor derde-partij POS-systemen.'
              : 'Manage API keys and webhooks for third-party POS systems.'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '10px 20px', borderRadius: 10,
            background: 'linear-gradient(135deg, #293371, #1f2a63)',
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(41,51,113,.35)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {isNl ? 'Nieuwe sleutel' : 'New key'}
        </button>
      </div>

      {/* Stats row */}
      {!isLoading && keys && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28, maxWidth: 580 }}>
          {[
            { label: isNl ? 'Totaal sleutels' : 'Total keys', value: total,  color: '#293371' },
            { label: isNl ? 'Actief' : 'Active',              value: active, color: '#16a34a' },
            { label: isNl ? 'Ingetrokken' : 'Revoked',        value: total - active, color: '#9ca3af' },
          ].map((s) => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14,
              padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#7e88a0', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* New key success banner */}
      {newKey && (
        <div style={{
          marginBottom: 24, padding: '18px 22px',
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1px solid #86efac', borderRadius: 14,
          boxShadow: '0 2px 8px rgba(34,197,94,.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#166534' }}>
              {isNl ? 'API-sleutel aangemaakt — sla deze nu op!' : 'API key created — save it now!'}
            </span>
            <button onClick={() => setNewKey(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
          <p style={{ fontSize: 12.5, color: '#166534', marginBottom: 12 }}>
            {isNl
              ? 'Deze sleutel wordt slechts één keer getoond en kan niet worden hersteld.'
              : 'This key is shown only once and cannot be recovered.'}
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <code style={{
              flex: 1, background: '#fff', border: '1px solid #86efac', borderRadius: 8,
              padding: '10px 14px', fontSize: 12.5, fontFamily: 'monospace',
              color: '#166534', wordBreak: 'break-all',
            }}>
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              style={{
                padding: '10px 16px', borderRadius: 8, border: '1px solid #86efac',
                background: copied ? '#22c55e' : '#fff', color: copied ? '#fff' : '#166534',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {copied ? (isNl ? 'Gekopieerd ✓' : 'Copied ✓') : (isNl ? 'Kopiëren' : 'Copy')}
            </button>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#16203a', marginBottom: 3 }}>
                  {isNl ? 'Nieuwe API-integratie' : 'New API Integration'}
                </h3>
                <p style={{ fontSize: 13, color: '#7e88a0' }}>
                  {isNl ? 'Genereer een sleutel voor een extern POS-systeem.' : 'Generate a key for an external POS system.'}
                </p>
              </div>
              <button onClick={() => setShowCreate(false)} style={{ background: '#f2f5fb', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Store ID */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {isNl ? 'Vestiging ID' : 'Store ID'}
                </label>
                <input
                  value={form.store_id}
                  onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9e1f1', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* POS system */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {isNl ? 'POS-systeem naam' : 'POS system name'}
                </label>
                <input
                  value={form.pos_system}
                  onChange={(e) => setForm((f) => ({ ...f, pos_system: e.target.value }))}
                  placeholder={isNl ? 'bijv. Lightspeed, Square, Aangepast' : 'e.g. Lightspeed, Square, Custom'}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9e1f1', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Webhook URL */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Webhook URL <span style={{ fontWeight: 400, color: '#7e88a0' }}>({isNl ? 'optioneel' : 'optional'})</span>
                </label>
                <input
                  value={form.webhook_url}
                  onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
                  placeholder="https://your-system.com/webhook"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9e1f1', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
                />
              </div>

              {/* Webhook events */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  {isNl ? 'Webhook-gebeurtenissen' : 'Webhook events'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_EVENTS.map((evt) => {
                    const on = form.webhook_events.includes(evt)
                    const ec = EVENT_COLORS[evt]
                    return (
                      <button
                        key={evt} type="button" onClick={() => toggleEvent(evt)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.12s',
                          background: on ? (ec?.bg ?? '#f2f5fb') : '#f9fafb',
                          color: on ? (ec?.color ?? '#6b7280') : '#9ca3af',
                          border: `1px solid ${on ? (ec?.border ?? '#e5e7eb') : '#e5e7eb'}`,
                        }}
                      >
                        {evt}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {create.isError && (
              <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginTop: 16 }}>
                {isNl ? 'Er is een fout opgetreden.' : 'An error occurred.'}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '11px 0', background: '#f2f5fb', border: '1px solid #d9e1f1', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                onClick={() => create.mutate(form)}
                disabled={!form.store_id || !form.pos_system || create.isPending}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'linear-gradient(135deg, #293371, #1f2a63)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!form.store_id || !form.pos_system || create.isPending) ? 0.5 : 1,
                }}
              >
                {create.isPending ? '...' : (isNl ? 'Aanmaken' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit webhook modal */}
      {editTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#16203a', marginBottom: 3 }}>
                  {isNl ? 'Webhook-configuratie' : 'Webhook configuration'}
                </h3>
                <p style={{ fontSize: 13, color: '#7e88a0' }}>{editTarget.store_name}</p>
              </div>
              <button onClick={() => setEditTarget(null)} style={{ background: '#f2f5fb', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* POS system */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {isNl ? 'POS-systeem naam' : 'POS system name'}
                </label>
                <input
                  value={editForm.pos_system}
                  onChange={(e) => setEditForm((f) => ({ ...f, pos_system: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9e1f1', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Webhook URL */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Webhook URL <span style={{ fontWeight: 400, color: '#7e88a0' }}>({isNl ? 'optioneel' : 'optional'})</span>
                </label>
                <input
                  value={editForm.webhook_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, webhook_url: e.target.value }))}
                  placeholder="https://your-system.com/webhook"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1px solid #d9e1f1', fontSize: 13, outline: 'none', fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: 11, color: '#7e88a0', marginTop: 5 }}>
                  {isNl
                    ? 'Laat leeg om uitgaande webhooks uit te schakelen.'
                    : 'Leave empty to disable outbound webhooks.'}
                </p>
              </div>

              {/* Webhook events */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                  {isNl ? 'Webhook-gebeurtenissen' : 'Webhook events'}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_EVENTS.map((evt) => {
                    const on = editForm.webhook_events.includes(evt)
                    const ec = EVENT_COLORS[evt]
                    return (
                      <button
                        key={evt} type="button" onClick={() => toggleEditEvent(evt)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.12s',
                          background: on ? (ec?.bg ?? '#f2f5fb') : '#f9fafb',
                          color: on ? (ec?.color ?? '#6b7280') : '#9ca3af',
                          border: `1px solid ${on ? (ec?.border ?? '#e5e7eb') : '#e5e7eb'}`,
                        }}
                      >
                        {evt}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rotate webhook secret */}
              <div style={{ borderTop: '1px solid #eef2fb', paddingTop: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {isNl ? 'Webhook-handtekeningsleutel' : 'Webhook signing secret'}
                </label>
                {rotatedSecret ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11.5, color: '#166534', marginBottom: 6, fontWeight: 700 }}>
                      {isNl ? 'Nieuw geheim — kopieer het nu, het wordt niet opnieuw getoond.' : 'New secret — copy it now, it will not be shown again.'}
                    </p>
                    <code style={{ display: 'block', background: '#fff', border: '1px solid #bbf7d0', borderRadius: 7, padding: '8px 10px', fontSize: 11.5, fontFamily: 'monospace', color: '#166534', wordBreak: 'break-all' }}>
                      {rotatedSecret}
                    </code>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRotate(true)}
                    disabled={rotate.isPending}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa',
                      cursor: 'pointer', opacity: rotate.isPending ? 0.5 : 1,
                    }}
                  >
                    {rotate.isPending ? '...' : (isNl ? 'Geheim roteren' : 'Rotate secret')}
                  </button>
                )}
              </div>
            </div>

            {update.isError && (
              <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginTop: 16 }}>
                {isNl ? 'Er is een fout opgetreden. Controleer de webhook-URL.' : 'An error occurred. Check the webhook URL.'}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{ flex: 1, padding: '11px 0', background: '#f2f5fb', border: '1px solid #d9e1f1', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
              >
                {isNl ? 'Annuleren' : 'Cancel'}
              </button>
              <button
                onClick={() => update.mutate()}
                disabled={!editForm.pos_system || update.isPending}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'linear-gradient(135deg, #293371, #1f2a63)',
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  opacity: (!editForm.pos_system || update.isPending) ? 0.5 : 1,
                }}
              >
                {update.isPending ? '...' : (isNl ? 'Opslaan' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderBottom: '1px solid #f1f4fb' }}>
                <div style={{ width: 120, height: 13, borderRadius: 7, background: '#eef2fb' }} />
                <div style={{ width: 100, height: 12, borderRadius: 6, background: '#f2f5fb' }} />
                <div style={{ flex: 1, height: 12, borderRadius: 6, background: '#f2f5fb' }} />
                <div style={{ width: 80, height: 22, borderRadius: 11, background: '#eef2fb' }} />
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                {[
                  { key: 'store',    label: isNl ? 'Vestiging' : 'Store' },
                  { key: 'system',   label: isNl ? 'Systeem' : 'System' },
                  { key: 'webhook',  label: 'Webhook URL' },
                  { key: 'events',   label: isNl ? 'Gebeurtenissen' : 'Events' },
                  { key: 'lastping', label: isNl ? 'Laatste ping' : 'Last ping' },
                  { key: 'status',   label: isNl ? 'Status' : 'Status' },
                  { key: null,       label: '' },
                ].map((h) => (
                  <th key={h.label || 'actions'} onClick={h.key ? () => toggleSort(h.key as string) : undefined}
                    style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.7px', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                    {h.label}
                    {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{indicator(h.key)}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedKeys.map((key, i) => (
                <tr
                  key={key.id}
                  style={{ borderBottom: i < sortedKeys.length - 1 ? '1px solid #f1f4fb' : 'none', transition: 'background .12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{key.store_name}</div>
                    <div style={{ fontSize: 11, color: '#7e88a0', marginTop: 2, fontFamily: 'monospace' }}>
                      {key.id.slice(0, 8)}…
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: '#f2f5fb', color: '#1a234f', border: '1px solid #e0e0ff',
                    }}>
                      {key.pos_system}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', maxWidth: 200 }}>
                    {key.webhook_url ? (
                      <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {key.webhook_url.length > 40 ? key.webhook_url.slice(0, 40) + '…' : key.webhook_url}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {key.webhook_events.length > 0
                        ? key.webhook_events.map((e) => {
                          const ec = EVENT_COLORS[e]
                          return (
                            <span key={e} style={{
                              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: ec?.bg ?? '#f9fafb',
                              color: ec?.color ?? '#6b7280',
                              border: `1px solid ${ec?.border ?? '#e5e7eb'}`,
                            }}>{e}</span>
                          )
                        })
                        : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>
                      }
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <PingStatus lastPingAt={key.last_ping_at} isNl={isNl} />
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 11px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      background: key.is_active ? '#f0fdf4' : '#f9fafb',
                      color: key.is_active ? '#15803d' : '#9ca3af',
                      border: `1px solid ${key.is_active ? '#bbf7d0' : '#e5e7eb'}`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: key.is_active ? '#22c55e' : '#d1d5db' }} />
                      {key.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Ingetrokken' : 'Revoked')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {key.is_active && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => openEdit(key)}
                          style={{
                            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: '#f2f5fb', color: '#1a234f', border: '1px solid #e0e0ff',
                            cursor: 'pointer',
                          }}
                        >
                          {isNl ? 'Webhook bewerken' : 'Edit webhook'}
                        </button>
                        <button
                          onClick={() => setRevokeTarget(key)}
                          style={{
                            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                            cursor: 'pointer',
                          }}
                        >
                          {isNl ? 'Intrekken' : 'Revoke'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(keys ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔑</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                      {isNl ? 'Geen API-sleutels gevonden' : 'No API keys found'}
                    </div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
                      {isNl ? 'Maak een sleutel aan om externe POS-systemen te koppelen.' : 'Create a key to connect external POS systems.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isLoading && total > 0 && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f4fb', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: '#7e88a0' }}>
              {total} {isNl ? 'sleutels in totaal' : 'keys total'}
            </span>
          </div>
        )}
      </div>

      {/* Styled destructive confirms — Escape-closes, surfaces real
          impact, and pins the dialog while the mutation is in flight. */}
      <ConfirmDialog
        isOpen={revokeTarget !== null}
        loading={revoke.isPending}
        tone="danger"
        title={isNl ? 'API-sleutel intrekken?' : 'Revoke API key?'}
        message={
          isNl
            ? `${revokeTarget?.pos_system ?? 'Deze sleutel'} kan vanaf nu geen verkopen of webhooks meer versturen. Deze actie is permanent.`
            : `${revokeTarget?.pos_system ?? 'This key'} will be unable to push sales or receive webhooks. This action is permanent.`
        }
        confirmLabel={isNl ? 'Trek in' : 'Revoke'}
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
      />

      <ConfirmDialog
        isOpen={confirmRotate}
        loading={rotate.isPending}
        tone="warning"
        title={isNl ? 'Webhook-geheim roteren?' : 'Rotate webhook secret?'}
        message={
          isNl
            ? 'Het oude geheim stopt onmiddellijk met werken. De integrator moet het nieuwe geheim direct overnemen.'
            : 'The old secret stops working immediately. The integrator must adopt the new secret right away.'
        }
        confirmLabel={isNl ? 'Roteer' : 'Rotate'}
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setConfirmRotate(false)}
        onConfirm={() => rotate.mutate()}
      />
    </div>
  )
}
