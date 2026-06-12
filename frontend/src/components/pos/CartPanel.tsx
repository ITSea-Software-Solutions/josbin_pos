import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useLowStockSet } from '@/hooks/useLowStockSet'
import DiscountModal from './DiscountModal'
import LineItemEditModal from './LineItemEditModal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import type { CartItem } from '@/types/models'

interface CartPanelProps {
  onCheckout: () => void
  onHoldBill: () => void
}

export default function CartPanel({ onCheckout, onHoldBill }: CartPanelProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const storeId = useSettingsStore((s) => s.storeId)
  const { data: lowStockIds } = useLowStockSet(storeId)

  const items = useCartStore((s) => s.items)
  const totals = useCartStore((s) => s.totals)
  const saleDiscount = useCartStore((s) => s.saleDiscount)
  const setSaleDiscount = useCartStore((s) => s.setSaleDiscount)
  const clearSaleDiscount = useCartStore((s) => s.clearSaleDiscount)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const [saleDiscountOpen, setSaleDiscountOpen] = useState(false)
  const [editItem, setEditItem] = useState<CartItem | null>(null)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const isEmpty = items.length === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
      }}
    >
      {/* Cart header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)' }}>
          {t('pos.cart.title')}
        </span>
        {!isEmpty && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {items.length} {isNl ? 'artikel' : 'item'}{items.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setClearConfirmOpen(true)}
              title={t('pos.cart.clear')}
              data-testid="btn-clear-cart"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-error)', fontSize: 'var(--font-size-sm)',
                fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🗑 {t('pos.cart.clear')}
            </button>
          </div>
        )}
      </div>

      {/* Cart items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isEmpty ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)',
            flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 32 }}>🛒</span>
            <span>{t('pos.cart.empty')}</span>
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {items.map((item) => (
              <CartLineItem
                key={item.product.id}
                item={item}
                isNl={isNl}
                isLowStock={lowStockIds?.has(item.product.id) ?? false}
                onEdit={() => setEditItem(item)}
                onQtyChange={(qty) => updateQuantity(item.product.id, qty)}
                onRemove={() => removeItem(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Totals footer */}
      {!isEmpty && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}>
          {/* Subtotal */}
          <TotalsRow label={t('pos.cart.subtotal')} value={`SRD ${totals.subtotal}`} />

          {/* Sale discount */}
          <div
            onClick={() => setSaleDiscountOpen(true)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-discount)' }}>
              {t('pos.cart.saleDiscount')}
              {saleDiscount.value > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                  ({saleDiscount.type === 'percent' ? `${saleDiscount.value}%` : `SRD ${saleDiscount.value.toFixed(2)}`})
                </span>
              )}
            </span>
            <span className="currency-srd" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-discount)' }}>
              {saleDiscount.value > 0 ? `- SRD ${totals.saleDiscountAmount}` : '+ toevoegen'}
            </span>
          </div>

          {/* BTW */}
          <TotalsRow
            label={t('pos.cart.btw')}
            value={`SRD ${totals.btwTotal}`}
            muted
            color="var(--color-btw)"
          />

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

          {/* Total */}
          <TotalsRow
            label={t('pos.cart.total')}
            value={`SRD ${totals.total}`}
            large
            color="var(--color-total)"
          />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onHoldBill}
              style={{
                flex: 1,
                height: 'var(--touch-target)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
              }}
            >
              {t('pos.holdBill')}
              <span style={{ opacity: 0.55, fontSize: 11, marginLeft: 6, fontWeight: 700 }}>F2</span>
            </button>
            <button
              onClick={onCheckout}
              style={{
                flex: 2,
                height: 'var(--touch-target)',
                borderRadius: 'var(--border-radius)',
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 'var(--font-size-base)',
                fontWeight: 700,
                letterSpacing: '0.3px',
              }}
            >
              {t('pos.payment.title')}
              <span style={{ opacity: 0.7, fontSize: 11, margin: '0 6px', fontWeight: 700 }}>F9</span>
              →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <DiscountModal
        isOpen={saleDiscountOpen}
        onClose={() => setSaleDiscountOpen(false)}
        onApply={setSaleDiscount}
        onRemove={clearSaleDiscount}
        current={saleDiscount.value > 0 ? saleDiscount : null}
        maxAmount={parseFloat(totals.subtotal)}
        title={t('pos.cart.saleDiscount')}
      />

      {editItem && (
        <LineItemEditModal
          isOpen
          onClose={() => setEditItem(null)}
          item={editItem}
        />
      )}

      <ConfirmDialog
        isOpen={clearConfirmOpen}
        title={t('pos.cart.clearTitle')}
        message={t('pos.cart.clearBody', { count: items.length })}
        confirmLabel={t('pos.cart.clear')}
        onConfirm={() => { clearCart(); setClearConfirmOpen(false) }}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TotalsRow({
  label, value, large = false, muted = false, color,
}: {
  label: string; value: string; large?: boolean; muted?: boolean; color?: string
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{
        fontSize: large ? 'var(--font-size-md)' : 'var(--font-size-sm)',
        color: muted ? 'var(--text-secondary)' : color ?? 'var(--text-primary)',
        fontWeight: large ? 700 : 400,
      }}>
        {label}
      </span>
      <span className="currency-srd" style={{
        fontSize: large ? 'var(--font-size-md)' : 'var(--font-size-sm)',
        fontWeight: large ? 800 : 500,
        color: color ?? (large ? 'var(--text-primary)' : 'var(--text-secondary)'),
      }}>
        {value}
      </span>
    </div>
  )
}

