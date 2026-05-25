import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { importProducts, exportProducts, downloadImportTemplate, type ImportResult } from '@/api/catalogue'

// ─── CSV preview parser (client-side, no upload yet) ──────────────────────────
interface PreviewRow {
  name_nl: string
  name_en: string
  barcode: string
  price: string
  btw_rate: string
  btw_exempt: string
  category_name_nl: string
  stock_qty: string
  low_stock_threshold: string
  is_active: string
  _rowNum: number
  _valid: boolean
  _errors: string[]
}

const REQUIRED_HEADERS = ['name_nl']
const KNOWN_HEADERS = [
  'name_nl', 'name_en', 'barcode', 'price', 'btw_rate',
  'btw_exempt', 'category_name_nl', 'stock_qty', 'low_stock_threshold', 'is_active',
]

function parsePreview(text: string): { headers: string[]; rows: PreviewRow[]; headerErrors: string[] } {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [], headerErrors: ['File is empty'] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').trim())
  const headerErrors: string[] = []
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) headerErrors.push(`Missing required column: "${req}"`)
  }

  const rows: PreviewRow[] = lines.slice(1).map((line, idx) => {
    // Simple CSV split (handles quoted commas)
    const cols = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(',')
    const cleaned = cols.map(c => c.replace(/^"|"$/g, '').trim())
    const padded = [...cleaned, ...Array(Math.max(0, headers.length - cleaned.length)).fill('')]
    const data: Record<string, string> = {}
    headers.forEach((h, i) => { data[h] = padded[i] ?? '' })

    const errors: string[] = []
    if (!data.name_nl) errors.push('name_nl is required')
    const price = parseFloat(data.price ?? '')
    if (data.price && (isNaN(price) || price < 0)) errors.push(`Invalid price: "${data.price}"`)
    const btw = parseFloat(data.btw_rate ?? '')
    if (data.btw_rate && (isNaN(btw) || btw < 0 || btw > 100)) errors.push(`Invalid btw_rate: "${data.btw_rate}"`)

    return {
      name_nl:             data.name_nl ?? '',
      name_en:             data.name_en ?? '',
      barcode:             data.barcode ?? '',
      price:               data.price ?? '',
      btw_rate:            data.btw_rate ?? '',
      btw_exempt:          data.btw_exempt ?? '',
      category_name_nl:    data.category_name_nl ?? '',
      stock_qty:           data.stock_qty ?? '',
      low_stock_threshold: data.low_stock_threshold ?? '',
      is_active:           data.is_active ?? '',
      _rowNum:             idx + 2,
      _valid:              errors.length === 0,
      _errors:             errors,
    }
  })

  return { headers, rows, headerErrors }
}

// ─── Column label helper ───────────────────────────────────────────────────────
const COL_LABELS: Record<string, { nl: string; en: string; required?: boolean }> = {
  name_nl:             { nl: 'Naam NL *',        en: 'Name NL *',      required: true },
  name_en:             { nl: 'Naam EN',           en: 'Name EN' },
  barcode:             { nl: 'Barcode',           en: 'Barcode' },
  price:               { nl: 'Prijs (SRD)',       en: 'Price (SRD)' },
  btw_rate:            { nl: 'BTW % (0-100)',     en: 'BTW % (0-100)' },
  btw_exempt:          { nl: 'BTW-vrij (0/1)',    en: 'BTW exempt (0/1)' },
  category_name_nl:    { nl: 'Categorie',         en: 'Category' },
  stock_qty:           { nl: 'Voorraad',          en: 'Stock qty' },
  low_stock_threshold: { nl: 'Min. voorraad',     en: 'Low stock alert' },
  is_active:           { nl: 'Actief (0/1)',      en: 'Active (0/1)' },
}

