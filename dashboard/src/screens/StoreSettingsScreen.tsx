import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import { getStore, updateStore, uploadStoreLogo, type Store } from '@/api/stores'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:8080'

function logoUrl(path?: string): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE}/storage/${path}`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)', marginBottom: 20 }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #f3f3f8', fontWeight: 800, fontSize: 14, color: '#1c1c2e' }}>{title}</div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px',
  borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, color: '#1c1c2e',
  background: '#fff', outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.5,
}

interface FormState {
  name: string
  address: string
  city: string
  default_btw_rate: string
  receipt_header: string
  receipt_footer: string
  receipt_btw_number: string
}

function StoreForm({ store, isNl, onSaved }: { store: Store; isNl: boolean; onSaved: () => void }) {
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    name:               store.name ?? '',
    address:            store.address ?? '',
    city:               store.city ?? '',
    default_btw_rate:   store.default_btw_rate ?? '10',
    receipt_header:     store.receipt_header ?? '',
    receipt_footer:     store.receipt_footer ?? '',
    receipt_btw_number: (store.settings?.receipt_btw_number as string) ?? '',
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl(store.receipt_logo_path))
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [logoStatus, setLogoStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name:             form.name,
        address:          form.address,
        city:             form.city,
        default_btw_rate: form.default_btw_rate,
        receipt_header:   form.receipt_header,
        receipt_footer:   form.receipt_footer,
        settings:         { ...store.settings, receipt_btw_number: form.receipt_btw_number },
      }
      const updated = await updateStore(store.id, payload)

      if (logoFile) {
        setLogoStatus('uploading')
        try {
          await uploadStoreLogo(store.id, logoFile)
          setLogoFile(null)
          setLogoStatus('ok')
          setTimeout(() => setLogoStatus('idle'), 2000)
        } catch {
          setLogoStatus('error')
          setTimeout(() => setLogoStatus('idle'), 3000)
        }
      }

      return updated
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-settings', store.id] })
      qc.invalidateQueries({ queryKey: ['stores'] })
      setSaveStatus('ok')
      setTimeout(() => { setSaveStatus('idle'); onSaved() }, 1500)
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      setError(msg)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
  })

  const receiptPreviewLines = [
    form.receipt_header,
    '',
    isNl ? '=== Kassabon ===' : '=== Receipt ===',
    `${isNl ? 'Bon nr:' : 'Receipt:'} #0001`,
    `${isNl ? 'Datum:' : 'Date:'} ${new Date().toLocaleDateString()}`,
    '',
    `1x  Product A               SRD 12.50`,
    `1x  Product B               SRD  8.00`,
    '',
    `${isNl ? 'Subtotaal:' : 'Subtotal:'}              SRD 20.50`,
    `BTW (10%):                  SRD  2.05`,
    `${isNl ? 'Totaal:' : 'Total:'}                 SRD 22.55`,
    '',
    form.receipt_btw_number ? `BTW nr: ${form.receipt_btw_number}` : '',
    form.receipt_footer,
  ].join('\n')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
      {/* Left: Form */}
      <div>
        <Section title={isNl ? 'Vestigingsgegevens' : 'Store Information'}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={isNl ? 'Naam vestiging' : 'Store name'}>
              <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>
            <Field label={isNl ? 'Stad' : 'City'}>
              <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} />
            </Field>
          </div>
          <Field label={isNl ? 'Adres' : 'Address'}>
            <input style={inputStyle} value={form.address} onChange={e => set('address', e.target.value)} />
          </Field>
          <Field label={isNl ? 'Standaard BTW-tarief (%)' : 'Default BTW rate (%)'} hint={isNl ? 'Wordt gebruikt als standaard bij nieuwe producten' : 'Used as default when creating new products'}>
            <input type="number" min="0" max="100" step="0.01" style={{ ...inputStyle, maxWidth: 120 }} value={form.default_btw_rate} onChange={e => set('default_btw_rate', e.target.value)} />
          </Field>
        </Section>

        <Section title={isNl ? 'Bonopmaak' : 'Receipt Layout'}>
          <Field label={isNl ? 'BTW-registratienummer' : 'BTW registration number'} hint={isNl ? 'Verschijnt onderaan de bon' : 'Appears at the bottom of the receipt'}>
            <input style={{ ...inputStyle, maxWidth: 280 }} value={form.receipt_btw_number} onChange={e => set('receipt_btw_number', e.target.value)} placeholder="SB-123456789" />
          </Field>
          <Field label={isNl ? 'Koptekst (max. 3 regels)' : 'Header (max. 3 lines)'} hint={isNl ? 'Wordt bovenaan elke bon afgedrukt' : 'Printed at the top of every receipt'}>
            <textarea style={textareaStyle} value={form.receipt_header} onChange={e => set('receipt_header', e.target.value)} rows={3} placeholder={isNl ? 'bijv. Supermarkt De Hoop\nParamaribo, Suriname\nTel: +597 000-0000' : 'e.g. Supermarkt De Hoop\nParamaribo, Suriname\nTel: +597 000-0000'} />
          </Field>
          <Field label={isNl ? 'Voettekst (max. 3 regels)' : 'Footer (max. 3 lines)'} hint={isNl ? 'Wordt onderaan elke bon afgedrukt' : 'Printed at the bottom of every receipt'}>
            <textarea style={textareaStyle} value={form.receipt_footer} onChange={e => set('receipt_footer', e.target.value)} rows={3} placeholder={isNl ? 'bijv. Bedankt voor uw bezoek!\nwww.dehoop.sr' : 'e.g. Thank you for your visit!\nwww.dehoop.sr'} />
          </Field>
        </Section>

        <Section title={isNl ? 'Logo op bon' : 'Receipt Logo'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {logoPreview ? (
              <div style={{ width: 80, height: 80, borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', background: '#f9f9f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={logoPreview} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed #e5e7eb', background: '#f9f9f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 28 }}>
                🖼
              </div>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>
                {isNl ? 'PNG, JPG of SVG, max. 2 MB. Wordt bovenaan de bon afgedrukt.' : 'PNG, JPG or SVG, max 2 MB. Printed at the top of the receipt.'}
              </p>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" style={{ display: 'none' }} onChange={handleLogoChange} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => logoInputRef.current?.click()} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  {isNl ? 'Afbeelding kiezen' : 'Choose image'}
                </button>
                {logoPreview && (
                  <button onClick={() => { setLogoPreview(null); setLogoFile(null) }} style={{ height: 34, padding: '0 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
                    {isNl ? 'Verwijderen' : 'Remove'}
                  </button>
                )}
                {logoStatus === 'uploading' && <span style={{ fontSize: 12, color: '#6b7280', lineHeight: '34px' }}>{isNl ? 'Uploaden…' : 'Uploading…'}</span>}
                {logoStatus === 'ok' && <span style={{ fontSize: 12, color: '#16a34a', lineHeight: '34px' }}>✓ {isNl ? 'Geüpload' : 'Uploaded'}</span>}
              </div>
            </div>
          </div>
        </Section>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

        <button
          onClick={() => { setSaveStatus('saving'); saveMut.mutate() }}
          disabled={saveMut.isPending}
          style={{
            height: 44, padding: '0 28px', borderRadius: 10, border: 'none', cursor: saveMut.isPending ? 'not-allowed' : 'pointer',
            background: saveStatus === 'ok' ? '#16a34a' : saveStatus === 'error' ? '#dc2626' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff', fontSize: 14, fontWeight: 700, transition: 'background .3s',
            opacity: saveMut.isPending ? 0.8 : 1,
          }}
        >
          {saveStatus === 'saving' ? (isNl ? 'Opslaan…' : 'Saving…')
            : saveStatus === 'ok'   ? `✓ ${isNl ? 'Opgeslagen!' : 'Saved!'}`
            : saveStatus === 'error' ? `✗ ${isNl ? 'Fout' : 'Error'}`
            : (isNl ? 'Wijzigingen opslaan' : 'Save changes')}
        </button>
      </div>

      {/* Right: Receipt preview */}
      <div style={{ position: 'sticky', top: 20 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f3f8', fontWeight: 800, fontSize: 13, color: '#1c1c2e' }}>
            {isNl ? 'Bonvoorbeeld' : 'Receipt preview'}
          </div>
          <div style={{ padding: '16px 20px' }}>
            {logoPreview && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <img src={logoPreview} alt="logo" style={{ maxWidth: 140, maxHeight: 56, objectFit: 'contain' }} />
              </div>
            )}
            <pre style={{
              fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, color: '#374151',
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: '#f9f9f9', borderRadius: 8, padding: '12px 14px',
            }}>
              {receiptPreviewLines}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StoreSettingsScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore(s => s.isSuperAdmin())
  const user = useDashboardAuthStore(s => s.user)

  const [selectedStoreId, setSelectedStoreId] = useState<string>('')

  const { data: stores = [] } = useQuery({
    queryKey: ['stores'],
    queryFn: () => import('@/api/stores').then(m => m.getStores()),
  })

  const { data: store, isLoading } = useQuery({
    queryKey: ['store-settings', selectedStoreId],
    queryFn: () => getStore(selectedStoreId),
    enabled: !!selectedStoreId,
  })

  // Non-super-admins only manage their own org's stores — auto-select if only one
  const availableStores = isSuperAdmin
    ? stores
    : stores.filter(s => s.organisation_id === user?.organisation_id)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Vestigingsinstellingen' : 'Store Settings'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Pas bonopmaak, header, footer, logo en BTW-nummer per vestiging aan.' : 'Customise receipt layout, header, footer, logo and BTW number per store.'}
        </p>
      </div>

      {/* Store selector */}
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', flexShrink: 0 }}>
          {isNl ? 'Vestiging:' : 'Store:'}
        </label>
        <select
          value={selectedStoreId}
          onChange={e => setSelectedStoreId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, minWidth: 220 }}
        >
          <option value="">{isNl ? '— Kies een vestiging —' : '— Choose a store —'}</option>
          {availableStores.map(s => (
            <option key={s.id} value={s.id}>{s.name} {s.city ? `— ${s.city}` : ''}</option>
          ))}
        </select>
      </div>

      {!selectedStoreId ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏪</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>{isNl ? 'Kies een vestiging om te bewerken' : 'Choose a store to edit'}</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : store ? (
        <StoreForm key={store.id} store={store} isNl={isNl} onSaved={() => {}} />
      ) : null}
    </div>
  )
}
