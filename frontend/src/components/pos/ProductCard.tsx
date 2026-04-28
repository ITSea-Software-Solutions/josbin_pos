import { useTranslation } from 'react-i18next'
import type { Product } from '@/types/models'
import type { ProductDisplay } from '@/store/settingsStore'

interface ProductCardProps {
  product: Product
  display: ProductDisplay
  onAdd: (product: Product) => void
}

export default function ProductCard({ product, display, onAdd }: ProductCardProps) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const name = isNl ? product.name_nl : product.name_en
  const price = parseFloat(product.price).toFixed(2)

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
      {product.btw_exempt && (
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
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          📦
        </div>
      ) : null}

      {/* Name */}
      {(display === 'name' || display === 'both') && (
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
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
          fontSize: 'var(--font-size-sm)',
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
