import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Quagga from '@ericblade/quagga2'
import {
  getCategories, createCategory, updateCategory,
  getProducts, createProduct, updateProduct,
  type Category, type Product,
  type CreateCategoryPayload, type CreateProductPayload,
  type CreateVariantPayload,
  uploadProductImage,
  getVariants, createVariant, deleteVariant,
} from '@/api/catalogue'
import { type Organisation } from '@/api/organisations'
import { useDashboardAuthStore } from '@/store/authStore'
import apiClient from '@/api/client'

/**
 * Push-catalogue button: broadcasts a `catalogue.refresh` event over
 * Reverb to every POS terminal in this organisation. Terminals invalidate
 * their product cache and re-fetch /api/products/pos within seconds —
 * useful after bulk imports or a flurry of price changes. Backend route:
 * POST /api/products/push with X-Organisation-Push header.
 */
function PushCatalogueButton({ orgId, isNl }: { orgId: string; isNl: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  async function push() {
    if (!orgId || state === 'sending') return
    setState('sending')
    try {
      await apiClient.post('/products/push', {}, { headers: { 'X-Organisation-Push': orgId } })
      setState('done'); setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error'); setTimeout(() => setState('idle'), 3000)
    }
  }
  const label = {
    idle:    isNl ? '📡 Push naar alle kassa\'s' : '📡 Push to all tills',
    sending: isNl ? '… Versturen'                 : '… Pushing',
    done:    isNl ? '✓ Verstuurd'                 : '✓ Sent',
    error:   isNl ? '✗ Mislukt'                   : '✗ Failed',
  }[state]
  const bg = state === 'done' ? '#f0fdf4' : state === 'error' ? '#fef2f2' : '#fff'
  const bd = state === 'done' ? '#86efac' : state === 'error' ? '#fecaca' : '#e5e7eb'
  const fg = state === 'done' ? '#15803d' : state === 'error' ? '#dc2626' : '#374151'
  return (
    <button onClick={push} disabled={!orgId || state === 'sending'}
      title={isNl
        ? 'Alle kassaschermen in deze organisatie verversen onmiddellijk hun productlijst.'
        : 'Every POS terminal in this organisation refreshes its product list immediately.'}
      style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${bd}`, background: bg, color: fg, fontSize: 13, fontWeight: 700, cursor: orgId ? 'pointer' : 'not-allowed', opacity: orgId ? 1 : 0.5, whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: 10, fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s', boxSizing: 'border-box',
}
function fi(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#7c3aed'
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,.12)'
}
function fo(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#e5e7eb'
  e.currentTarget.style.boxShadow = 'none'
}
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a0' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`
const selectSt: React.CSSProperties = { ...inputSt, appearance: 'none', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36, cursor: 'pointer' }

type Tab = 'products' | 'categories'

// ─── BarcodeScanModal ─────────────────────────────────────────────────────────
function BarcodeScanModal({ isNl, onDetected, onClose }: {
  isNl: boolean
  onDetected: (code: string) => void
  onClose: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [error, setError]       = useState('')
  const [detected, setDetected] = useState('')
  const [flash, setFlash]       = useState(false)

  useEffect(() => {
    if (!viewportRef.current) return
    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: viewportRef.current,
        constraints: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 360 } },
      },
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader'] },
      locate: true,
    }, (err) => {
      if (err) { setError(String(err)); return }
      Quagga.start()
    })

    Quagga.onDetected((result) => {
      const code = result.codeResult?.code
      if (!code) return
      setDetected(code)
      setFlash(true)
      setTimeout(() => setFlash(false), 300)
    })

    return () => { Quagga.stop() }
  }, [])

  function confirm() {
    if (detected) { onDetected(detected); onClose() }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#1c1c2e', borderRadius: 20, overflow: 'hidden', width: '100%', maxWidth: 520, boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(124,58,237,.25)', border: '1px solid rgba(124,58,237,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/>
                <path d="M21 16h-3v3M18 21h3M14 3v3M14 8h-3M14 13h3v3M14 19v2M8 14H3M3 21h5v-2"/>
              </svg>
            </div>
            <div>
              <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 14 }}>{isNl ? 'Barcode scannen' : 'Scan barcode'}</p>
              <p style={{ color: 'rgba(148,163,184,.5)', fontSize: 11 }}>{isNl ? 'Richt de camera op de barcode' : 'Point camera at the barcode'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'rgba(255,255,255,.5)', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Viewport */}
        <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
          <div ref={viewportRef} style={{ width: '100%', minHeight: 260, position: 'relative' }} />
          {/* Scan line overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '70%', height: 2, background: flash ? '#22c55e' : 'rgba(124,58,237,.7)', boxShadow: flash ? '0 0 12px #22c55e' : '0 0 8px rgba(124,58,237,.8)', transition: 'all .15s', borderRadius: 2 }} />
          </div>
          {/* Corner brackets */}
          {[
            { top: 16, left: 16, borderTop: '3px solid #7c3aed', borderLeft: '3px solid #7c3aed' },
            { top: 16, right: 16, borderTop: '3px solid #7c3aed', borderRight: '3px solid #7c3aed' },
            { bottom: 16, left: 16, borderBottom: '3px solid #7c3aed', borderLeft: '3px solid #7c3aed' },
            { bottom: 16, right: 16, borderBottom: '3px solid #7c3aed', borderRight: '3px solid #7c3aed' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 22, height: 22, borderRadius: 2, pointerEvents: 'none', ...s }} />
          ))}
        </div>

        {/* Bottom panel */}
        <div style={{ padding: '18px 22px' }}>
          {error && (
            <p style={{ fontSize: 12.5, color: '#f87171', background: 'rgba(239,68,68,.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
              {isNl ? 'Camera niet beschikbaar: ' : 'Camera unavailable: '}{error}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', border: `1.5px solid ${detected ? '#22c55e' : 'rgba(255,255,255,.1)'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, transition: 'border-color .2s' }}>
              {detected
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              }
              <span style={{ fontSize: 13, fontFamily: detected ? 'monospace' : 'inherit', color: detected ? '#22c55e' : 'rgba(148,163,184,.4)', fontWeight: detected ? 700 : 400 }}>
                {detected || (isNl ? 'Wachten op scan…' : 'Waiting for scan…')}
              </span>
            </div>
            <button onClick={confirm} disabled={!detected}
              style={{ padding: '10px 18px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: detected ? 'pointer' : 'not-allowed', background: detected ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(255,255,255,.07)', color: detected ? '#fff' : 'rgba(148,163,184,.3)', transition: 'all .15s', whiteSpace: 'nowrap', boxShadow: detected ? '0 4px 14px rgba(124,58,237,.4)' : 'none' }}>
              {isNl ? 'Gebruiken' : 'Use this'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(148,163,184,.35)', marginTop: 10, textAlign: 'center' }}>
            {isNl ? 'Of scan met een USB-barcodescanner in het invoerveld' : 'Or use a USB barcode scanner directly in the input field'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── CategoryFormModal ────────────────────────────────────────────────────────
function CategoryFormModal({ cat, orgId, isNl, onClose }: {
  cat?: Category; orgId: string | null; isNl: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateCategoryPayload>({
    name_nl:      cat?.name_nl    ?? '',
    name_en:      cat?.name_en    ?? '',
    sort_order:   cat?.sort_order ?? 0,
    organisation_id: orgId ?? undefined,
  })

  const mutation = useMutation({
    mutationFn: () => cat
      ? updateCategory(cat.id, form)
      : createCategory(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); onClose() },
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
            {cat ? (isNl ? 'Categorie bewerken' : 'Edit category') : (isNl ? 'Nieuwe categorie' : 'New category')}
          </h3>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>×</button>
        </div>

        {mutation.isError && (
          <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Fout opgetreden' : 'An error occurred')}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {isNl ? 'Naam (Nederlands)' : 'Name (Dutch)'} *
            </label>
            <input type="text" value={form.name_nl} onChange={(e) => setForm((f) => ({ ...f, name_nl: e.target.value }))}
              placeholder="bijv. Zuivel" style={inputSt} onFocus={fi} onBlur={fo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {isNl ? 'Naam (Engels)' : 'Name (English)'} *
            </label>
            <input type="text" value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
              placeholder="e.g. Dairy" style={inputSt} onFocus={fi} onBlur={fo} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              {isNl ? 'Sorteervolgorde' : 'Sort order'}
            </label>
            <input type="number" min="0" value={form.sort_order ?? 0}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              style={inputSt} onFocus={fi} onBlur={fo} />
          </div>
          {cat && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              <input type="checkbox" checked={(form as { is_active?: boolean }).is_active ?? cat.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked } as CreateCategoryPayload & { is_active: boolean }))}
                style={{ width: 16, height: 16, accentColor: '#7c3aed' }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1c2e' }}>
                {isNl ? 'Actief' : 'Active'}
              </span>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name_nl || !form.name_en}
            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name_nl || !form.name_en ? 0.5 : 1 }}>
            {mutation.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ProductFormModal ─────────────────────────────────────────────────────────
// ─── BTW rate dropdown with "Custom %" option ────────────────────────────────
// Suriname BTW is currently a flat 10% on most goods + 0% (exempt) on basic
// foodstuffs / medicine. But some products (alcohol, tobacco, luxury) have
// historically carried different rates, and Belastingdienst can change rates
// without a code release. So we ship the two common rates as one-click options
// and let the user enter any rate the law allows.
//
// Internally the form stores `btw_rate` as a string ("10", "0", "7.5", …) —
// the dropdown decides whether to render the custom input by checking whether
// the current value is one of the presets.
function BtwRateField({ value, onChange, isNl, disabled = false, disabledHint }: {
  value: string
  onChange: (v: string) => void
  isNl: boolean
  disabled?: boolean
  disabledHint?: string
}) {
  const PRESETS = ['0', '10']
  const isCustom = !PRESETS.includes(value)
  const [mode, setMode] = useState<'preset' | 'custom'>(isCustom ? 'custom' : 'preset')

  function handleSelect(v: string) {
    if (v === '__custom__') {
      setMode('custom')
      // Don't clear value — the user may have typed it already; otherwise start blank.
      if (PRESETS.includes(value)) onChange('')
    } else {
      setMode('preset')
      onChange(v)
    }
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>BTW %</label>
      <select
        value={mode === 'custom' ? '__custom__' : value}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={disabled}
        title={disabled ? disabledHint : undefined}
        style={{ ...selectSt, opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
        onFocus={fi} onBlur={fo}
      >
        <option value="0">{isNl ? '0% (vrijgesteld)' : '0% (exempt)'}</option>
        <option value="10">{isNl ? '10% (standaard)' : '10% (standard)'}</option>
        <option value="__custom__">{isNl ? 'Aangepast…' : 'Custom…'}</option>
      </select>
      {disabled && disabledHint && (
        <p style={{ fontSize: 11, color: '#9090a0', marginTop: 4, fontStyle: 'italic' }}>{disabledHint}</p>
      )}
      {mode === 'custom' && (
        <input
          type="number" min="0" max="100" step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={isNl ? 'bijv. 7.5' : 'e.g. 7.5'}
          style={{ ...inputSt, marginTop: 6, fontFamily: 'monospace', opacity: disabled ? 0.55 : 1 }}
          onFocus={fi} onBlur={fo}
          autoFocus
        />
      )}
    </div>
  )
}

function ProductFormModal({ product, categories, orgId, isNl, onClose }: {
  product?: Product; categories: Category[]; orgId: string | null; isNl: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [showScanner, setShowScanner] = useState(false)

  // Option A (revised): SM owns the catalogue at their store, INCLUDING cost.
  // Splitting cost from the rest of the product was illogical — forced an
  // SM-creates-then-OA-fills-cost handoff that nobody wanted. Cashier still
  // never sees cost (gated on the till's product payload).
  //
  // BTW rate + exempt flag STAY OA-only — mis-classification has
  // Belastingdienst-filing implications nobody wants to discover at audit
  // time. Two separate gates from here on:
  //   canSetBtw   → OA + SA only        (Belastingdienst risk)
  //   canViewCost → OA + SA + SM        (catalogue ownership)
  const actor = useDashboardAuthStore((s) => s.user)
  const canSetBtw   = actor?.role === 'super_admin' || actor?.role === 'organisation_admin'
  const canViewCost = canSetBtw || actor?.role === 'store_manager'
  const [form, setForm] = useState<CreateProductPayload & { is_active?: boolean }>({
    name_nl:        product?.name_nl   ?? '',
    name_en:        product?.name_en   ?? '',
    barcode:        product?.barcode   ?? '',
    sku:            product?.sku       ?? '',
    price:          product?.price     ?? '',
    cost_price:     product?.cost_price ?? '',
    btw_rate:       product?.btw_rate  ?? '10',
    btw_exempt:     product?.btw_exempt ?? false,
    stock_qty:      product?.stock_qty ?? '0',
    category_id:    product?.category_id ?? null,
    brand:          product?.brand     ?? '',
    supplier:       product?.supplier  ?? '',
    unit:           product?.unit      ?? 'each',
    description_nl: product?.description_nl ?? '',
    description_en: product?.description_en ?? '',
    organisation_id: orgId ?? undefined,
    is_active:      product?.is_active ?? true,
  })
  // Local image preview state — separate from form because file upload is a
  // separate request from the product save (we need a product.id first).
  const [imageFile, setImageFile]   = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null)

  function handleImagePick(f: File) {
    setImageFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview((e.target?.result as string) ?? null)
    reader.readAsDataURL(f)
  }

  const mutation = useMutation({
    // Save the product, THEN upload the image if the user picked a new file.
    // Two requests because the image upload needs the product id, and we
    // don't know it until create() returns. For edits, id is on `product`.
    mutationFn: async () => {
      const saved = product
        ? await updateProduct(product.id, form)
        : await createProduct(form)
      if (imageFile) {
        await uploadProductImage(saved.id, imageFile)
      }
      return saved
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
  })

  function set(field: keyof typeof form, value: string | boolean | null) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(0,0,0,.22)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1c1c2e', marginBottom: 2 }}>
              {product ? (isNl ? 'Product bewerken' : 'Edit product') : (isNl ? 'Nieuw product' : 'New product')}
            </h3>
            {product && <p style={{ fontSize: 12.5, color: '#9090a0' }}>{product.name_nl}</p>}
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#6b7280', fontSize: 18, flexShrink: 0 }}>×</button>
        </div>

        {mutation.isError && (
          <p style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', padding: '8px 12px', borderRadius: 8, marginBottom: 16 }}>
            {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Fout opgetreden' : 'An error occurred')}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Names */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Naam (NL)' : 'Name (NL)'} *</label>
              <input type="text" value={form.name_nl} onChange={(e) => set('name_nl', e.target.value)}
                placeholder="bijv. Volle Melk" style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Naam (EN)' : 'Name (EN)'} *</label>
              <input type="text" value={form.name_en} onChange={(e) => set('name_en', e.target.value)}
                placeholder="e.g. Whole Milk" style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          {/* Category + Barcode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Categorie' : 'Category'}</label>
              <select value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)} style={selectSt} onFocus={fi} onBlur={fo}>
                <option value="">{isNl ? '— Geen categorie —' : '— No category —'}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{isNl ? c.name_nl : c.name_en}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Barcode' : 'Barcode'}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={form.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)}
                  placeholder="EAN-13 / Code 128" style={{ ...inputSt, fontFamily: 'monospace', flex: 1 }} onFocus={fi} onBlur={fo} />
                <button type="button" onClick={() => setShowScanner(true)} title={isNl ? 'Scannen met camera' : 'Scan with camera'}
                  style={{ flexShrink: 0, width: 42, height: 42, border: '1.5px solid #e5e7eb', borderRadius: 10, background: '#f8f7ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', transition: 'all .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#ede9fe'; e.currentTarget.style.borderColor = '#7c3aed' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f8f7ff'; e.currentTarget.style.borderColor = '#e5e7eb' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/>
                    <path d="M21 16h-3v3M18 21h3M14 3v3M14 8h-3M14 13h3v3M14 19v2M8 14H3M3 21h5v-2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* SKU + Unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>SKU</label>
              <input type="text" value={form.sku ?? ''} onChange={(e) => set('sku', e.target.value)}
                placeholder={isNl ? 'bijv. MELK-1L' : 'e.g. MILK-1L'} style={{ ...inputSt, fontFamily: 'monospace' }} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Eenheid' : 'Unit'}</label>
              <select value={form.unit ?? 'each'} onChange={(e) => set('unit', e.target.value as Product['unit'])}
                style={selectSt} onFocus={fi} onBlur={fo}>
                <option value="each">{isNl ? 'stuks (each)' : 'each'}</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">{isNl ? 'liter' : 'liter'}</option>
                <option value="ml">ml</option>
                <option value="pak">{isNl ? 'pak (package)' : 'pak (package)'}</option>
              </select>
            </div>
          </div>

          {/* Price + Cost (cost OA-only) + BTW + Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: canViewCost ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Prijs (SRD)' : 'Price (SRD)'} *</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)}
                placeholder="0.00" style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
            {canViewCost && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  {isNl ? 'Inkoop (SRD)' : 'Cost (SRD)'}
                </label>
                <input type="number" min="0" step="0.01" value={form.cost_price ?? ''} onChange={(e) => set('cost_price', e.target.value)}
                  placeholder="—" style={inputSt} onFocus={fi} onBlur={fo} />
                {form.cost_price && form.price && parseFloat(form.price) > 0 && (
                  <p style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                    {isNl ? 'Marge' : 'Margin'}: {((parseFloat(form.price) - parseFloat(form.cost_price)) / parseFloat(form.price) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            )}
            <BtwRateField
              value={form.btw_rate}
              onChange={(v) => set('btw_rate', v)}
              isNl={isNl}
              disabled={!canSetBtw}
              disabledHint={isNl
                ? 'Alleen Org Admin kan het BTW-tarief wijzigen — vraag uw OA.'
                : 'Only the Org Admin can change the BTW rate — ask your OA.'}
            />
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Voorraad' : 'Stock'}</label>
              <input type="number" min="0" step="0.001" value={form.stock_qty ?? '0'} onChange={(e) => set('stock_qty', e.target.value)}
                style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          {/* Brand + Supplier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Merk' : 'Brand'}</label>
              <input type="text" value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)}
                placeholder={isNl ? 'bijv. Frutex' : 'e.g. Frutex'} style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Leverancier' : 'Supplier'}</label>
              <input type="text" value={form.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)}
                placeholder={isNl ? 'bijv. Yu Pi NV' : 'e.g. Yu Pi NV'} style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Afbeelding' : 'Image'}</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <label style={{ width: 96, height: 96, border: '2px dashed #d1d5db', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fafbff', overflow: 'hidden', flexShrink: 0 }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 28, color: '#d1d5db' }}>📷</span>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImagePick(f) }} />
              </label>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                {isNl ? 'JPG / PNG / WebP, max 5 MB. Klik op het vak om te uploaden.' : 'JPG / PNG / WebP, max 5 MB. Click the box to upload.'}
                <br/>
                {imageFile && <span style={{ color: '#15803d', fontWeight: 600 }}>{imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</span>}
              </div>
            </div>
          </div>

          {/* Description (NL + EN) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Omschrijving (NL)' : 'Description (NL)'}</label>
              <textarea value={form.description_nl ?? ''} onChange={(e) => set('description_nl', e.target.value)}
                rows={3} placeholder={isNl ? 'Ingrediënten, allergenen, marketing tekst…' : 'Ingredients, allergens, marketing copy…'}
                style={{ ...inputSt, resize: 'vertical', minHeight: 60 }} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Omschrijving (EN)' : 'Description (EN)'}</label>
              <textarea value={form.description_en ?? ''} onChange={(e) => set('description_en', e.target.value)}
                rows={3} placeholder={isNl ? 'In het Engels' : 'In English'}
                style={{ ...inputSt, resize: 'vertical', minHeight: 60 }} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          {/* Variants — only on edit (need parent ID first) */}
          {product && <VariantsSection productId={product.id} canSetCost={canViewCost} isNl={isNl} />}

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 10 }}>
            <label
              title={!canSetBtw ? (isNl ? 'Alleen Org Admin kan dit wijzigen.' : 'Only the Org Admin can change this.') : undefined}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: canSetBtw ? 'pointer' : 'not-allowed', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', opacity: canSetBtw ? 1 : 0.55 }}>
              <input type="checkbox" checked={form.btw_exempt ?? false}
                onChange={(e) => set('btw_exempt', e.target.checked)}
                disabled={!canSetBtw}
                style={{ width: 15, height: 15, accentColor: '#7c3aed' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c2e' }}>{isNl ? 'BTW-vrijgesteld' : 'BTW exempt'}</div>
                <div style={{ fontSize: 11, color: '#9090a0' }}>{isNl ? 'Basisvoedsel, medicijnen' : 'Basic food, medicine'}</div>
              </div>
            </label>
            {product && (
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <input type="checkbox" checked={form.is_active ?? true}
                  onChange={(e) => set('is_active', e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: '#7c3aed' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1c2e' }}>{isNl ? 'Actief' : 'Active'}</div>
                  <div style={{ fontSize: 11, color: '#9090a0' }}>{isNl ? 'Zichtbaar in POS' : 'Visible in POS'}</div>
                </div>
              </label>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: '#f5f5fb', border: '1px solid #e0e0ed', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name_nl || !form.name_en || !form.price}
            style={{ flex: 1, padding: '11px 0', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', cursor: 'pointer', opacity: mutation.isPending || !form.name_nl || !form.name_en || !form.price ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}>
            {mutation.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
    {showScanner && (
      <BarcodeScanModal
        isNl={isNl}
        onDetected={(code) => set('barcode', code)}
        onClose={() => setShowScanner(false)}
      />
    )}
    </>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CatalogueScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore((s) => s.isSuperAdmin())
  const currentUser  = useDashboardAuthStore((s) => s.user)
  // Two gates (see the longer note inside ProductFormModal):
  //   canSetBtw   → OA + SA only        (Belastingdienst risk)
  //   canViewCost → OA + SA + SM        (catalogue ownership — SM that
  //                                       creates a product also sets cost)
  // Cashier is excluded from both; cost is stripped server-side too.
  const canSetBtw    = currentUser?.role === 'super_admin' || currentUser?.role === 'organisation_admin'
  const canViewCost  = canSetBtw || currentUser?.role === 'store_manager'
  const qc = useQueryClient()

  const [tab, setTab]                     = useState<Tab>('products')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [selectedCatId, setSelectedCatId] = useState<string>('')
  const [search, setSearch]               = useState('')
  const [editProduct, setEditProduct]     = useState<Product | undefined>()
  const [editCategory, setEditCategory]   = useState<Category | undefined>()
  const [showProductForm, setShowProductForm]   = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)

  // For non-super-admins, the org is their own
  const effectiveOrgId = isSuperAdmin ? (selectedOrgId || null) : (currentUser?.organisation_id ?? null)

  const { data: orgs = [] } = useQuery({
    queryKey: ['organisations'],
    queryFn: () => import('@/api/organisations').then((m) => m.getOrganisations()),
    enabled: isSuperAdmin,
  })

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['categories', effectiveOrgId],
    queryFn: () => getCategories(effectiveOrgId ?? undefined),
    enabled: !!effectiveOrgId || !isSuperAdmin,
  })

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ['products', effectiveOrgId, selectedCatId, search],
    queryFn: () => getProducts({
      organisation_id: effectiveOrgId ?? undefined,
      category_id: selectedCatId || undefined,
      search: search || undefined,
    }),
    enabled: tab === 'products' && (!!effectiveOrgId || !isSuperAdmin),
  })

  const toggleProductStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateProduct(id, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const toggleCategoryStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateCategory(id, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  // Org selector (super admin only)
  function OrgSelector() {
    if (!isSuperAdmin) return null
    return (
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M4 21V7l8-4 8 4v14M9 21v-5h6v5"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>
          {isNl ? 'Organisatie:' : 'Organisation:'}
        </span>
        <select value={selectedOrgId} onChange={(e) => { setSelectedOrgId(e.target.value); setSelectedCatId('') }}
          style={{ ...selectSt, border: 'none', background: 'transparent', backgroundImage: chevron, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0 center', paddingRight: 24, fontSize: 13, fontWeight: 700, color: '#1c1c2e', flex: 1 }}>
          <option value="">{isNl ? '— Kies een organisatie —' : '— Choose an organisation —'}</option>
          {(orgs as Organisation[]).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>
    )
  }

  const noOrgSelected = isSuperAdmin && !selectedOrgId

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1200 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Catalogus' : 'Catalogue'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl
              ? 'Beheer producten en categorieën voor uw organisatie.'
              : 'Manage products and categories for your organisation.'}
          </p>
        </div>
        {!noOrgSelected && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <PushCatalogueButton orgId={effectiveOrgId ?? ''} isNl={isNl} />
            <button
              onClick={() => tab === 'products' ? (setEditProduct(undefined), setShowProductForm(true)) : (setEditCategory(undefined), setShowCategoryForm(true))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              {tab === 'products'
                ? (isNl ? 'Product toevoegen' : 'Add product')
                : (isNl ? 'Categorie toevoegen' : 'Add category')}
            </button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { id: 'products'    as const, nl: 'Producten',   en: 'Products'   },
          { id: 'categories'  as const, nl: 'Categorieën', en: 'Categories' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: tab === t.id ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : '#fff',
            color: tab === t.id ? '#fff' : '#6b7280',
            boxShadow: tab === t.id ? '0 2px 10px rgba(124,58,237,.35)' : '0 1px 4px rgba(0,0,0,.06)',
            border: tab === t.id ? '1px solid transparent' : '1px solid #e9e9ef',
          } as React.CSSProperties}>
            {isNl ? t.nl : t.en}
            <span style={{ marginLeft: 7, padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: tab === t.id ? 'rgba(255,255,255,.2)' : '#f0f0f8', color: tab === t.id ? '#fff' : '#7c3aed' }}>
              {t.id === 'products' ? products.length : categories.length}
            </span>
          </button>
        ))}
      </div>

      {/* Org selector (super admin) */}
      <OrgSelector />

      {/* Need to pick org first */}
      {noOrgSelected && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1c2e', marginBottom: 6 }}>
            {isNl ? 'Kies een organisatie' : 'Choose an organisation'}
          </div>
          <div style={{ fontSize: 13, color: '#9090a0' }}>
            {isNl ? 'Selecteer een organisatie hierboven om de catalogus te beheren.' : 'Select an organisation above to manage the catalogue.'}
          </div>
        </div>
      )}

      {/* ── PRODUCTS tab ─────────────────────────────────────────────────── */}
      {!noOrgSelected && tab === 'products' && (
        <>
          {/* Filter bar */}
          <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9090a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="search" placeholder={isNl ? 'Zoeken op naam of barcode…' : 'Search by name or barcode…'}
                value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: 13.5, color: '#1c1c2e', background: 'transparent', fontFamily: 'inherit', flex: 1 }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9090a0', fontSize: 16, lineHeight: 1 }}>×</button>}
            </div>
            {/* Category filter */}
            <select value={selectedCatId} onChange={(e) => setSelectedCatId(e.target.value)}
              style={{ ...selectSt, width: 'auto', minWidth: 160, border: '1px solid #e0e0ed', padding: '7px 32px 7px 12px' }}>
              <option value="">{isNl ? 'Alle categorieën' : 'All categories'}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{isNl ? c.name_nl : c.name_en}</option>
              ))}
            </select>
          </div>

          {/* Products table */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            {prodLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #f3f3f8' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f0f0f8' }} />
                    <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#f0f0f8', maxWidth: 200 }} />
                    <div style={{ width: 80, height: 12, borderRadius: 6, background: '#f5f5fb' }} />
                    <div style={{ width: 60, height: 22, borderRadius: 11, background: '#f0f0f8' }} />
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                    {[
                      '',                                            // image thumbnail
                      isNl ? 'Product' : 'Product',
                      'SKU',
                      isNl ? 'Categorie' : 'Category',
                      isNl ? 'Barcode' : 'Barcode',
                      isNl ? 'Prijs (SRD)' : 'Price (SRD)',
                      // Cost column visible to OA + SA + SM (catalogue
                      // ownership). Backend strips cost_price for cashier +
                      // any role without products.view_cost, so even if
                      // rendered the cell would be blank for them.
                      ...(canViewCost ? [isNl ? 'Inkoop (SRD)' : 'Cost (SRD)'] : []),
                      'BTW',
                      isNl ? 'Voorraad' : 'Stock',
                      isNl ? 'Eenheid' : 'Unit',
                      isNl ? 'Status' : 'Status',
                      isNl ? 'Acties' : 'Actions',
                    ].map((h, i) => (
                      <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id}
                      style={{ borderBottom: i < products.length - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {/* Image thumbnail — placeholder square if none. 36×36
                          keeps the row from blowing up vertically. */}
                      <td style={{ padding: '12px 16px', width: 56 }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', background: '#f5f5fb', border: '1px solid #eeeef8' }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f5f5fb', border: '1px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 14 }}>📦</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{isNl ? p.name_nl : p.name_en}</div>
                        {p.name_nl !== p.name_en && (
                          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>{isNl ? p.name_en : p.name_nl}</div>
                        )}
                        {p.brand && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>{p.brand}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#6b7280', fontFamily: 'monospace' }}>
                        {p.sku || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.category_name ? (
                          <span style={{ padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f0f0f8', color: '#4338ca' }}>{p.category_name}</span>
                        ) : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#6b7280', fontFamily: 'monospace' }}>
                        {p.barcode || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>
                        SRD {parseFloat(p.price).toFixed(2)}
                      </td>
                      {canViewCost && (
                        <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                          {p.cost_price != null
                            ? <>SRD {parseFloat(p.cost_price).toFixed(2)}{p.margin_pct && <span style={{ fontSize: 10.5, color: '#15803d', marginLeft: 6 }}>+{parseFloat(p.margin_pct).toFixed(0)}%</span>}</>
                            : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      )}
                      <td style={{ padding: '12px 16px' }}>
                        {p.btw_exempt ? (
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                            {isNl ? 'Vrijgesteld' : 'Exempt'}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{parseFloat(p.btw_rate).toFixed(0)}%</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13.5, fontWeight: 600, color: parseFloat(p.stock_qty) <= 0 ? '#dc2626' : '#374151' }}>
                        {parseFloat(p.stock_qty).toFixed(0)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#9090a0', fontFamily: 'monospace' }}>
                        {p.unit || 'each'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: p.is_active ? '#f0fdf4' : '#f9fafb', color: p.is_active ? '#15803d' : '#9ca3af', border: `1px solid ${p.is_active ? '#bbf7d0' : '#e5e7eb'}` }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.is_active ? '#22c55e' : '#d1d5db' }} />
                          {p.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => { setEditProduct(p); setShowProductForm(true) }}
                            style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #e0e0ed', background: '#f8f7ff', color: '#6d28d9', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {isNl ? 'Bewerken' : 'Edit'}
                          </button>
                          <button onClick={() => { if (confirm(isNl ? `"${p.name_nl}" ${p.is_active ? 'deactiveren' : 'activeren'}?` : `${p.is_active ? 'Deactivate' : 'Activate'} "${p.name_en}"?`)) toggleProductStatus.mutate({ id: p.id, active: !p.is_active }) }}
                            style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...(p.is_active ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' } : { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }) }}>
                            {p.is_active ? (isNl ? 'Deact.' : 'Deact.') : (isNl ? 'Act.' : 'Act.')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={canViewCost ? 12 : 11} style={{ padding: '60px 24px', textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                        {search ? (isNl ? 'Geen producten gevonden voor uw zoekopdracht' : 'No products match your search') : (isNl ? 'Nog geen producten' : 'No products yet')}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
            {products.length > 0 && (
              <div style={{ padding: '11px 20px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 12, color: '#9090a0' }}>{products.length} {isNl ? 'producten' : 'products'}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CATEGORIES tab ──────────────────────────────────────────────── */}
      {!noOrgSelected && tab === 'categories' && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          {catLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #f3f3f8' }}>
                  <div style={{ flex: 1, height: 13, borderRadius: 7, background: '#f0f0f8', maxWidth: 180 }} />
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
                    isNl ? 'Naam (NL)' : 'Name (NL)',
                    isNl ? 'Naam (EN)' : 'Name (EN)',
                    isNl ? 'Producten' : 'Products',
                    isNl ? 'Volgorde' : 'Order',
                    isNl ? 'Status' : 'Status',
                    isNl ? 'Acties' : 'Actions',
                  ].map((h) => (
                    <th key={h} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, i) => (
                  <tr key={cat.id}
                    style={{ borderBottom: i < categories.length - 1 ? '1px solid #f3f3f8' : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{cat.name_nl}</td>
                    <td style={{ padding: '14px 20px', fontSize: 13.5, color: '#6b7280' }}>{cat.name_en}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>{cat.product_count ?? '—'}</span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 13, color: '#9090a0', fontWeight: 600 }}>{cat.sort_order}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cat.is_active ? '#f0fdf4' : '#f9fafb', color: cat.is_active ? '#15803d' : '#9ca3af', border: `1px solid ${cat.is_active ? '#bbf7d0' : '#e5e7eb'}` }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.is_active ? '#22c55e' : '#d1d5db' }} />
                        {cat.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => { setEditCategory(cat); setShowCategoryForm(true) }}
                          style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid #e0e0ed', background: '#f8f7ff', color: '#6d28d9', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {isNl ? 'Bewerken' : 'Edit'}
                        </button>
                        <button onClick={() => { if (confirm(isNl ? `"${cat.name_nl}" ${cat.is_active ? 'deactiveren' : 'activeren'}?` : `${cat.is_active ? 'Deactivate' : 'Activate'} "${cat.name_en}"?`)) toggleCategoryStatus.mutate({ id: cat.id, active: !cat.is_active }) }}
                          style={{ padding: '4px 10px', borderRadius: 7, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', ...(cat.is_active ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' } : { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }) }}>
                          {cat.is_active ? (isNl ? 'Deact.' : 'Deact.') : (isNl ? 'Act.' : 'Act.')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🗂️</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
                      {isNl ? 'Nog geen categorieën' : 'No categories yet'}
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
          {categories.length > 0 && (
            <div style={{ padding: '11px 20px', borderTop: '1px solid #f3f3f8', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#9090a0' }}>{categories.length} {isNl ? 'categorieën' : 'categories'}</span>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showProductForm && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          orgId={effectiveOrgId}
          isNl={isNl}
          onClose={() => { setShowProductForm(false); setEditProduct(undefined) }}
        />
      )}
      {showCategoryForm && (
        <CategoryFormModal
          cat={editCategory}
          orgId={effectiveOrgId}
          isNl={isNl}
          onClose={() => { setShowCategoryForm(false); setEditCategory(undefined) }}
        />
      )}
    </div>
  )
}


// ─── Variants section — rendered inside the product form modal when editing ─
// Lets the OA add / edit / delete sizes / colours / flavours under a parent
// product. Variants are POSTed to /products/{id}/variants — independent of
// the parent's save action.
function VariantsSection({ productId, canSetCost, isNl }: {
  productId: string
  canSetCost: boolean
  isNl: boolean
}) {
  const qc = useQueryClient()
  const { data: variants = [], isLoading } = useQuery({
    queryKey: ['variants', productId],
    queryFn:  () => getVariants(productId),
  })

  const [draft, setDraft] = useState<CreateVariantPayload>({
    name_nl: '', name_en: '', sku: '', price: '', stock_qty: '0',
  })

  const createMut = useMutation({
    mutationFn: () => createVariant(productId, {
      ...draft,
      price: draft.price?.trim() ? draft.price : null,
      cost_price: draft.cost_price?.toString().trim() ? draft.cost_price : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variants', productId] })
      setDraft({ name_nl: '', name_en: '', sku: '', price: '', stock_qty: '0' })
    },
  })

  const delMut = useMutation({
    mutationFn: (variantId: string) => deleteVariant(productId, variantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variants', productId] }),
  })

  return (
    <div style={{ padding: '14px 16px', background: '#fafbff', borderRadius: 12, border: '1px solid #eeeef8' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>
          {isNl ? 'Varianten (maten / smaken)' : 'Variants (sizes / flavors)'}
          {variants.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#9090a0' }}>· {variants.length}</span>
          )}
        </h4>
      </div>
      <p style={{ fontSize: 11.5, color: '#9090a0', marginTop: 0, marginBottom: 10 }}>
        {isNl
          ? 'Bv. Bruine Bonen 500g / 1kg / 5kg — elk met eigen SKU, voorraad en optionele prijs.'
          : 'E.g. Bruine Bonen 500g / 1kg / 5kg — each with own SKU, stock, optional price override.'}
      </p>

      {/* Existing variants list */}
      {isLoading
        ? <div style={{ fontSize: 12, color: '#9090a0' }}>…</div>
        : variants.length === 0
          ? <p style={{ fontSize: 12, color: '#9090a0', fontStyle: 'italic', margin: '8px 0' }}>{isNl ? 'Nog geen varianten — voeg er een toe hieronder.' : 'No variants yet — add one below.'}</p>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eeeef8' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, color: '#6d6d80', fontWeight: 700, textTransform: 'uppercase' }}>{isNl ? 'Naam' : 'Name'}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, color: '#6d6d80', fontWeight: 700, textTransform: 'uppercase' }}>SKU</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10.5, color: '#6d6d80', fontWeight: 700, textTransform: 'uppercase' }}>{isNl ? 'Prijs' : 'Price'}</th>
                  {canSetCost && <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10.5, color: '#6d6d80', fontWeight: 700, textTransform: 'uppercase' }}>{isNl ? 'Inkoop' : 'Cost'}</th>}
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10.5, color: '#6d6d80', fontWeight: 700, textTransform: 'uppercase' }}>{isNl ? 'Voorr.' : 'Stock'}</th>
                  <th style={{ width: 28 }} />
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f3f8' }}>
                    <td style={{ padding: '7px 8px', color: '#1c1c2e', fontWeight: 600 }}>{isNl ? v.name_nl : v.name_en}</td>
                    <td style={{ padding: '7px 8px', color: '#6b7280', fontFamily: 'monospace', fontSize: 11.5 }}>{v.sku || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: '#7c3aed', fontWeight: 700 }}>
                      SRD {parseFloat(v.effective_price).toFixed(2)}
                      {v.price == null && <span style={{ marginLeft: 4, fontSize: 9.5, color: '#9090a0', fontStyle: 'italic' }}>{isNl ? '(erfd)' : '(inh)'}</span>}
                    </td>
                    {canSetCost && (
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: '#374151' }}>
                        {v.effective_cost ? `SRD ${parseFloat(v.effective_cost).toFixed(2)}` : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: parseFloat(v.stock_qty) <= 0 ? '#dc2626' : '#374151' }}>
                      {parseFloat(v.stock_qty).toFixed(0)}
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <button onClick={() => { if (confirm(isNl ? `Variant "${v.name_nl}" verwijderen?` : `Delete variant "${v.name_en}"?`)) delMut.mutate(v.id) }}
                        title={isNl ? 'Verwijderen' : 'Delete'}
                        style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 13, cursor: 'pointer' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      }

      {/* Inline "add new variant" row */}
      <div style={{ display: 'grid', gridTemplateColumns: canSetCost ? '1.4fr 1fr 1fr 0.8fr 0.8fr auto' : '1.4fr 1fr 1fr 0.8fr auto', gap: 6, alignItems: 'center' }}>
        <input type="text" value={draft.name_nl ?? ''} onChange={(e) => setDraft({ ...draft, name_nl: e.target.value, name_en: draft.name_en || e.target.value })}
          placeholder={isNl ? 'bijv. 1kg' : 'e.g. 1kg'}
          style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }} />
        <input type="text" value={draft.sku ?? ''} onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
          placeholder="SKU" style={{ ...inputSt, padding: '7px 10px', fontSize: 12, fontFamily: 'monospace' }} />
        <input type="number" step="0.01" min="0" value={draft.price ?? ''} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          placeholder={isNl ? 'prijs (leeg = erf)' : 'price (blank = inherit)'}
          style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }} />
        {canSetCost && (
          <input type="number" step="0.01" min="0" value={draft.cost_price?.toString() ?? ''} onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
            placeholder={isNl ? 'inkoop' : 'cost'}
            style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }} />
        )}
        <input type="number" min="0" value={draft.stock_qty ?? '0'} onChange={(e) => setDraft({ ...draft, stock_qty: e.target.value })}
          placeholder={isNl ? 'voorr.' : 'stock'}
          style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }} />
        <button onClick={() => createMut.mutate()} disabled={!draft.name_nl || createMut.isPending}
          style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !draft.name_nl || createMut.isPending ? 0.4 : 1 }}>
          +
        </button>
      </div>
      {createMut.isError && (
        <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>
          {(createMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (isNl ? 'Fout bij opslaan' : 'Save failed')}
        </p>
      )}
    </div>
  )
}
