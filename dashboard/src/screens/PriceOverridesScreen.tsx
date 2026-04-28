import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'
import { getPriceOverrides, upsertPriceOverride, deletePriceOverride, pushCatalogue, type PriceOverride } from '@/api/priceOverrides'
import { getStores, type Store } from '@/api/stores'
import apiClient from '@/api/client'

interface Product { id: string; name_nl: string; name_en: string; price: string; barcode: string | null }

function EditOverrideModal({
  override, store, isNl, onClose,
}: { override: PriceOverride | null; store: Store; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [productId, setProductId] = useState(override?.product_id ?? '')
  const [price, setPrice] = useState(override?.price_override ?? '')
  const [error, setError] = useState('')

  const { data: products = [] } = useQuery({
    queryKey: ['products-simple'],
    queryFn: () => apiClient.get('/products', { params: { per_page: 200, active_only: false } }).then(r => r.data.data as Product[]),
    staleTime: 60_000,
  })

  const mut = useMutation({
    mutationFn: () => upsertPriceOverride(store.id, productId, parseFloat(price)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price-overrides', store.id] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
          {isNl ? 'Prijsoverschrijving instellen' : 'Set price override'} — {store.name}
        </h3>

        {!override && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>{isNl ? 'Product' : 'Product'}</label>
            <select value={productId} onChange={e => setProductId(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }}>
              <option value="">{isNl ? '— Kies product —' : '— Choose product —'}</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{isNl ? p.name_nl : p.name_en} (SRD {parseFloat(p.price).toFixed(2)})</option>
              ))}
            </select>
          </div>
        )}

        {override && (
          <div style={{ padding: '10px 14px', background: '#f8f7ff', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{override.product_name}</span>
            <span style={{ color: '#6b7280', marginLeft: 8 }}>{isNl ? 'Basisprijs:' : 'Base price:'} SRD {parseFloat(override.base_price).toFixed(2)}</span>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>
          {isNl ? 'Vestigingsprijs (SRD)' : 'Store price (SRD)'}
        </label>
        <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 15, fontWeight: 700, marginBottom: 16 }} />

        {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={!productId || !price || mut.isPending}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !productId || !price ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PriceOverridesScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const isSuperAdmin = useDashboardAuthStore(s => s.isSuperAdmin())
  const qc = useQueryClient()

  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [editOverride, setEditOverride] = useState<PriceOverride | 'new' | null>(null)
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'done' | 'error'>('idle')

  const { data: stores = [] } = useQuery({
    queryKey: ['stores', selectedOrgId],
    queryFn: () => getStores(isSuperAdmin && selectedOrgId ? selectedOrgId : undefined),
  })

  const selectedStore = (stores as Store[]).find(s => s.id === selectedStoreId)

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ['price-overrides', selectedStoreId],
    queryFn: () => getPriceOverrides(selectedStoreId),
    enabled: !!selectedStoreId,
  })

  const deleteMut = useMutation({
    mutationFn: ({ productId }: { productId: string }) => deletePriceOverride(selectedStoreId, productId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-overrides', selectedStoreId] }),
  })

  async function handlePush() {
    setPushStatus('pushing')
    try {
      await pushCatalogue()
      setPushStatus('done')
      setTimeout(() => setPushStatus('idle'), 3000)
    } catch {
      setPushStatus('error')
      setTimeout(() => setPushStatus('idle'), 3000)
    }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Prijsoverschrijvingen' : 'Price Overrides'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl ? 'Stel vestigingsspecifieke prijzen in. Ook: push catalogus naar alle kassa\'s.' : 'Set store-specific prices. Also: push catalogue to all POS terminals.'}
          </p>
        </div>
        {/* Push Catalogue button */}
        <button
          onClick={handlePush}
          disabled={pushStatus !== 'idle'}
          style={{
            height: 42, padding: '0 20px', borderRadius: 10, border: 'none', cursor: pushStatus !== 'idle' ? 'not-allowed' : 'pointer',
            background: pushStatus === 'done' ? '#16a34a' : pushStatus === 'error' ? '#dc2626' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            color: '#fff', fontSize: 13, fontWeight: 700, transition: 'background .3s',
          }}
        >
          {pushStatus === 'pushing' ? (isNl ? '📡 Versturen…' : '📡 Pushing…')
            : pushStatus === 'done'    ? (isNl ? '✓ Verstuurd!' : '✓ Pushed!')
            : pushStatus === 'error'   ? (isNl ? '✗ Fout' : '✗ Error')
            : (isNl ? '📡 Catalogus pushen naar kassa\'s' : '📡 Push catalogue to POS terminals')}
        </button>
      </div>

      {/* Store selector */}
      <div style={{ background: '#fff', border: '1px solid #e9e9ef', borderRadius: 14, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {isSuperAdmin && (
          <select value={selectedOrgId} onChange={e => { setSelectedOrgId(e.target.value); setSelectedStoreId('') }}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, minWidth: 180 }}>
            <option value="">{isNl ? '— Organisatie —' : '— Organisation —'}</option>
            {/* Note: in a real app you'd load orgs here */}
          </select>
        )}
        <select value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, minWidth: 200 }}>
          <option value="">{isNl ? '— Kies vestiging —' : '— Choose store —'}</option>
          {(stores as Store[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {selectedStoreId && (
          <button
            onClick={() => setEditOverride('new')}
            style={{ height: 38, padding: '0 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}
          >
            {isNl ? '+ Overschrijving toevoegen' : '+ Add override'}
          </button>
        )}
      </div>

      {!selectedStoreId ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏪</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>{isNl ? 'Kies een vestiging' : 'Choose a store'}</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
      ) : overrides.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef' }}>
          <p style={{ fontSize: 36, marginBottom: 10 }}>💰</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#6b7280' }}>
            {isNl ? 'Geen prijsoverschrijvingen voor deze vestiging' : 'No price overrides for this store'}
          </p>
          <p style={{ fontSize: 13, color: '#9090a0' }}>
            {isNl ? 'Alle producten gebruiken de standaardcatalogusprijzen.' : 'All products use the default catalogue prices.'}
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[isNl ? 'Product' : 'Product', isNl ? 'Basisprijs' : 'Base price', isNl ? 'Vestigingsprijs' : 'Store price', isNl ? 'Verschil' : 'Difference', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(overrides as PriceOverride[]).map((o, i) => {
                const diff = parseFloat(o.price_override) - parseFloat(o.base_price)
                return (
                  <tr key={o.id}
                    style={{ borderBottom: i < overrides.length - 1 ? '1px solid #f3f3f8' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{o.product_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>SRD {parseFloat(o.base_price).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#7c3aed' }}>SRD {parseFloat(o.price_override).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: diff > 0 ? '#dc2626' : '#16a34a' }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditOverride(o)}
                          style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', fontSize: 12, cursor: 'pointer' }}>
                          {isNl ? 'Bewerken' : 'Edit'}
                        </button>
                        <button
                          onClick={() => { if (confirm(isNl ? 'Verwijderen?' : 'Delete?')) deleteMut.mutate({ productId: o.product_id }) }}
                          style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editOverride !== null && selectedStore && (
        <EditOverrideModal
          override={editOverride === 'new' ? null : editOverride}
          store={selectedStore}
          isNl={isNl}
          onClose={() => setEditOverride(null)}
        />
      )}
    </div>
  )
}