export default function CatalogueImportExportScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragOver, setDragOver]     = useState(false)
  const [file, setFile]             = useState<File | null>(null)
  const [preview, setPreview]       = useState<{ headers: string[]; rows: PreviewRow[]; headerErrors: string[] } | null>(null)
  const [importing, setImporting]   = useState(false)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [exporting, setExporting]   = useState(false)
  const [downloading, setDownloading] = useState(false)

  const loadFile = useCallback((f: File) => {
    setFile(f)
    setResult(null)
    setImportError('')

    // XLSX / XLS are binary — can't preview client-side without an extra parser.
    // Server validates and returns full result on upload, so just clear preview.
    const ext = f.name.toLowerCase().split('.').pop() ?? ''
    if (ext === 'xlsx' || ext === 'xls') {
      setPreview(null)
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setPreview(parsePreview(text))
    }
    reader.readAsText(f, 'UTF-8')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) loadFile(f)
  }, [loadFile])

  const validRows  = preview?.rows.filter(r => r._valid).length ?? 0
  const errorRows  = preview?.rows.filter(r => !r._valid).length ?? 0
  const canImport  = !!file && !!preview && (preview.headerErrors.length === 0) && validRows > 0

  async function handleImport() {
    if (!file) return
    setImporting(true)
    setImportError('')
    try {
      const res = await importProducts(file)
      setResult(res)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setFile(null)
      setPreview(null)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Import failed'
      setImportError(msg)
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try { await exportProducts() } finally { setExporting(false) }
  }

  async function handleTemplate() {
    setDownloading(true)
    try { await downloadImportTemplate() } finally { setDownloading(false) }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Catalogus importeren / exporteren' : 'Import / Export Catalogue'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'Importeer producten vanuit een CSV- of Excel-bestand (.csv, .xlsx, .xls) of exporteer uw huidige catalogus.'
            : 'Import products from a CSV or Excel file (.csv, .xlsx, .xls) or export your current catalogue.'}
        </p>
      </div>

      {/* Top action strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            height: 42, padding: '0 20px', borderRadius: 10, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8, opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting
            ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'spin .8s linear infinite', display: 'inline-block' }} />
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
          {isNl ? 'Catalogus exporteren (.csv)' : 'Export catalogue (.csv)'}
        </button>

        <button
          onClick={handleTemplate}
          disabled={downloading}
          style={{
            height: 42, padding: '0 20px', borderRadius: 10, border: '1.5px solid #e5e7eb',
            background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8, cursor: downloading ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          {isNl ? 'Importsjabloon downloaden' : 'Download import template'}
        </button>
      </div>

      {/* Column reference card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f3f8', fontWeight: 800, fontSize: 13, color: '#1c1c2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{isNl ? 'CSV-kolomreferentie' : 'CSV column reference'}</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: '#9090a0' }}>{isNl ? '* = verplicht' : '* = required'}</span>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {KNOWN_HEADERS.map(h => (
            <div key={h} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: COL_LABELS[h]?.required ? '#f5f0ff' : '#f9f9f9',
              border: `1px solid ${COL_LABELS[h]?.required ? '#c4b5fd' : '#e5e7eb'}`,
              color: COL_LABELS[h]?.required ? '#7c3aed' : '#374151',
            }}>
              <code style={{ fontFamily: 'monospace', fontSize: 11 }}>{h}</code>
              <span style={{ marginLeft: 6, color: '#6b7280', fontWeight: 400 }}>
                {isNl ? COL_LABELS[h]?.nl : COL_LABELS[h]?.en}
              </span>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid #f3f3f8', background: '#fafafa' }}>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            {isNl
              ? '• Barcode mag leeg zijn (product wordt dan altijd aangemaakt). Als barcode aanwezig is, werkt import als upsert (bijwerken of aanmaken). • Categorie wordt automatisch aangemaakt als de naam niet bestaat. • btw_exempt: 1 = vrijgesteld, 0 = belast.'
              : '• Barcode may be empty (product always created). If barcode is present, import acts as upsert (update or create). • Category is auto-created if the name does not exist. • btw_exempt: 1 = exempt, 0 = taxed.'}
          </p>
        </div>
      </div>

      {/* Import success result */}
      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24 }}>✅</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#15803d', margin: '0 0 4px' }}>
              {isNl ? 'Import voltooid!' : 'Import complete!'}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#166534' }}>
                <strong>{result.created}</strong> {isNl ? 'aangemaakt' : 'created'}
              </span>
              <span style={{ fontSize: 13, color: '#166534' }}>
                <strong>{result.updated}</strong> {isNl ? 'bijgewerkt' : 'updated'}
              </span>
              {result.skipped > 0 && (
                <span style={{ fontSize: 13, color: '#92400e' }}>
                  <strong>{result.skipped}</strong> {isNl ? 'overgeslagen' : 'skipped'}
                </span>
              )}
            </div>
          </div>
          {result.errors.length > 0 && (
            <details style={{ marginLeft: 'auto', cursor: 'pointer' }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                {result.errors.length} {isNl ? 'rij(en) met fouten' : 'row(s) with errors'}
              </summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: '#dc2626' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
          <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af' }}>✕</button>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#7c3aed' : file ? '#22c55e' : '#d1d5db'}`,
          borderRadius: 16, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? '#f5f0ff' : file ? '#f0fdf4' : '#fafafa',
          transition: 'all .15s', marginBottom: 20,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }}
        />
        {file ? (
          <div>
            <p style={{ fontSize: 32, marginBottom: 6 }}>📄</p>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#15803d', marginBottom: 2 }}>{file.name}</p>
            <p style={{ fontSize: 12, color: '#6b7280' }}>
              {(file.size / 1024).toFixed(1)} KB — {isNl ? 'klik om te vervangen' : 'click to replace'}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 40, marginBottom: 10 }}>📂</p>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#374151', marginBottom: 4 }}>
              {isNl ? 'Sleep een CSV of Excel-bestand hiernaartoe' : 'Drag a CSV or Excel file here'}
            </p>
            <p style={{ fontSize: 13, color: '#9090a0' }}>
              {isNl ? 'of klik om een bestand te kiezen — .csv, .xlsx of .xls' : 'or click to choose a file — .csv, .xlsx or .xls'}
            </p>
          </div>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', marginBottom: 20 }}>
          {/* Preview header */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f3f3f8', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: '#1c1c2e' }}>
              {isNl ? 'Voorbeeldweergave' : 'Preview'} — {preview.rows.length} {isNl ? 'rijen' : 'rows'}
            </span>
            {preview.headerErrors.length > 0 ? (
              <span style={{ fontSize: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', fontWeight: 600 }}>
                ⚠ {preview.headerErrors.join(' · ')}
              </span>
            ) : (
              <>
                <span style={{ fontSize: 12, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 10px', fontWeight: 600 }}>
                  ✓ {validRows} {isNl ? 'geldig' : 'valid'}
                </span>
                {errorRows > 0 && (
                  <span style={{ fontSize: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 10px', fontWeight: 600 }}>
                    ✗ {errorRows} {isNl ? 'met fouten' : 'with errors'}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8f7ff', zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6d6d80', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid #eeeef8' }}>#</th>
                  {['name_nl', 'name_en', 'barcode', 'price', 'btw_rate', 'btw_exempt', 'category_name_nl', 'stock_qty'].map(col => (
                    preview.headers.includes(col) && (
                      <th key={col} style={{ padding: '8px 12px', textAlign: 'left', color: '#6d6d80', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid #eeeef8' }}>
                        {isNl ? COL_LABELS[col]?.nl ?? col : COL_LABELS[col]?.en ?? col}
                      </th>
                    )
                  ))}
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid #eeeef8' }} />
                </tr>
              </thead>
              <tbody>
                {preview.rows.map(row => (
                  <tr
                    key={row._rowNum}
                    style={{ borderBottom: '1px solid #f3f3f8', background: row._valid ? '' : '#fff8f8' }}
                  >
                    <td style={{ padding: '7px 12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{row._rowNum}</td>
                    {preview.headers.includes('name_nl')          && <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1c1c2e' }}>{row.name_nl || <span style={{ color: '#f87171' }}>—</span>}</td>}
                    {preview.headers.includes('name_en')          && <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.name_en}</td>}
                    {preview.headers.includes('barcode')          && <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{row.barcode}</td>}
                    {preview.headers.includes('price')            && <td style={{ padding: '7px 12px', color: row.price ? '#1c1c2e' : '#9ca3af' }}>{row.price ? `SRD ${row.price}` : '—'}</td>}
                    {preview.headers.includes('btw_rate')         && <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.btw_rate ? `${row.btw_rate}%` : '—'}</td>}
                    {preview.headers.includes('btw_exempt')       && <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.btw_exempt === '1' ? '✓' : '—'}</td>}
                    {preview.headers.includes('category_name_nl') && <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.category_name_nl}</td>}
                    {preview.headers.includes('stock_qty')        && <td style={{ padding: '7px 12px', color: '#6b7280' }}>{row.stock_qty}</td>}
                    <td style={{ padding: '7px 12px' }}>
                      {!row._valid && (
                        <span title={row._errors.join(', ')} style={{ fontSize: 11, color: '#dc2626', cursor: 'default' }}>
                          ⚠ {row._errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <p style={{ fontSize: 13, color: '#dc2626', marginBottom: 12 }}>✗ {importError}</p>
      )}

      {/* Import button */}
      {file && preview && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={handleImport}
            disabled={!canImport || importing}
            style={{
              height: 44, padding: '0 28px', borderRadius: 10, border: 'none',
              background: canImport ? 'linear-gradient(135deg,#16a34a,#15803d)' : '#e5e7eb',
              color: canImport ? '#fff' : '#9ca3af', fontSize: 14, fontWeight: 700,
              cursor: canImport && !importing ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {importing
              ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', animation: 'spin .8s linear infinite', display: 'inline-block' }} />
              : '⬆'}
            {importing
              ? (isNl ? 'Importeren…' : 'Importing…')
              : (isNl ? `${validRows} rijen importeren` : `Import ${validRows} rows`)}
          </button>
          <button
            onClick={() => { setFile(null); setPreview(null); setImportError('') }}
            style={{ height: 44, padding: '0 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          {!canImport && preview.headerErrors.length === 0 && validRows === 0 && (
            <span style={{ fontSize: 13, color: '#dc2626' }}>
              {isNl ? 'Alle rijen hebben fouten — controleer het bestand' : 'All rows have errors — check the file'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
