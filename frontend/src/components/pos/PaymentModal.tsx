import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { createSale } from '@/api/sales'
import { openCashDrawer } from '@/lib/hardware'
import type { PaymentMethod } from '@/types/models'
import type { CreateSalePayload } from '@/api/sales'

interface PaymentModalProps {
  isOpen: boolean
  onClose: (() => void) | undefined
  storeId: string
  onSuccess: (saleId: string, cashTendered: number, change: number) => void
}

type Step = 'method' | 'cash' | 'card' | 'mixed'

const NUMPAD = ['7','8','9','4','5','6','1','2','3','','0','.']

export default function PaymentModal({ isOpen, onClose, storeId, onSuccess }: PaymentModalProps) {
  const { t } = useTranslation()
  const items = useCartStore((s) => s.items)
  const totals = useCartStore((s) => s.totals)
  const saleDiscount = useCartStore((s) => s.saleDiscount)
  const customer = useCartStore((s) => s.customer)
  const clearCart = useCartStore((s) => s.clearCart)
  const qc = useQueryClient()

  const printer = useSettingsStore((s) => s.printer)

  const [step, setStep] = useState<Step>('method')
  const [cashInput, setCashInput] = useState('')
  const [cardAmount, setCardAmount] = useState('')

  const total = parseFloat(totals.total)

  const cashTendered = parseFloat(cashInput) || 0
  const cardAmt = parseFloat(cardAmount) || 0
  const mixedCashAmt = Math.max(0, total - cardAmt)
  const change = Math.max(0, cashTendered - total)

  function getErrorMessage(err: unknown): string {
    const res = (err as any)?.response
    if (res?.data?.message) return res.data.message
    if (res?.data?.errors) {
      const first = Object.values(res.data.errors as Record<string, string[]>)[0]
      if (Array.isArray(first)) return first[0]
    }
    return t('errors.serverError')
  }

  const saleMutation = useMutation({
    mutationFn: (payload: CreateSalePayload) => createSale(payload),
    onSuccess: (sale) => {
      qc.invalidateQueries({ queryKey: ['today-summary', storeId] })
      const tendered = step === 'cash' ? cashTendered : mixedCashAmt
      const chg = step === 'cash' ? change : Math.max(0, mixedCashAmt - cardAmt)

      // Auto-open cash drawer on cash or mixed payment
      if ((step === 'cash' || step === 'mixed') && printer.type !== 'none') {
        openCashDrawer(printer).catch(() => {
          // Drawer failure is non-fatal — sale is already recorded
        })
      }

      clearCart()
      onSuccess(sale.id, tendered, chg)
    },
  })

  function buildPayload(method: PaymentMethod): CreateSalePayload {
    return {
      store_id: storeId,
      customer_id: customer?.id ?? null,
      payment_method: method,
      cash_tendered: method === 'cash' ? cashTendered : method === 'mixed' ? mixedCashAmt : undefined,
      card_amount: method === 'card' ? total : method === 'mixed' ? cardAmt : undefined,
      sale_discount_srd: saleDiscount.type === 'fixed' && saleDiscount.value > 0 ? saleDiscount.value : undefined,
      sale_discount_pct: saleDiscount.type === 'percent' && saleDiscount.value > 0 ? saleDiscount.value : undefined,
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name_nl,
        unit_price: parseFloat(i.computed.unitPrice),
        quantity: i.quantity,
        btw_rate: parseFloat(i.btwRateOverride ?? i.product.btw_rate),
        btw_exempt: i.product.btw_exempt,
        discount_srd: parseFloat(i.computed.discountAmount) > 0 ? parseFloat(i.computed.discountAmount) : undefined,
      })),
    }
  }

  function handleComplete(method: PaymentMethod) {
    saleMutation.mutate(buildPayload(method))
  }

  function numpadPress(val: string) {
    const target = step === 'mixed' ? setCardAmount : setCashInput
    const current = step === 'mixed' ? cardAmount : cashInput
    if (val === '' ) return  // empty cell in numpad
    if (val === '.' && current.includes('.')) return
    if (current === '0' && val !== '.') { target(val); return }
    if (current.includes('.') && current.split('.')[1].length >= 2) return
    target(current + val)
  }

  function numpadDel() {
    const target = step === 'mixed' ? setCardAmount : setCashInput
    const current = step === 'mixed' ? cardAmount : cashInput
    target(current.slice(0, -1))
  }

  function quickCash(amount: number) {
    setCashInput(amount.toFixed(2))
  }

  const isProcessing = saleMutation.isPending

  return (
    <Modal isOpen={isOpen} onClose={isProcessing ? undefined : onClose} title={t('pos.payment.title')} width={400} persistent={isProcessing}>
      {step === 'method' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Total due */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
            padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('pos.payment.amountDue')}
            </div>
            <div className="currency-srd" style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-total)' }}>
              SRD {totals.total}
            </div>
          </div>

          {/* Method buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'cash', label: t('pos.payment.cash'), icon: '💵', action: () => { setCashInput(''); setStep('cash') } },
              { key: 'card', label: t('pos.payment.card'), icon: '💳', action: () => handleComplete('card') },
              { key: 'mixed', label: t('pos.payment.mixed'), icon: '🔀', action: () => { setCardAmount(''); setStep('mixed') } },
            ].map((m) => (
              <button
                key={m.key}
                onClick={m.action}
                disabled={isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 'var(--font-size-base)', fontWeight: 600,
                  transition: 'border-color 0.12s',
                  height: 'var(--touch-target-xl)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {getErrorMessage(saleMutation.error)}
            </div>
          )}
        </div>
      )}

      {(step === 'cash' || step === 'mixed') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>← {t('app.back')}</button>

          {/* Amount due */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {step === 'mixed' ? t('pos.payment.cardAmount') : t('pos.payment.amountDue')}
            </span>
            <span className="currency-srd" style={{ fontWeight: 700, color: 'var(--color-total)' }}>
              SRD {step === 'mixed' ? (total - (parseFloat(cardAmount) || 0)).toFixed(2) : totals.total}
            </span>
          </div>

          {/* Display */}
          <div style={{
            textAlign: 'right', padding: '10px 16px',
            background: 'var(--bg-input)', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
              {step === 'mixed' ? t('pos.payment.cardAmount') : t('pos.payment.cashReceived')}
            </div>
            <div className="currency-srd" style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>
              SRD {(step === 'mixed' ? cardAmount : cashInput) || '0'}
            </div>
          </div>

          {step === 'cash' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{t('pos.payment.change')}</span>
              <span className="currency-srd" style={{ fontWeight: 700, color: change >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                SRD {change.toFixed(2)}
              </span>
            </div>
          )}

          {/* Quick amounts (cash only) */}
          {step === 'cash' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i).slice(0,6).map((amt) => (
                <button
                  key={amt}
                  onClick={() => quickCash(amt)}
                  style={{
                    flex: '1 1 auto', height: 36, borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                  }}
                >
                  {amt.toFixed(0)}
                </button>
              ))}
            </div>
          )}

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {NUMPAD.map((k, i) => (
              k === '' ? <div key={i} /> :
              <button
                key={i}
                onClick={() => numpadPress(k)}
                style={{
                  height: 52, borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 'var(--font-size-lg)', fontWeight: 600,
                }}
              >
                {k}
              </button>
            ))}
            <button
              onClick={numpadDel}
              style={{
                height: 52, borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--font-size-base)',
              }}
            >
              ⌫
            </button>
          </div>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {getErrorMessage(saleMutation.error)}
            </div>
          )}

          {/* Complete button */}
          <button
            onClick={() => handleComplete(step === 'cash' ? 'cash' : 'mixed')}
            disabled={
              isProcessing ||
              (step === 'cash' && cashTendered < total) ||
              (step === 'mixed' && cardAmt <= 0)
            }
            style={{
              height: 'var(--touch-target-xl)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700,
              fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || (step === 'cash' && cashTendered < total) || (step === 'mixed' && cardAmt <= 0)) ? 0.5 : 1,
            }}
          >
            {isProcessing ? t('pos.payment.processing') : t('pos.payment.complete')}
          </button>
        </div>
      )}
    </Modal>
  )
}
