/**
 * Barcode & Label Printing Screen
 *
 * Search products → select → configure qty → preview → print to label printer.
 * Supports EAN-13, Code 128, QR barcode symbologies.
 * Uses browser print dialog (Electron's window.print()) for label printers.
 * Generates a printable label sheet with inline CSS — no external dependencies.
 */
import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import apiClient from '@/api/client'

interface Product {
  id: string
  name_nl: string
  name_en: string
  barcode: string | null
  price: string
  btw_rate: string
}

interface LabelItem {
  product: Product
  qty: number
}

type BarcodeType = 'EAN13' | 'Code128' | 'QR'
type LabelSize   = '36x24' | '50x30' | '60x40'

const LABEL_SIZES: Record<LabelSize, { w: number; h: number; label: string }> = {
  '36x24': { w: 36, h: 24, label: '36 × 24 mm' },
  '50x30': { w: 50, h: 30, label: '50 × 30 mm' },
  '60x40': { w: 60, h: 40, label: '60 × 40 mm' },
}

/**
 * Generate a barcode/QR data URL entirely in-browser using jsbarcode + qrcode.
 * No network requests — works offline and inside Docker.
 */
async function barcodeDataUrl(code: string, type: BarcodeType, widthPx: number, heightPx: number): Promise<string> {
  if (type === 'QR') {
    return QRCode.toDataURL(code, {
      width: Math.min(widthPx, heightPx),
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  }

  // EAN-13: code must be exactly 12 or 13 digits. Fall back to CODE128 if invalid.
  const format = type === 'EAN13' ? 'EAN13' : 'CODE128'
  const safeCode = format === 'EAN13' ? toEan13(code) : code

  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, safeCode, {
      format,
      displayValue: false,
      margin: 2,
      width: Math.max(1, Math.round(widthPx / Math.max(safeCode.length * 7, 40))),
      height: Math.round(heightPx * 0.85),
    })
  } catch {
    // If JsBarcode rejects the value (e.g. bad EAN-13 check digit), fall back to CODE128
    JsBarcode(canvas, code, { format: 'CODE128', displayValue: false, margin: 2, height: Math.round(heightPx * 0.85) })
  }
  return canvas.toDataURL('image/png')
}

/**
 * Normalise a string to a valid 12-digit EAN-13 body (checksum auto-calculated by JsBarcode).
 * Strips non-digits and zero-pads or truncates to 12 digits.
 */
function toEan13(code: string): string {
  const digits = code.replace(/\D/g, '').slice(0, 12).padStart(12, '0')
  return digits
}

