import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useLowStockSet } from '@/hooks/useLowStockSet'
import { getPosProducts, getCategories, getProductByBarcode } from '@/api/products'
import { parseEmbeddedBarcode } from '@/lib/embeddedBarcode'
import CategoryFilter from './CategoryFilter'
import ProductCard from './ProductCard'
import type { Product } from '@/types/models'

interface ProductGridProps {
  storeId: string
}

export default function ProductGrid({ storeId }: ProductGridProps) {
  const { t } = useTranslation()
  const addProduct = useCartStore((s) => s.addProduct)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const updateItemOverrides = useCartStore((s) => s.updateItemOverrides)
  const productDisplay = useSettingsStore((s) => s.productDisplay)
  const embeddedBarcode = useSettingsStore((s) => s.embeddedBarcode)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [barcodeError, setBarcodeError] = useState<string | null>(null)

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['pos-products', storeId],
    queryFn: () => getPosProducts(storeId),
    staleTime: 1000 * 60 * 5,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 10,
  })

  const { data: lowStockIds } = useLowStockSet(storeId)

  // Barcode scanner — USB HID keyboard wedge sends chars rapidly then Enter
  const handleBarcodeSearch = useCallback(async (barcode: string) => {
    setBarcodeError(null)

    // Scale-printed weighed-goods barcode? Parse out the item code + embedded
    // price/weight; look the product up by the item code, then either override
    // the line price (price-embedded: the scale already priced it) or set the
    // quantity to the weight (weight-embedded: price = catalogue rate × kg).
    const embedded = parseEmbeddedBarcode(barcode, embeddedBarcode)
    if (embedded) {
      try {
        const product = await getProductByBarcode(embedded.itemCode, storeId)
        addProduct(product)
        if (embedded.mode === 'price') {
          // value = total line price for this single weighed item.
          updateItemOverrides(product.id, { unitPriceOverride: embedded.value.toFixed(2) })
        } else {
          // value = weight in kg; line total = catalogue unit price × weight.
          updateQuantity(product.id, embedded.value)
        }
        setSearch('')
      } catch {
        setBarcodeError(t('pos.barcode.notFound', { barcode: embedded.itemCode }))
        setTimeout(() => setBarcodeError(null), 3000)
      }
      return
    }

    try {
      const product = await getProductByBarcode(barcode, storeId)
      addProduct(product)
      setSearch('')
    } catch {
      setBarcodeError(t('pos.barcode.notFound', { barcode }))
      setTimeout(() => setBarcodeError(null), 3000)
    }
  }, [storeId, addProduct, updateQuantity, updateItemOverrides, embeddedBarcode, t])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const val = search.trim()
      // Treat 8–13 digit string as barcode
      if (/^\d{8,13}$/.test(val)) {
        handleBarcodeSearch(val)
      }
    }
  }

  const filtered = products.filter((p: Product) => {
    const matchesCategory = selectedCategory === null || p.category_id === selectedCategory
    if (!matchesCategory) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name_nl.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      (p.barcode?.toLowerCase() ?? '').includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 10 }}>
      {/* Search bar */}
      <div style={{ padding: '0 16px', flexShrink: 0 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setBarcodeError(null) }}
          onKeyDown={handleSearchKeyDown}
          placeholder={t('pos.searchPlaceholder')}
          style={{
            width: '100%',
            height: 'var(--touch-target)',
            background: 'var(--bg-input)',
            border: `1px solid ${barcodeError ? 'var(--color-error)' : 'var(--border-color)'}`,
            borderRadius: 'var(--border-radius)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-base)',
            padding: '0 16px',
            outline: 'none',
          }}
        />
        {barcodeError && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', marginTop: 4 }}>
            {barcodeError}
          </div>
        )}
      </div>

      {/* Category filter */}
      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {productsLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-secondary)' }}>
            {t('app.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-secondary)' }}>
            {t('pos.noProducts')}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 8,
            }}
          >
            {filtered.map((product: Product) => (
              <ProductCard
                key={product.id}
                product={product}
                display={productDisplay}
                isLowStock={lowStockIds?.has(product.id) ?? false}
                onAdd={addProduct}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