function CartLineItem({
  item, isNl, isLowStock, onEdit, onQtyChange, onRemove,
}: {
  item: CartItem
  isNl: boolean
  isLowStock: boolean
  onEdit: () => void
  onQtyChange: (qty: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const name = isNl ? item.product.name_nl : item.product.name_en
  const hasDiscount = item.discount && item.discount.value > 0

  // Out-of-stock takes precedence over the low-stock hint. The cashier can
  // still complete the sale either way — this is informational only, the
  // manager-approval gate is a separate feature.
  const stockQty = item.product.stock_qty
  const isOut = typeof stockQty === 'number' && stockQty <= 0
  const showLow = !isOut && isLowStock

  // Soft background tint mirrors the dashboard's row colour scheme.
  const bg = isOut ? 'rgba(220,38,38,0.08)' : showLow ? 'rgba(245,158,11,0.10)' : undefined

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border-color)',
        cursor: 'pointer',
        background: bg,
      }}
      onClick={onEdit}
    >
      {/* Qty controls */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <QtyBtn onClick={() => onQtyChange(item.quantity - 1)}>−</QtyBtn>
        <span style={{ width: 28, textAlign: 'center', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
        </span>
        <QtyBtn onClick={() => onQtyChange(item.quantity + 1)}>+</QtyBtn>
      </div>

      {/* Name + price + stock warning */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          SRD {parseFloat(item.computed.unitPrice).toFixed(2)}
          {item.product.btw_exempt ? '' : ` · BTW ${item.btwRateOverride ?? item.product.btw_rate}%`}
        </div>
        {isOut && (
          <div
            role="alert"
            style={{
              marginTop: 4, fontSize: 11, fontWeight: 700,
              color: '#b91c1c',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span aria-hidden>⛔</span>
            <span>{t('pos.stockWarning.out')}</span>
          </div>
        )}
        {showLow && (
          <div
            role="status"
            style={{
              marginTop: 4, fontSize: 11, fontWeight: 700,
              color: '#92400e',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <span aria-hidden>⚠️</span>
            <span>
              {typeof stockQty === 'number'
                ? t(stockQty === 1 ? 'pos.stockWarning.lowOne' : 'pos.stockWarning.lowMany',
                    { count: Math.max(0, Math.floor(stockQty)) })
                : t('pos.stockWarning.lowMany', { count: 0 })}
            </span>
          </div>
        )}
      </div>

      {/* Line total */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="currency-srd" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
          SRD {item.computed.lineTotal}
        </div>
        {hasDiscount && (
          <div style={{ fontSize: 11, color: 'var(--color-discount)' }}>
            -{' '}{item.discount!.type === 'percent' ? `${item.discount!.value}%` : `SRD ${parseFloat(item.computed.discountAmount).toFixed(2)}`}
          </div>
        )}
      </div>

      {/* Remove line — direct delete, no need to decrement qty to zero */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        title={t('pos.cart.removeItem')}
        aria-label={t('pos.cart.removeItem')}
        style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 4,
          border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
          color: 'var(--color-error)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}

function QtyBtn({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 4, border: '1px solid var(--border-color)',
        background: 'var(--bg-elevated)', color: 'var(--text-primary)',
        cursor: 'pointer', fontSize: 16, lineHeight: 1, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
