import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import { getStockMovements, adjustStock, getLowStockProducts, type LowStockProduct } from '@/api/stock'
import { getStores } from '@/api/stores'
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

/**
 * Stock is stored as decimal(10,3) but is almost always whole units in
 * Surinamese retail (one egg, one can of milk). Trim trailing zeros so the
 * UI shows "12" rather than "12.000" — keeps the table dense and readable.
 */
function formatStockQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  const rounded = Math.round(qty * 1000) / 1000
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString().replace(/0+$/, '').replace(/\.$/, '')
}

// ─── Stock Adjust Modal ────────────────────────────────────────────────────────
function AdjustModal({ product, isNl, onClose }: { product: Product | LowStockProduct; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState<'adjustment' | 'import' | 'initial'>('adjustment')
  const [notes, setNotes] = useState('')
  const [storeId, setStoreId] = useState('')
  const [error, setError] = useState('')

  // Stock is per-store (product_stocks pivot). Backend requires store_id on
  // every adjust — pre-this-fix the modal omitted it and 422'd. Auto-select
  // when the user has just one accessible store (SM-with-one-store + small
  // single-shop OAs); otherwise show a dropdown.
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores'],
    queryFn:  () => getStores(),
  })

  // Auto-select the moment stores load and we haven't picked yet.
  if (!storeId && stores.length === 1) {
    setStoreId(stores[0].id)
  }

  const mut = useMutation({
    mutationFn: () => adjustStock(product.id, {
      qty_change: parseFloat(qtyChange),
      reason,
      notes: notes || undefined,
      store_id: storeId,
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
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#16203a' }}>
          {isNl ? 'Voorraad aanpassen' : 'Adjust stock'}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
          {isNl ? product.name_nl : product.name_en} — {isNl ? 'Huidige voorraad:' : 'Current stock:'} <strong>{parseFloat(product.stock_qty).toFixed(0)}</strong>
        </p>

        {/* Store picker — stock is per-store (product_stocks). Auto-hidden
            when only one accessible store; required when multiple. */}
        {stores.length > 1 && (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>
              {isNl ? 'Vestiging' : 'Store'} *
            </label>
            <select
              value={storeId}
              onChange={e => setStoreId(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, marginBottom: 14, background: '#fff' }}
            >
              <option value="">{isNl ? '— Kies vestiging —' : '— Pick store —'}</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
            </select>
          </>
        )}
        {stores.length === 1 && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, padding: '6px 10px', background: '#f9fafb', borderRadius: 6 }}>
            {isNl ? 'Vestiging:' : 'Store:'} <strong>{stores[0].name}</strong>
          </div>
        )}
        {!storesLoading && stores.length === 0 && (
          <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12, padding: '6px 10px', background: '#fef2f2', borderRadius: 6 }}>
            {isNl ? 'Geen toegankelijke vestiging — vraag uw OA om u toe te wijzen.' : 'No store assigned — ask your OA to assign one.'}
          </div>
        )}

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
            disabled={!qtyChange || isNaN(parseFloat(qtyChange)) || parseFloat(qtyChange) === 0 || !storeId || mut.isPending}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#003366', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !qtyChange ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Movement history panel ────────────────────────────────────────────────────
function MovementHistory({ product, isNl, onClose }: { product: Product; isNl: boolean; onClose: () => void }) {
  // Movements grow forever — page through them instead of showing only the
  // latest 50 as if that were everything.
  const [histPage, setHistPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['stock-history', product.id, histPage],
    queryFn: () => getStockMovements(product.id, { per_page: 50, page: histPage }),
    placeholderData: (prev) => prev,
  })
  const histLastPage = data?.last_page ?? 1

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
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#16203a' }}>
            {isNl ? 'Voorraadhistorie' : 'Stock history'} — {isNl ? product.name_nl : product.name_en}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#7e88a0' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#7e88a0' }}>{isNl ? 'Laden…' : 'Loading…'}</p>
          ) : (data?.data ?? []).length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#7e88a0' }}>{isNl ? 'Geen bewegingen gevonden.' : 'No movements found.'}</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f4f6fc' }}>
                  {[isNl ? 'Datum' : 'Date', isNl ? 'Reden' : 'Reason', isNl ? 'Wijziging' : 'Change', isNl ? 'Voorraad' : 'Stock', isNl ? 'Door' : 'By'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f4fb' }}>
                    <td style={{ padding: '9px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' })}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{reasonLabel(m.reason)}</span>
                      {m.notes && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7e88a0' }}>{m.notes}</p>}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: m.qty_change > 0 ? '#16a34a' : '#dc2626' }}>
                      {m.qty_change > 0 ? '+' : ''}{m.qty_change.toFixed(0)}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#374151' }}>{m.qty_after.toFixed(0)}</td>
                    <td style={{ padding: '9px 12px', fontSize: 12, color: '#7e88a0' }}>{m.user?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pager — small prev/next, only when the history spans pages */}
        {histLastPage > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f4fb', marginTop: 8 }}>
            <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}
              style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: histPage === 1 ? 'not-allowed' : 'pointer', opacity: histPage === 1 ? 0.4 : 1, fontSize: 13 }}>‹</button>
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>
              {histPage} / {histLastPage} · {data?.total ?? 0} {isNl ? 'bewegingen' : 'movements'}
            </span>
            <button onClick={() => setHistPage(p => Math.min(histLastPage, p + 1))} disabled={histPage === histLastPage}
              style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: histPage === histLastPage ? 'not-allowed' : 'pointer', opacity: histPage === histLastPage ? 0.4 : 1, fontSize: 13 }}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
