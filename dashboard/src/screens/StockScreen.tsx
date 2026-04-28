import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getStockMovements, adjustStock, getLowStockProducts, type LowStockProduct } from '@/api/stock'
import apiClient from '@/api/client'

interface Product {
  id: string
  name_nl: string
  name_en: string
  barcode: string | null
  stock_qty: string
  low_stock_threshold: string
  category?: { name_nl: string; name_en: string } | null
}

// ─── Stock Adjust Modal ────────────────────────────────────────────────────────
function AdjustModal({ product, isNl, onClose }: { product: Product | LowStockProduct; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState<'adjustment' | 'import' | 'initial'>('adjustment')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => adjustStock(product.id, {
      qty_change: parseFloat(qtyChange),
      reason,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalogue'] })
      qc.invalidateQueries({ queryKey: ['low-stock'] })
      qc.invalidateQueries({ queryKey: ['stock-history', product.id] })
      onClose()
    },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  const newQty = qtyChange ? (parseFloat(product.stock_qty) + parseFloat(qtyChange)).toFixed(3) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
          {isNl ? 'Voorraad aanpassen' : 'Adjust stock'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
          {isNl ? product.name_nl : product.name_en} — {isNl ? 'Huidige voorraad:' : 'Current stock:'} <strong>{parseFloat(product.stock_qty).toFixed(0)}</strong>
        </p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>
          {isNl ? 'Aanpassing (+ ontvangen, − afschrijven)' : 'Adjustment (+ receive, − write-off)'}
        </label>
        <input
          type="number"
          value={qtyChange}
          onChange={e => setQtyChange(e.target.value)}
          placeholder="+100 of -5"
          style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 700, marginBottom: 14 }}
        />

        {newQty !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: parseFloat(newQty) < 0 ? '#fef2f2' : '#f0fdf4', marginBottom: 14, fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>{isNl ? 'Nieuwe voorraad:' : 'New stock:'}</span>
            <span style={{ fontWeight: 800, color: parseFloat(newQty) < 0 ? '#dc2626' : '#16a34a', fontSize: 16 }}>{newQty}</span>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>
          {isNl ? 'Reden' : 'Reason'}
        </label>
        <select value={reason} onChange={e => setReason(e.target.value as 'adjustment' | 'import' | 'initial')}
          style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 14 }}>
          <option value="adjustment">{isNl ? 'Correctie' : 'Correction / write-off'}</option>
          <option value="import">{isNl ? 'Levering ontvangen' : 'Stock received'}</option>
          <option value="initial">{isNl ? 'Beginsaldo' : 'Opening stock'}</option>
        </select>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>
          {isNl ? 'Notitie (optioneel)' : 'Notes (optional)'}
        </label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={isNl ? 'Bijv. factuur 2026-04-28' : 'e.g. invoice 2026-04-28'}
          style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 16 }} />

        {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={!qtyChange || isNaN(parseFloat(qtyChange)) || parseFloat(qtyChange) === 0 || mut.isPending}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !qtyChange ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Movement history panel ────────────────────────────────────────────────────
function MovementHistory({ product, isNl, onClose }: { product: Product; isNl: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-history', product.id],
    queryFn: () => getStockMovements(product.id, { per_page: 50 }),
  })

  const reasonLabel = (r: string) => ({
    sale: isNl ? 'Verkoop' : 'Sale',
    void: isNl ? 'Geannuleerd' : 'Void',
    refund: isNl ? 'Terugboeking' : 'Refund',
    adjustment: isNl ? 'Correctie' : 'Adjustment',
    import: isNl ? 'Levering' : 'Received',
    initial: isNl ? 'Beginsaldo' : 'Opening',
  }[r] ?? r)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1c1c2e' }}>
            {isNl ? 'Voorraadhistorie' : 'Stock history'} — {isNl ? product.name_nl : product.name_en}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9090a0' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#9090a0' }}>{isNl ? 'Laden…' : 'Loading…'}</p>
          ) : (data?.data ?? []).length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#9090a0' }}>{isNl ? 'Geen bewegingen gevonden.' : 'No movements found.'}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f7ff' }}>
                  {[isNl ? 'Datum' : 'Date', isNl ? 'Reden' : 'Reason', isNl ? 'Wijziging' : 'Change', isNl ? 'Voorraad' : 'Stock', isNl ? 'Door' : 'By'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f3f8' }}>
                    <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{reasonLabel(m.reason)}</span>
                      {m.notes && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9090a0' }}>{m.notes}</p>}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: m.qty_change > 0 ? '#16a34a' : '#dc2626' }}>
                      {m.qty_change > 0 ? '+' : ''}{m.qty_change.toFixed(0)}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>{m.qty_after.toFixed(0)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#9090a0' }}>{m.user?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function StockScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [activeTab, setActiveTab] = useState<'all' | 'low'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['catalogue', search, page],
    queryFn: () => apiClient.get('/products', { params: { search: search || undefined, per_page: 30, page, active_only: false } })
      .then(r => r.data as { data: Product[]; current_page: number; last_page: number; total: number }),
    placeholderData: (prev) => prev,
    enabled: activeTab === 'all',
  })

  const { data: lowStockData = [], isLoading: lowLoading } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => getLowStockProducts(),
    enabled: activeTab === 'low',
  })

  const products = activeTab === 'all' ? (allData?.data ?? []) : (lowStockData as Product[])
  const lastPage = activeTab === 'all' ? (allData?.last_page ?? 1) : 1
  const isLoading = activeTab === 'all' ? allLoading : lowLoading

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Voorraadbeheer' : 'Stock Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Voorraad aanpassen, leveringen ontvangen, bewegingshistorie bekijken.' : 'Adjust stock, receive deliveries, view movement history.'}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e9e9ef' }}>
        {([
          { key: 'all', nl: 'Alle producten', en: 'All products' },
          { key: 'low', nl: `Lage voorraad${lowStockData.length > 0 ? ` (${lowStockData.length})` : ''}`, en: `Low stock${lowStockData.length > 0 ? ` (${lowStockData.length})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === t.key ? 700 : 500,
              color: activeTab === t.key ? (t.key === 'low' ? '#dc2626' : '#7c3aed') : '#6b7280',
              borderBottom: activeTab === t.key ? `2px solid ${t.key === 'low' ? '#dc2626' : '#7c3aed'}` : '2px solid transparent',
              marginBottom: -2,
            }}>
            {isNl ? t.nl : t.en}
          </button>
        ))}
      </div>

      {/* Low stock alert banner */}
      {activeTab === 'low' && lowStockData.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
            {isNl ? `${lowStockData.length} product(en) onder de minimumdrempel` : `${lowStockData.length} product(s) below minimum threshold`}
          </span>
        </div>
      )}

      {/* Search (all tab only) */}
      {activeTab === 'all' && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={isNl ? 'Zoek op naam of streepjescode…' : 'Search by name or barcode…'}
            style={{ width: '100%', maxWidth: 380, height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
              {[isNl ? 'Product' : 'Product', isNl ? 'Categorie' : 'Category', isNl ? 'Voorraad' : 'Stock', isNl ? 'Min. drempel' : 'Min. threshold', ''].map((h, i) => (
                <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f3f8' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 13, borderRadius: 6, background: '#f0f0f8', width: j === 0 ? 160 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
                  {activeTab === 'low'
                    ? (isNl ? 'Geen producten onder de minimumdrempel' : 'No products below minimum threshold')
                    : (isNl ? 'Geen producten gevonden' : 'No products found')}
                </p>
              </td></tr>
            ) : products.map((p, i) => {
              const isLow = parseFloat(p.low_stock_threshold) > 0 && parseFloat(p.stock_qty) <= parseFloat(p.low_stock_threshold)
              return (
                <tr key={p.id}
                  style={{ borderBottom: i < products.length - 1 ? '1px solid #f3f3f8' : 'none', background: isLow ? 'rgba(220,38,38,.02)' : undefined }}
                  onMouseEnter={e => (e.currentTarget.style.background = isLow ? 'rgba(220,38,38,.04)' : 'rgba(124,58,237,.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isLow ? 'rgba(220,38,38,.02)' : '')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{isNl ? p.name_nl : p.name_en}</p>
                    {p.barcode && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9090a0', fontFamily: 'monospace' }}>{p.barcode}</p>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    {p.category ? (isNl ? p.category.name_nl : p.category.name_en) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 15, fontWeight: 800,
                      color: isLow ? '#dc2626' : parseFloat(p.stock_qty) === 0 ? '#9090a0' : '#16a34a',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {isLow && <span style={{ fontSize: 14 }}>⚠️</span>}
                      {parseFloat(p.stock_qty).toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    {parseFloat(p.low_stock_threshold) > 0 ? parseFloat(p.low_stock_threshold).toFixed(0) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setAdjustProduct(p)}
                        style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isNl ? '+ Aanpassen' : '+ Adjust'}
                      </button>
                      <button
                        onClick={() => setHistoryProduct(p)}
                        style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', fontSize: 12, cursor: 'pointer', color: '#374151' }}
                      >
                        {isNl ? 'Historie' : 'History'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {activeTab === 'all' && lastPage > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid #f3f3f8', background: '#fafafa' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>‹</button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{page} / {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
              style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === lastPage ? 'not-allowed' : 'pointer', opacity: page === lastPage ? 0.4 : 1, fontSize: 13 }}>›</button>
          </div>
        )}
      </div>

      {adjustProduct && <AdjustModal product={adjustProduct} isNl={isNl} onClose={() => setAdjustProduct(null)} />}
      {historyProduct && <MovementHistory product={historyProduct} isNl={isNl} onClose={() => setHistoryProduct(null)} />}
    </div>
  )
}
