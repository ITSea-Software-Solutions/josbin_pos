import { useTranslation } from 'react-i18next'
import ProductGlyph from '@/components/pos/ProductGlyph'
import { useSettingsStore } from '@/store/settingsStore'
import type { Product } from '@/types/models'
import type { ProductDisplay } from '@/store/settingsStore'

interface ProductCardProps {
  product: Product
  display: ProductDisplay
  /** Whether this product is currently flagged "low stock" for the store. */
  isLowStock?: boolean
  onAdd: (product: Product) => void
}

export default function ProductCard({ product, display, isLowStock = false, onAdd }: ProductCardProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const name = isNl ? product.name_nl : product.name_en
  const price = parseFloat(product.price).toFixed(2)

  // Out beats low. We never block the tap — the cashier can still add the
  // product to the cart and the cart row repeats the warning more prominently.
  const isOut = typeof product.stock_qty === 'number' && product.stock_qty <= 0
  const showLow = !isOut && isLowStock
  const stockBadge = isOut
    ? { text: t('pos.stockWarning.outShort'), bg: '#dc2626', fg: '#fff' }
    : showLow
      ? { text: typeof product.stock_qty === 'number' ? `${Math.max(0, Math.floor(product.stock_qty))}` : '—', bg: '#f59e0b', fg: '#fff' }
      : null

  const density = useSettingsStore((st) => st.gridDensity)
  // A 66 px tile cannot carry a "BTW-vrij" pill AND a low-stock chip AND a
  // wrapped name. The exemption is still on the receipt and in the line-item
  // editor, so dropping the badge at the tightest density loses nothing the
  // cashier needs mid-scan — where the price is what they are checking.
  const tight     = density >= 12
  const glyphPx   = { 4: 56, 6: 44, 8: 36, 12: 26 }[density] ?? 44
  const bodyPx    = tight ? 10.5 : undefined

  return (
    <button
      onClick={() => onAdd(product)}
      title={name}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--border-radius)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        gap: 6,
        transition: 'border-color 0.12s, background 0.12s',
        minHeight: 100,
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary)'
        e.currentTarget.style.background = 'var(--bg-surface)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)'
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
    >
      {/* BTW-exempt badge */}
      {product.btw_exempt && !tight && (
        <span
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            fontSize: 9,
            fontWeight: 700,
            background: 'var(--color-accent)',
            color: '#000',
            padding: '1px 5px',
            borderRadius: 4,
            letterSpacing: '0.3px',
          }}
        >
          BTW-vrij
        </span>
      )}

      {/* Stock-alert pill — top-left corner so it doesn't collide with the
         BTW-vrij badge on the right. Tells the cashier why the row will
         show a warning once it's in the cart. */}
      {stockBadge && (
        <span
          style={{
            position: 'absolute',
            top: 5,
            left: 5,
            fontSize: 9,
            fontWeight: 800,
            background: stockBadge.bg,
            color: stockBadge.fg,
            padding: '2px 6px',
            borderRadius: 4,
            letterSpacing: '0.4px',
          }}
        >
          {stockBadge.text}
        </span>
      )}

      {/* Image */}
      {(display === 'photo' || display === 'both') && product.image_url ? (
        <img
          src={product.image_url}
          alt={name}
          style={{
            width: '100%',
            height: 60,
            objectFit: 'cover',
            borderRadius: 4,
            flexShrink: 0,
          }}
        />
      ) : (display === 'photo' || display === 'both') ? (
        <div
          style={{
            width: '100%',
            height: 60,
            background: 'var(--bg-base)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {/* Drawn goods, by category. Every tile used to be the same carton,
              which turned a full product grid into one repeating texture with
              nothing for the eye to aim at. */}
          <ProductGlyph category={product.category?.name_nl ?? product.category?.name_en} size={glyphPx} />
        </div>
      ) : null}

      {/* Name */}
      {(display === 'name' || display === 'both') && (
        <div
          style={{
            fontSize: bodyPx ? `${bodyPx}px` : 'var(--font-size-sm)',
            color: 'var(--text-primary)',
            fontWeight: 500,
            textAlign: 'center',
            lineHeight: 1.3,
            width: '100%',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {name}
        </div>
      )}

      {/* Price */}
      <div
        className="currency-srd"
        style={{
          fontSize: bodyPx ? `${bodyPx}px` : 'var(--font-size-sm)',
          fontWeight: 700,
          color: 'var(--color-accent)',
          marginTop: 'auto',
        }}
      >
        SRD {price}
      </div>
    </button>
  )
}
