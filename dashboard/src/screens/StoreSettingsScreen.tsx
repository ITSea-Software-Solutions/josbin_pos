import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import { getStore, updateStore, uploadStoreLogo, uploadWalletQr, deleteWalletQr, type Store, type WalletProvider } from '@/api/stores'

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:8080'

function logoUrl(path?: string): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE}/storage/${path}`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)', marginBottom: 20 }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f4fb', fontWeight: 800, fontSize: 14, color: '#16203a' }}>{title}</div>
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
  borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, color: '#16203a',
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
  // End-of-day freedom knobs (morning-recovery batch)
  closing_time: string
  auto_close_enabled: boolean
  auto_close_time: string
  manager_name: string
  manager_phone: string
}

/**
 * One wallet provider tile: preview of the store's static merchant QR +
 * upload / replace / remove. The POS shows this QR full-screen during a
 * qr_payment so the customer can scan straight from the screen.
 */
function WalletQrCard({ store, provider, isNl }: { store: Store; provider: WalletProvider; isNl: boolean }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const existing = (store.settings?.wallet_qrs as Record<string, string> | undefined)?.[provider]
  const [preview, setPreview] = useState<string | null>(logoUrl(existing))
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'error'>('idle')

  useEffect(() => { setPreview(logoUrl((store.settings?.wallet_qrs as Record<string, string> | undefined)?.[provider])) }, [store, provider])

  const upload = useMutation({
    mutationFn: (file: File) => uploadWalletQr(store.id, provider, file),
    onSuccess: (d) => { setPreview(d.wallet_qr_url); setStatus('ok'); qc.invalidateQueries({ queryKey: ['store', store.id] }) },
    onError: () => setStatus('error'),
  })
  const remove = useMutation({
    mutationFn: () => deleteWalletQr(store.id, provider),
    onSuccess: () => { setPreview(null); setStatus('idle'); qc.invalidateQueries({ queryKey: ['store', store.id] }) },
    onError: () => setStatus('error'),
  })

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      {preview ? (
        <img src={preview} alt={`${provider} QR`} style={{ width: 92, height: 92, objectFit: 'contain', borderRadius: 8, border: '1px solid #eef2fb', background: '#fff', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 92, height: 92, borderRadius: 8, border: '2px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#9ca3af', flexShrink: 0 }}>🔳</div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#16203a', marginBottom: 2 }}>{provider}</div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
          {preview
            ? (isNl ? 'Wordt op het kassascherm getoond bij een QR-betaling.' : 'Shown on the POS screen during a QR payment.')
            : (isNl ? `Upload de ${provider}-QR die u van uw bank/wallet-aanbieder kreeg (sticker of PDF-afbeelding).` : `Upload the ${provider} QR your bank/wallet provider issued (sticker or PDF image).`)}
        </p>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setStatus('busy'); upload.mutate(f) } e.target.value = '' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => inputRef.current?.click()} disabled={status === 'busy'}
            style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {preview ? (isNl ? 'Vervangen' : 'Replace') : (isNl ? 'QR uploaden' : 'Upload QR')}
          </button>
          {preview && (
            <button onClick={() => { setStatus('busy'); remove.mutate() }} disabled={status === 'busy'}
              style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>
              {isNl ? 'Verwijderen' : 'Remove'}
            </button>
          )}
          {status === 'busy' && <span style={{ fontSize: 12, color: '#6b7280', lineHeight: '32px' }}>{isNl ? 'Bezig…' : 'Working…'}</span>}
          {status === 'ok' && <span style={{ fontSize: 12, color: '#16a34a', lineHeight: '32px' }}>✓ {isNl ? 'Opgeslagen' : 'Saved'}</span>}
          {status === 'error' && <span style={{ fontSize: 12, color: '#dc2626', lineHeight: '32px' }}>✗ {isNl ? 'Mislukt' : 'Failed'}</span>}
        </div>
      </div>
    </div>
  )
}

function StoreForm({ store, isNl, onSaved }: { store: Store; isNl: boolean; onSaved: () => void }) {
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Store Managers may edit their store's receipt/display settings, but the
  // default BTW rate is a tax setting and stays Org-Admin-controlled (the
  // backend also ignores it from a manager). Show it read-only for them.
  const btwLocked = useDashboardAuthStore((s) => s.user?.role) === 'store_manager'

  const [form, setForm] = useState<FormState>({
    name:               store.name ?? '',
    address:            store.address ?? '',
    city:               store.city ?? '',
    default_btw_rate:   store.default_btw_rate ?? '10',
    receipt_header:     store.receipt_header ?? '',
    receipt_footer:     store.receipt_footer ?? '',
    receipt_btw_number: (store.settings?.receipt_btw_number as string) ?? '',
    closing_time:       (store.settings?.closing_time as string) ?? '',
    auto_close_enabled: (store.settings?.auto_close_enabled as boolean) ?? false,
    auto_close_time:    (store.settings?.auto_close_time as string) ?? '23:59',
    manager_name:       (store.settings?.manager_name as string) ?? '',
    manager_phone:      (store.settings?.manager_phone as string) ?? '',
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl(store.receipt_logo_path))
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')
  const [logoStatus, setLogoStatus] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  function set(key: keyof FormState, value: string | boolean) {
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
        settings:         {
          ...store.settings,
          receipt_btw_number: form.receipt_btw_number,
          closing_time:       form.closing_time || null,
          auto_close_enabled: form.auto_close_enabled,
          auto_close_time:    form.auto_close_time || '23:59',
          manager_name:       form.manager_name || null,
          manager_phone:      form.manager_phone || null,
        },
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
          <Field
            label={isNl ? 'Standaard BTW-tarief (%)' : 'Default BTW rate (%)'}
            hint={btwLocked
              ? (isNl ? 'Wordt door uw organisatie ingesteld' : 'Set by your organisation')
              : (isNl ? 'Wordt gebruikt als standaard bij nieuwe producten' : 'Used as default when creating new products')}
          >
            <input type="number" min="0" max="100" step="0.01" disabled={btwLocked}
              style={{ ...inputStyle, maxWidth: 120, ...(btwLocked ? { background: '#f3f4f6', color: '#9ca3af', cursor: 'not-allowed' } : {}) }}
              value={form.default_btw_rate} onChange={e => set('default_btw_rate', e.target.value)} />
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

        <Section title={isNl ? 'Einde van de dag' : 'End of day'}>
          <Field
            label={isNl ? 'Sluitingstijd' : 'Closing time'}
            hint={isNl ? 'Na dit tijdstip krijgt de manager een herinnering als de kassa nog open staat. Leeg = geen herinnering.' : 'After this time the manager is reminded if a register is still open. Empty = no reminder.'}
          >
            <input type="time" style={{ ...inputStyle, maxWidth: 160 }} value={form.closing_time} onChange={e => set('closing_time', e.target.value)} />
          </Field>

          <Field
            label={isNl ? 'Kassa ’s nachts automatisch afsluiten' : 'Auto-close registers overnight'}
            hint={isNl ? 'Aan: een vergeten kassa wordt ’s nachts automatisch afgesloten (zonder telling) zodat de volgende ochtend gewoon kan beginnen. De manager telt de la de volgende dag.' : 'On: a forgotten register is auto-closed overnight (without a count) so the next morning starts unblocked. The manager counts the drawer the next day.'}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, color: '#374151' }}>
              <input type="checkbox" checked={form.auto_close_enabled} onChange={e => set('auto_close_enabled', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#003366', cursor: 'pointer' }} />
              {isNl ? 'Automatisch afsluiten inschakelen' : 'Enable auto-close'}
            </label>
          </Field>

          {form.auto_close_enabled && (
            <Field label={isNl ? 'Tijdstip automatisch afsluiten' : 'Auto-close time'} hint={isNl ? 'Alle nog open kassa’s worden op dit tijdstip afgesloten.' : 'Any still-open register is closed at this time.'}>
              <input type="time" style={{ ...inputStyle, maxWidth: 160 }} value={form.auto_close_time} onChange={e => set('auto_close_time', e.target.value)} />
            </Field>
          )}

          <Field
            label={isNl ? 'Manager (naam & telefoon)' : 'Manager (name & phone)'}
            hint={isNl ? 'Getoond op de kassa als een kassier de manager moet bellen om de kassa van gisteren af te sluiten.' : 'Shown on the POS when a cashier needs to call the manager to close yesterday’s register.'}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, maxWidth: 200 }} value={form.manager_name} onChange={e => set('manager_name', e.target.value)} placeholder={isNl ? 'Naam' : 'Name'} />
              <input style={{ ...inputStyle, maxWidth: 200 }} value={form.manager_phone} onChange={e => set('manager_phone', e.target.value)} placeholder="+597 …" />
            </div>
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

        <Section title={isNl ? 'QR-wallets (Mopé / Uni5Pay+)' : 'QR wallets (Mopé / Uni5Pay+)'}>
          <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
            {isNl
              ? 'Upload per wallet de statische merchant-QR van uw winkel. De kassa toont hem groot op het scherm bij een QR-betaling, met het te betalen bedrag ernaast — de klant scant en typt het bedrag in de wallet-app.'
              : "Upload your store's static merchant QR per wallet. The POS shows it large on screen during a QR payment, with the amount due next to it — the customer scans and types the amount in the wallet app."}
          </p>
          {(store.payment_options?.wallets ?? ['Mopé', 'Uni5Pay+']).map((provider) => (
            <WalletQrCard key={provider} store={store} provider={provider} isNl={isNl} />
          ))}
        </Section>

        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

        <button
          onClick={() => { setSaveStatus('saving'); saveMut.mutate() }}
          disabled={saveMut.isPending}
          style={{
            height: 44, padding: '0 28px', borderRadius: 10, border: 'none', cursor: saveMut.isPending ? 'not-allowed' : 'pointer',
            background: saveStatus === 'ok' ? '#16a34a' : saveStatus === 'error' ? '#dc2626' : 'linear-gradient(135deg,#003366,#1f2a63)',
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
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f4fb', fontWeight: 800, fontSize: 13, color: '#16203a' }}>
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

  // Non-super-admins only manage their own org's stores.
  const availableStores = isSuperAdmin
    ? stores
    : stores.filter(s => s.organisation_id === user?.organisation_id)

  // Auto-select when there's exactly one store to manage (e.g. a Store Manager
  // pinned to a single store) — saves a pointless "choose a store" step.
  useEffect(() => {
    if (!selectedStoreId && availableStores.length === 1) {
      setSelectedStoreId(availableStores[0].id)
    }
  }, [selectedStoreId, availableStores])

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Vestigingsinstellingen' : 'Store Settings'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Pas bonopmaak, header, footer, logo en BTW-nummer per vestiging aan.' : 'Customise receipt layout, header, footer, logo and BTW number per store.'}
        </p>
      </div>

      {/* Store selector */}
      <div style={{ background: '#fff', border: '1px solid #e6ecf5', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
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
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏪</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>{isNl ? 'Kies een vestiging om te bewerken' : 'Choose a store to edit'}</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e6ebf7', borderTopColor: '#003366', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : store ? (
        <StoreForm key={store.id} store={store} isNl={isNl} onSaved={() => {}} />
      ) : null}
    </div>
  )
}
