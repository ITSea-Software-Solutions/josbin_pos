import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Quagga from '@ericblade/quagga2'
import {
  getCategories, createCategory, updateCategory,
  getProducts, createProduct, updateProduct,
  type Category, type Product,
  type CreateCategoryPayload, type CreateProductPayload,
} from '@/api/catalogue'
import { type Organisation } from '@/api/organisations'
import { useDashboardAuthStore } from '@/store/authStore'

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
function ProductFormModal({ product, categories, orgId, isNl, onClose }: {
  product?: Product; categories: Category[]; orgId: string | null; isNl: boolean; onClose: () => void
}) {
  const qc = useQueryClient()
  const [showScanner, setShowScanner] = useState(false)
  const [form, setForm] = useState<CreateProductPayload & { is_active?: boolean }>({
    name_nl:      product?.name_nl   ?? '',
    name_en:      product?.name_en   ?? '',
    barcode:      product?.barcode   ?? '',
    price:        product?.price     ?? '',
    btw_rate:     product?.btw_rate  ?? '10',
    btw_exempt:   product?.btw_exempt ?? false,
    stock_qty:    product?.stock_qty ?? '0',
    category_id:  product?.category_id ?? null,
    organisation_id: orgId ?? undefined,
    is_active:    product?.is_active ?? true,
  })

  const mutation = useMutation({
    mutationFn: () => product
      ? updateProduct(product.id, form)
      : createProduct(form),
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

          {/* Price + BTW */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Prijs (SRD)' : 'Price (SRD)'} *</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)}
                placeholder="0.00" style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>BTW %</label>
              <select value={form.btw_rate} onChange={(e) => set('btw_rate', e.target.value)} style={selectSt} onFocus={fi} onBlur={fo}>
                <option value="0">0%</option>
                <option value="10">10%</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{isNl ? 'Voorraad' : 'Stock'}</label>
              <input type="number" min="0" step="0.001" value={form.stock_qty ?? '0'} onChange={(e) => set('stock_qty', e.target.value)}
                style={inputSt} onFocus={fi} onBlur={fo} />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
              <input type="checkbox" checked={form.btw_exempt ?? false}
                onChange={(e) => set('btw_exempt', e.target.checked)}
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
          <button
            onClick={() => tab === 'products' ? (setEditProduct(undefined), setShowProductForm(true)) : (setEditCategory(undefined), setShowCategoryForm(true))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,.35)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {tab === 'products'
              ? (isNl ? 'Product toevoegen' : 'Add product')
              : (isNl ? 'Categorie toevoegen' : 'Add category')}
          </button>
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
                      isNl ? 'Product' : 'Product',
                      isNl ? 'Categorie' : 'Category',
                      isNl ? 'Barcode' : 'Barcode',
                      isNl ? 'Prijs (SRD)' : 'Price (SRD)',
                      'BTW',
                      isNl ? 'Voorraad' : 'Stock',
                      isNl ? 'Status' : 'Status',
                      isNl ? 'Acties' : 'Actions',
                    ].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
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
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{isNl ? p.name_nl : p.name_en}</div>
                        {p.name_nl !== p.name_en && (
                          <div style={{ fontSize: 11, color: '#9090a0', marginTop: 1 }}>{isNl ? p.name_en : p.name_nl}</div>
                        )}
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
                    <tr><td colSpan={8} style={{ padding: '60px 24px', textAlign: 'center' }}>
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
