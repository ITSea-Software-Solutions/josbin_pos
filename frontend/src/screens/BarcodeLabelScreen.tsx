/**
 * Barcode & Label Printing Screen
 *
 * Search products → select → configure qty → preview → print to label printer.
 * Supports EAN-13, Code 128, QR barcode symbologies.
 * Printing is platform-routed via printHtmlSheet: OS print dialog on
 * Electron/web, native PrintManager on Android (where window.print() is a
 * silent no-op). Sheet generation lives in lib/labelSheet.ts.
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { detectPlatform, listPrinters, printHtmlSheet } from '@/lib/hardware'
import {
  LABEL_SIZES, PX_PER_MM, barcodeDataUrl, generateLabelSheetHTML, labelCode,
  type BarcodeType, type LabelItem, type LabelSize,
} from '@/lib/labelSheet'
import apiClient from '@/api/client'

interface Product {
  id: string
  name_nl: string
  name_en: string
  barcode: string | null
  price: string
  btw_rate: string
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
      background: selected ? 'rgba(0,51,102,0.04)' : 'transparent',
      transition: 'background 0.1s',
    }}>
      <input
        type="checkbox" checked={selected} onChange={onToggle}
        style={{ width: 18, height: 18, accentColor: '#003366', cursor: 'pointer' }}
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
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const user = useAuthStore((s) => s.user)
  const storeId = useSettingsStore((s) => s.storeId)
  const platform = detectPlatform()

  const [search, setSearch]           = useState('')
  const [selection, setSelection]     = useState<Map<string, LabelItem>>(new Map())
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('EAN13')
  const [labelSize, setLabelSize]     = useState<LabelSize>('50x30')
  const [showPrice, setShowPrice]     = useState(true)
  const [showName, setShowName]       = useState(true)
  const [printError, setPrintError]   = useState<string | null>(null)

  // Only Electron can enumerate system printers (IPC to the main process);
  // browsers and the Android WebView have no API for it.
  const { data: printerCount } = useQuery<number>({
    queryKey: ['printers-detected'],
    queryFn: async () => (await listPrinters()).length,
    enabled: platform === 'electron',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

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
    setPrintError(null)

    // Generate all barcode images locally (no network) before building the HTML
    const { w, h } = LABEL_SIZES[labelSize]
    const wpx = Math.round(w * PX_PER_MM)
    const hpx = Math.round(h * PX_PER_MM)

    const dataUrls = new Map<string, string>()
    for (const { product } of items) {
      dataUrls.set(product.id, await barcodeDataUrl(labelCode(product), barcodeType, wpx, hpx))
    }

    const html = generateLabelSheetHTML(items, labelSize, showPrice, showName, isNl, dataUrls)
    const result = await printHtmlSheet('Josbin POS Labels', html)
    if (!result.success) {
      setPrintError(t('pos.labels.printFailed', { error: result.error ?? '' }))
    }
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
            <button onClick={selectAll} style={btnStyle('#f0eeff', '#003366')}>
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
                  style={{ accentColor: '#003366' }}
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
                  style={{ accentColor: '#003366' }}
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
              style={{ accentColor: '#003366', width: 16, height: 16 }}
            />
            <span style={{ color: '#16203a', fontWeight: 500 }}>{T.showName}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)}
              style={{ accentColor: '#003366', width: 16, height: 16 }}
            />
            <span style={{ color: '#16203a', fontWeight: 500 }}>{T.showPrice}</span>
          </label>
        </div>

        <div style={{ flex: 1 }} />

        {/* Selection summary */}
        {selection.size > 0 && (
          <div style={{ background: 'rgba(0,51,102,0.08)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#003366' }}>{totalLabels}</p>
            <p style={{ fontSize: 12, color: '#5f6a84', marginTop: 2 }}>
              {T.labels} · {selection.size} {T.selected}
            </p>
          </div>
        )}

        {/* Printer presence: Electron enumerates system printers; browser and
            Android WebView cannot, so those get one static guidance line. */}
        {(platform !== 'electron' || printerCount !== undefined) && (
          <p style={{
            fontSize: 11, lineHeight: 1.5,
            color: platform === 'electron' && printerCount === 0 ? '#b45309' : '#7e88a0',
          }}>
            {platform === 'electron'
              ? (printerCount ?? 0) > 0
                ? `🖨 ${t('pos.labels.printersDetected', { n: printerCount })}`
                : `⚠ ${t('pos.labels.noPrintersFound')}`
              : t('pos.labels.printerHint')}
          </p>
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
              : 'linear-gradient(135deg, #003366, #1f2a63)',
            color: selection.size === 0 ? '#7e88a0' : '#fff',
            fontSize: 15,
            fontWeight: 700,
            boxShadow: selection.size === 0 ? 'none' : '0 4px 14px rgba(0,51,102,0.4)',
            transition: 'all 0.15s',
          }}
        >
          🖨 {T.print}
          {totalLabels > 0 ? ` (${totalLabels})` : ''}
        </button>

        {printError && (
          <p style={{ fontSize: 11, lineHeight: 1.5, color: '#b91c1c' }}>{printError}</p>
        )}
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
