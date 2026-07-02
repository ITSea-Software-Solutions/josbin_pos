import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import Modal from '@/components/shared/Modal'
import QuickReasonChips from './QuickReasonChips'
import { useToast } from '@/components/shared/Toast'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { blindReturn, type BlindReturnPayload } from '@/api/sales'

interface BlindReturnModalProps {
  isOpen: boolean
  onClose: () => void
}

function errMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { message?: string } | undefined
    return d?.message ?? err.message
  }
  return err instanceof Error ? err.message : 'Error'
}

/**
 * Manager-only: turn the current cart into a return with NO original sale
 * (customer brought goods back without a receipt). Reuses the cart the manager
 * already built — each line becomes a negative sale line; stock is restored.
 */
export default function BlindReturnModal({ isOpen, onClose }: BlindReturnModalProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const items = useCartStore((s) => s.items)
  const totals = useCartStore((s) => s.totals)
  const clearCart = useCartStore((s) => s.clearCart)
  const storeId = useSettingsStore((s) => s.storeId)
  const toast = useToast()

  const [reason, setReason] = useState('')
  const [method, setMethod] = useState<BlindReturnPayload['payment_method']>('cash')

  const mutation = useMutation({
    mutationFn: () => blindReturn({
      store_id: storeId!,
      payment_method: method,
      reason: reason.trim(),
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: isNl ? i.product.name_nl : i.product.name_en,
        unit_price: parseFloat(i.computed.unitPrice),
        quantity: i.quantity,
        btw_rate: parseFloat(i.btwRateOverride ?? i.product.btw_rate),
        btw_exempt: i.product.btw_exempt,
      })),
    }),
    onSuccess: (sale) => {
      toast.success(t('pos.blindReturn.done', { total: Math.abs(parseFloat(sale.total_srd)).toFixed(2) }))
      clearCart()
      setReason('')
      onClose()
    },
    onError: (err) => toast.error(errMessage(err)),
  })

  const valid = reason.trim().length >= 5 && items.length > 0 && !!storeId

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pos.blindReturn.title')} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
          {t('pos.blindReturn.intro')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            {items.length} {isNl ? 'artikel' : 'item'}{items.length !== 1 ? 's' : ''}
          </span>
          <span className="currency-srd" style={{ fontWeight: 800, color: 'var(--color-error)' }}>
            − SRD {totals.total}
          </span>
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('pos.blindReturn.refundVia')}</label>
        <select
          value={method} onChange={(e) => setMethod(e.target.value as BlindReturnPayload['payment_method'])}
          style={{ height: 'var(--touch-target)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 'var(--font-size-sm)' }}
        >
          <option value="cash">{isNl ? 'Contant' : 'Cash'}</option>
          <option value="card">{isNl ? 'Pin / kaart' : 'Card'}</option>
          <option value="bank_transfer">{isNl ? 'Bankoverschrijving' : 'Bank transfer'}</option>
          <option value="mobile_transfer">{isNl ? 'Mobiel' : 'Mobile'}</option>
        </select>

        <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('pos.blindReturn.reason')}</label>
        <QuickReasonChips value={reason} onChange={setReason} />
        <textarea
          value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500}
          placeholder={t('pos.blindReturn.reasonPlaceholder')}
          style={{ borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', padding: '8px 12px', fontSize: 'var(--font-size-sm)', resize: 'vertical' }}
        />

        <button
          onClick={() => mutation.mutate()}
          disabled={!valid || mutation.isPending}
          style={{
            height: 'var(--touch-target)', borderRadius: 'var(--border-radius)', border: 'none',
            background: 'var(--color-error)', color: '#fff', cursor: 'pointer',
            fontWeight: 700, fontSize: 'var(--font-size-sm)',
            opacity: !valid || mutation.isPending ? 0.5 : 1,
          }}
        >
          {mutation.isPending ? '⏳' : t('pos.blindReturn.confirm')}
        </button>
      </div>
    </Modal>
  )
}