function generatePrintHTML(
  items: LabelItem[],
  labelSize: LabelSize,
  showPrice: boolean,
  showName: boolean,
  isNl: boolean,
  dataUrls: Map<string, string>,   // productId → barcode data URL
): string {
  const { w, h } = LABEL_SIZES[labelSize]

  const labels: string[] = []
  for (const { product, qty } of items) {
    const code = product.barcode ?? product.id.replace(/-/g, '').slice(0, 12)
    const name = isNl ? product.name_nl : product.name_en
    const price = `SRD ${parseFloat(product.price).toFixed(2)}`
    const imgUrl = dataUrls.get(product.id) ?? ''

    for (let i = 0; i < qty; i++) {
      labels.push(`
        <div class="label">
          ${showName ? `<div class="lname">${name}</div>` : ''}
          ${imgUrl ? `<img src="${imgUrl}" alt="${code}" class="bimg" />` : ''}
          <div class="bcode">${code}</div>
          ${showPrice ? `<div class="lprice">${price}</div>` : ''}
        </div>
      `)
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; }
  .sheet { display: flex; flex-wrap: wrap; gap: 2mm; padding: 5mm; }
  .label {
    width: ${w}mm; height: ${h}mm;
    border: 0.3mm solid #ccc;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 1mm; overflow: hidden; page-break-inside: avoid;
  }
  .lname { font-size: 6px; font-weight: 600; text-align: center; width: 100%;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 1px; }
  .bimg { max-width: 100%; max-height: ${Math.round(h * 0.5)}mm; object-fit: contain; }
  .bcode { font-size: 5px; margin-top: 1px; letter-spacing: 0.5px; color: #333; }
  .lprice { font-size: 7px; font-weight: 700; margin-top: 1px; color: #000; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding: 3mm; gap: 1mm; }
  }
</style>
</head>
<body>
  <div class="sheet">${labels.join('')}</div>
</body>
</html>`
}

// ─── Product Row in selection table ──────────────────────────────────────────
function ProductRow({
  product, selected, qty, isNl,
  onToggle, onQtyChange,
}: {
  product: Product
  selected: boolean
  qty: number
  isNl: boolean
  onToggle: () => void
  onQtyChange: (qty: number) => void
}) {
  const name = isNl ? product.name_nl : product.name_en
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr 120px 80px',
      alignItems: 'center', padding: '10px 16px', gap: 12,
      borderBottom: '1px solid #eef2fb',
      background: selected ? 'rgba(41,51,113,0.04)' : 'transparent',
      transition: 'background 0.1s',
    }}>
      <input
        type="checkbox" checked={selected} onChange={onToggle}
        style={{ width: 18, height: 18, accentColor: '#293371', cursor: 'pointer' }}
      />
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#16203a' }}>{name}</p>
        <p style={{ fontSize: 11, color: '#7e88a0', fontFamily: 'monospace' }}>{product.barcode ?? '—'}</p>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#16203a' }}>
        SRD {parseFloat(product.price).toFixed(2)}
      </p>
      <input
        type="number" min={1} max={999} value={qty}
        onChange={e => onQtyChange(Math.max(1, Math.min(999, parseInt(e.target.value) || 1)))}
        disabled={!selected}
        style={{
          width: 70, padding: '5px 8px', borderRadius: 6,
          border: '1px solid #d9e1f1', fontSize: 13, textAlign: 'center',
          opacity: selected ? 1 : 0.35,
          outline: 'none', background: '#fff',
        }}
      />
    </div>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BarcodeLabelScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user = useAuthStore((s) => s.user)
  const storeId = useSettingsStore((s) => s.storeId)

  const [search, setSearch]           = useState('')
  const [selection, setSelection]     = useState<Map<string, LabelItem>>(new Map())
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('EAN13')
  const [labelSize, setLabelSize]     = useState<LabelSize>('50x30')
  const [showPrice, setShowPrice]     = useState(true)
  const [showName, setShowName]       = useState(true)
  const printFrameRef = useRef<HTMLIFrameElement>(null)

  const { data, isLoading, isFetching, refetch } = useQuery<{ data: Product[] }>({
    queryKey: ['products-all', user?.organisation_id],
    queryFn: async () => {
      const r = await apiClient.get('/products/pos', { params: { store_id: storeId } })
      return r.data
    },
    staleTime: 1000 * 60 * 5,
  })

  const products = data?.data ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(p =>
      p.name_nl.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q)
    )
  }, [products, search])

  function toggleProduct(p: Product) {
    setSelection(prev => {
      const m = new Map(prev)
      if (m.has(p.id)) {
        m.delete(p.id)
      } else {
        m.set(p.id, { product: p, qty: 1 })
      }
      return m
    })
  }

  function setQty(id: string, qty: number) {
    setSelection(prev => {
      const m = new Map(prev)
      const existing = m.get(id)
      if (existing) m.set(id, { ...existing, qty })
      return m
    })
  }

  function selectAll() {
    const m = new Map<string, LabelItem>()
    filtered.forEach(p => m.set(p.id, { product: p, qty: 1 }))
    setSelection(m)
  }

  function clearAll() {
    setSelection(new Map())
  }

  async function handlePrint() {
    const items = Array.from(selection.values())
    if (items.length === 0) return

    // Generate all barcode images locally (no network) before building the HTML
    const { w, h } = LABEL_SIZES[labelSize]
    const wpx = Math.round(w * 3.78)
    const hpx = Math.round(h * 3.78)

    const dataUrls = new Map<string, string>()
    for (const { product } of items) {
      const code = product.barcode ?? product.id.replace(/-/g, '').slice(0, 12)
      dataUrls.set(product.id, await barcodeDataUrl(code, barcodeType, wpx, hpx))
    }

    const html = generatePrintHTML(items, labelSize, showPrice, showName, isNl, dataUrls)

    // Write to hidden iframe and trigger print
    const frame = printFrameRef.current
    if (!frame) return
    const doc = frame.contentDocument ?? frame.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    setTimeout(() => frame.contentWindow?.print(), 400)
  }

  const totalLabels = Array.from(selection.values()).reduce((s, i) => s + i.qty, 0)

  const T = {
    title:         isNl ? 'Streepjescode- en etiketten afdrukken' : 'Barcode & Label Printing',
    search:        isNl ? 'Zoek product…' : 'Search product…',
    product:       isNl ? 'Product' : 'Product',
    price:         isNl ? 'Prijs' : 'Price',
    qty:           isNl ? 'Aantal' : 'Quantity',
    selectAll:     isNl ? 'Alles selecteren' : 'Select all',
    clearAll:      isNl ? 'Deselecteren' : 'Clear all',
    settings:      isNl ? 'Etikettinstellingen' : 'Label settings',
    barcodeType:   isNl ? 'Type streepjescode' : 'Barcode type',
    size:          isNl ? 'Etiketgrootte' : 'Label size',
    showPrice:     isNl ? 'Prijs tonen' : 'Show price',
    showName:      isNl ? 'Naam tonen' : 'Show name',
    print:         isNl ? 'Afdrukken' : 'Print',
    selected:      isNl ? 'geselecteerd' : 'selected',
    labels:        isNl ? 'etiketten' : 'labels',
    noProducts:    isNl ? 'Geen producten gevonden' : 'No products found',
    loading:       isNl ? 'Laden…' : 'Loading…',
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f2f5fb' }}>
      {/* Hidden print iframe */}
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-labels" />

      {/* Left: product selector */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', flexShrink: 0, background: '#fff', borderBottom: '1px solid #e6ecf5' }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#16203a', marginBottom: 12 }}>{T.title}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={T.search}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 8,
                border: '1px solid #d9e1f1', fontSize: 13, outline: 'none', background: '#fafafa',
              }}
            />
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title={isNl ? 'Vernieuwen' : 'Refresh'}
              style={{
                ...btnStyle('#fff', '#7e88a0', '#d9e1f1'),
                display: 'inline-flex', alignItems: 'center', gap: 5,
                opacity: isFetching ? 0.5 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: isFetching ? 'spin-bl 0.8s linear infinite' : 'none' }}>
                <style>{`@keyframes spin-bl { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isNl ? 'Vernieuwen' : 'Refresh'}
            </button>
            <button onClick={selectAll} style={btnStyle('#f0eeff', '#293371')}>
              {T.selectAll}
            </button>
            <button onClick={clearAll} style={btnStyle('#fff', '#7e88a0', '#d9e1f1')}>
              {T.clearAll}
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 120px 80px',
          padding: '8px 16px', gap: 12,
          background: '#f9f9fc', borderBottom: '1px solid #e6ecf5',
          fontSize: 11, fontWeight: 700, color: '#7e88a0',
          textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0,
        }}>
          <div />
          <div>{T.product}</div>
          <div>{T.price}</div>
          <div>{T.qty}</div>
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#7e88a0' }}>{T.loading}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#7e88a0' }}>{T.noProducts}</div>
          ) : filtered.map(p => (
            <ProductRow
              key={p.id}
              product={p}
              selected={selection.has(p.id)}
              qty={selection.get(p.id)?.qty ?? 1}
              isNl={isNl}
              onToggle={() => toggleProduct(p)}
              onQtyChange={(q) => setQty(p.id, q)}
            />
          ))}
        </div>
      </div>

      {/* Right: settings + print */}
      <div style={{
        width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e6ecf5',
        display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 20,
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{T.settings}</h2>

        {/* Barcode type */}
        <div>
          <label style={labelStyle}>{T.barcodeType}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['EAN13', 'Code128', 'QR'] as BarcodeType[]).map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio" name="btype" value={t} checked={barcodeType === t}
                  onChange={() => setBarcodeType(t)}
                  style={{ accentColor: '#293371' }}
                />
                <span style={{ color: '#16203a', fontWeight: barcodeType === t ? 600 : 400 }}>{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Label size */}
        <div>
          <label style={labelStyle}>{T.size}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(Object.keys(LABEL_SIZES) as LabelSize[]).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio" name="lsize" value={s} checked={labelSize === s}
                  onChange={() => setLabelSize(s)}
                  style={{ accentColor: '#293371' }}
                />
                <span style={{ color: '#16203a', fontWeight: labelSize === s ? 600 : 400 }}>
                  {LABEL_SIZES[s].label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox" checked={showName} onChange={e => setShowName(e.target.checked)}
              style={{ accentColor: '#293371', width: 16, height: 16 }}
            />
            <span style={{ color: '#16203a', fontWeight: 500 }}>{T.showName}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)}
              style={{ accentColor: '#293371', width: 16, height: 16 }}
            />
            <span style={{ color: '#16203a', fontWeight: 500 }}>{T.showPrice}</span>
          </label>
        </div>

        <div style={{ flex: 1 }} />

        {/* Selection summary */}
        {selection.size > 0 && (
          <div style={{ background: 'rgba(41,51,113,0.08)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#293371' }}>{totalLabels}</p>
            <p style={{ fontSize: 12, color: '#5f6a84', marginTop: 2 }}>
              {T.labels} · {selection.size} {T.selected}
            </p>
          </div>
        )}

        {/* Print button */}
        <button
          onClick={handlePrint}
          disabled={selection.size === 0}
          style={{
            padding: '14px',
            borderRadius: 12,
            border: 'none',
            cursor: selection.size === 0 ? 'not-allowed' : 'pointer',
            background: selection.size === 0
              ? '#d9e1f1'
              : 'linear-gradient(135deg, #293371, #1f2a63)',
            color: selection.size === 0 ? '#7e88a0' : '#fff',
            fontSize: 15,
            fontWeight: 700,
            boxShadow: selection.size === 0 ? 'none' : '0 4px 14px rgba(41,51,113,0.4)',
            transition: 'all 0.15s',
          }}
        >
          🖨 {T.print}
          {totalLabels > 0 ? ` (${totalLabels})` : ''}
        </button>
      </div>
    </div>
  )
}

function btnStyle(bg: string, color: string, border?: string) {
  return {
    padding: '8px 14px', borderRadius: 8,
    border: `1px solid ${border ?? bg}`,
    background: bg, color, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#5f6a84',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 8,
}
