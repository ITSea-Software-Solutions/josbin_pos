import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'
import { useCartStore } from '@/store/cartStore'
import type { CartItem } from '@/types/models'

interface LineItemEditModalProps {
  isOpen: boolean
  onClose: () => void
  item: CartItem
}

export default function LineItemEditModal({ isOpen, onClose, item }: LineItemEditModalProps) {
  const { t, i18n } = useTranslation()
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const updateItemOverrides = useCartStore((s) => s.updateItemOverrides)
  const updateItemDiscount = useCartStore((s) => s.updateItemDiscount)
  const removeItem = useCartStore((s) => s.removeItem)

  const isNl = i18n.language === 'nl'
  const name = isNl ? item.product.name_nl : item.product.name_en

  const [qty, setQty] = useState(String(item.quantity))
  const [price, setPrice] = useState(item.unitPriceOverride ?? item.product.price)
  const [btwRate, setBtwRate] = useState(item.btwRateOverride ?? item.product.btw_rate)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(item.discount?.type ?? 'percent')
  const [discountValue, setDiscountValue] = useState(item.discount ? String(item.discount.value) : '')

  function handleSave() {
    const parsedQty = parseFloat(qty)
    if (!isNaN(parsedQty) && parsedQty > 0) updateQuantity(item.product.id, parsedQty)

    updateItemOverrides(item.product.id, {
      unitPriceOverride: price !== item.product.price ? price : null,
      btwRateOverride: btwRate !== item.product.btw_rate ? btwRate : null,
    })

    const discVal = parseFloat(discountValue)
    if (!isNaN(discVal) && discVal > 0) {
      updateItemDiscount(item.product.id, { type: discountType, value: discVal })
    } else {
      updateItemDiscount(item.product.id, null)
    }

    onClose()
  }

  function handleRemove() {
    removeItem(item.product.id)
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-base)',
    padding: '0 12px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    display: 'block',
    marginBottom: 6,
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={name} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Quantity */}
        <div>
          <label style={labelStyle}>{t('pos.cart.quantity')}</label>
          <input type="number" min="0.001" step="0.001" value={qty}
            onChange={(e) => setQty(e.target.value)} style={inputStyle} />
        </div>

        {/* Unit price */}
        <div>
          <label style={labelStyle}>{t('pos.cart.unitPrice')} (SRD)</label>
          <input type="number" min="0" step="0.01" value={price}
            onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
        </div>

        {/* BTW rate */}
        <div>
          <label style={labelStyle}>{t('btw.label')} (%)</label>
          <input type="number" min="0" max="100" step="0.01" value={btwRate}
            onChange={(e) => setBtwRate(e.target.value)}
            disabled={item.product.btw_exempt}
            style={{ ...inputStyle, opacity: item.product.btw_exempt ? 0.4 : 1 }} />
          {item.product.btw_exempt && (
            <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 3 }}>{t('btw.exempt')}</div>
          )}
        </div>

        {/* Item discount */}
        <div>
          <label style={labelStyle}>{t('pos.cart.discount')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
              style={{ ...inputStyle, width: 'auto', flex: '0 0 120px', cursor: 'pointer' }}
            >
              <option value="percent">%</option>
              <option value="fixed">SRD</option>
            </select>
            <input type="number" min="0" step={discountType === 'percent' ? '1' : '0.01'}
              value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
              placeholder="0" style={inputStyle} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            onClick={handleRemove}
            style={{
              flex: '0 0 auto',
              padding: '0 16px',
              height: 44,
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--color-error)',
              background: 'transparent',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
            }}
          >
            {t('app.delete')}
          </button>
          <button onClick={onClose} style={{
            flex: 1, height: 44, borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
          }}>
            {t('app.cancel')}
          </button>
          <button onClick={handleSave} style={{
            flex: 1, height: 44, borderRadius: 'var(--border-radius)',
            border: 'none', background: 'var(--color-primary)',
            color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)',
          }}>
            {t('app.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