interface StockScreenProps {
  /** Optional initial tab. Used when the overview deep-links via the "Stock alerts" tile. */
  initialActiveTab?: 'all' | 'low'
}

export default function StockScreen({ initialActiveTab = 'all' }: StockScreenProps = {}) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [activeTab, setActiveTab] = useState<'all' | 'low'>(initialActiveTab)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null)

  // Store filter — controls which store's stock + low-stock list we show.
  // Empty = org-wide aggregate (default). Auto-selects when only one store
  // is accessible (SM with one store + single-shop OAs).
  const [filterStoreId, setFilterStoreId] = useState('')
  const { data: stores = [] } = useQuery({ queryKey: ['stores'], queryFn: () => getStores() })
  if (!filterStoreId && stores.length === 1) {
    setFilterStoreId(stores[0].id)
  }

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['catalogue', search, page, filterStoreId],
    queryFn: () => apiClient.get('/products', {
      params: {
        search: search || undefined,
        per_page: 30, page, active_only: false,
        ...(filterStoreId ? { store_id: filterStoreId } : {}),
      },
    }).then(r => r.data as { data: Product[]; current_page: number; last_page: number; total: number }),
    placeholderData: (prev) => prev,
    enabled: activeTab === 'all',
  })

  const { data: lowStockPage, isLoading: lowLoading } = useQuery({
    queryKey: ['low-stock', filterStoreId],
    queryFn: () => getLowStockProducts(filterStoreId ? { store_id: filterStoreId } : undefined),
    // Always fetch — we need the count for the alert banner shown on the
    // "all" tab too. The payload is small (capped at 50 by default).
    enabled: true,
  })
  const lowStockData = lowStockPage?.data ?? []

  const products = activeTab === 'all' ? (allData?.data ?? []) : (lowStockData as Product[])
  const lastPage = activeTab === 'all' ? (allData?.last_page ?? 1) : 1
  const isLoading = activeTab === 'all' ? allLoading : lowLoading

  // Column sort (shared hook → identical behaviour across all dashboard tables).
  const { sorted, sort, toggle, indicator } = useTableSort(products, {
    name:      (p) => ((isNl ? p.name_nl : p.name_en) ?? '').toLowerCase(),
    category:  (p) => (p.category ? (isNl ? p.category.name_nl : p.category.name_en) : '').toLowerCase(),
    stock:     (p) => parseFloat(p.stock_qty) || 0,
    threshold: (p) => parseFloat(p.low_stock_threshold) || 0,
  })

  // Split low-stock list into "out" vs "low but in stock" for the banner copy.
  const outCount = (lowStockData as LowStockProduct[]).filter(p => parseFloat(p.stock_qty) <= 0).length
  const lowCount = lowStockData.length - outCount
  // Whole-result-set count from the paginator — the fetched page caps at 50.
  const lowTotal = lowStockPage?.total ?? lowStockData.length

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Voorraadbeheer' : 'Stock Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? 'Voorraad aanpassen, leveringen ontvangen, bewegingshistorie bekijken.' : 'Adjust stock, receive deliveries, view movement history.'}
        </p>
      </div>

      {/* Top alert banner — yellow callout when any product is low/out of stock.
         Stays visible on both tabs so it works as a global "you have stock
         work to do" reminder. The button switches the tab to the focused
         low-stock view (equivalent to ?lowOnly=1 in a router-based world). */}
      {lowStockData.length > 0 && activeTab !== 'low' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px', borderRadius: 12,
          background: '#fffbeb', border: '1px solid #fde68a',
          marginBottom: 20,
        }}>
          <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>⚠️</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#92400e' }}>
            {t(lowTotal === 1 ? 'stock.alerts.bannerOne' : 'stock.alerts.bannerMany',
              { count: lowTotal })}
            {outCount > 0 && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
                ({outCount} {t('stock.alerts.outBadge')})
              </span>
            )}
          </span>
          <button
            onClick={() => setActiveTab('low')}
            style={{
              height: 32, padding: '0 14px', borderRadius: 8, border: 'none',
              background: '#d97706', color: '#fff', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t('stock.alerts.reviewNow')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e6ecf5' }}>
        {([
          { key: 'all', nl: 'Alle producten', en: 'All products' },
          { key: 'low', nl: `Lage voorraad${(lowStockPage?.total ?? 0) > 0 ? ` (${lowStockPage?.total})` : ''}`, en: `Low stock${(lowStockPage?.total ?? 0) > 0 ? ` (${lowStockPage?.total})` : ''}` },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? (tab.key === 'low' ? '#dc2626' : '#003366') : '#6b7280',
              borderBottom: activeTab === tab.key ? `2px solid ${tab.key === 'low' ? '#dc2626' : '#003366'}` : '2px solid transparent',
              marginBottom: -2,
            }}>
            {isNl ? tab.nl : tab.en}
          </button>
        ))}
      </div>

      {/* Focused low-stock banner — kept distinct from the global yellow one
         so the colour intensity matches "you're already on the alert tab". */}
      {activeTab === 'low' && lowStockData.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
            {isNl
              ? `${lowCount} laag · ${outCount} op voorraad`
              : `${lowCount} low · ${outCount} out of stock`}
          </span>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              marginLeft: 'auto', height: 28, padding: '0 12px', borderRadius: 6, border: '1px solid #fecaca',
              background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('stock.alerts.showAll')}
          </button>
        </div>
      )}

      {/* The low-stock list is capped at one page of 50 — say so when there
          is more, instead of presenting the page as the whole list. */}
      {activeTab === 'low' && (lowStockPage?.last_page ?? 1) > 1 && (
        <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 14px' }}>
          {isNl
            ? `Toont eerste 50 van ${lowStockPage?.total} producten — verfijn op vestiging`
            : `Showing first 50 of ${lowStockPage?.total} products — refine by store`}
        </p>
      )}

      {/* Store filter + search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {stores.length > 1 && (
          <select
            value={filterStoreId}
            onChange={(e) => { setFilterStoreId(e.target.value); setPage(1) }}
            style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, background: '#fff', minWidth: 200 }}
            title={isNl ? 'Voorraad filteren op vestiging' : 'Filter stock by store'}
          >
            <option value="">{isNl ? 'Alle vestigingen (totaal)' : 'All stores (org-wide)'}</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.city}</option>)}
          </select>
        )}
        {activeTab === 'all' && (
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={isNl ? 'Zoek op naam of streepjescode…' : 'Search by name or barcode…'}
            style={{ flex: 1, maxWidth: 380, height: 38, padding: '0 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
          />
        )}
        {filterStoreId && stores.length > 1 && (
          <span style={{ fontSize: 12, color: '#003366', fontWeight: 600 }}>
            ↳ {isNl ? 'voorraad per vestiging' : 'per-store stock'}
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
              {[
                { key: 'name',      label: isNl ? 'Product' : 'Product' },
                { key: 'category',  label: isNl ? 'Categorie' : 'Category' },
                { key: 'stock',     label: isNl ? 'Voorraad' : 'Stock' },
                { key: 'threshold', label: isNl ? 'Min. drempel' : 'Min. threshold' },
              ].map((h) => (
                <th key={h.key} onClick={() => toggle(h.key)}
                  style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', cursor: 'pointer', userSelect: 'none' }}>
                  {h.label}
                  <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#003366' : '#c0c0cc' }}>{indicator(h.key)}</span>
                </th>
              ))}
              <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f4fb' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 13, borderRadius: 6, background: '#eef2fb', width: j === 0 ? 160 : 80 }} />
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
            ) : sorted.map((p, i) => {
              const qty = parseFloat(p.stock_qty)
              const threshold = parseFloat(p.low_stock_threshold)
              // "out" wins over "low" — never paint a zero-stock row yellow.
              const isOut = qty <= 0
              const isLow = !isOut && threshold > 0 && qty <= threshold

              // Pastel backgrounds — strong enough to scan a busy table,
              // weak enough not to drown out the row text.
              const baseBg = isOut ? 'rgba(220,38,38,.06)' : isLow ? 'rgba(245,158,11,.08)' : undefined
              const hoverBg = isOut ? 'rgba(220,38,38,.10)' : isLow ? 'rgba(245,158,11,.13)' : 'rgba(0,51,102,.025)'

              return (
                <tr key={p.id}
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f1f4fb' : 'none', background: baseBg }}
                  onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = baseBg ?? '')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#16203a' }}>{isNl ? p.name_nl : p.name_en}</p>
                      {isOut && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
                          background: '#dc2626', color: '#fff',
                          padding: '2px 7px', borderRadius: 4,
                        }}>{t('stock.alerts.outBadge')}</span>
                      )}
                      {isLow && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
                          background: '#f59e0b', color: '#fff',
                          padding: '2px 7px', borderRadius: 4,
                        }}>{t('stock.alerts.lowBadge')}</span>
                      )}
                    </div>
                    {p.barcode && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7e88a0', fontFamily: 'monospace' }}>{p.barcode}</p>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    {p.category ? (isNl ? p.category.name_nl : p.category.name_en) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 15, fontWeight: 800,
                      color: isOut ? '#dc2626' : isLow ? '#b45309' : '#16a34a',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {(isOut || isLow) && <span style={{ fontSize: 14 }} aria-hidden>⚠️</span>}
                      {formatStockQty(qty)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    {threshold > 0 ? formatStockQty(threshold) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setAdjustProduct(p)}
                        style={{ height: 30, padding: '0 12px', borderRadius: 6, border: 'none', background: '#003366', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid #f1f4fb', background: '#fafafa' }}>
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
