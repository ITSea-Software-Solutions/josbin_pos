import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import { useCartStore } from '@/store/cartStore'
import { getHeldBills, restoreHeldBill } from '@/api/sales'
import type { HeldBill } from '@/types/models'

interface HeldBillsPanelProps {
  isOpen: boolean
  onClose: () => void
  storeId: string
}

export default function HeldBillsPanel({ isOpen, onClose, storeId }: HeldBillsPanelProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const restoreCart = useCartStore((s) => s.restoreCart)
  const qc = useQueryClient()

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['held-bills', storeId],
    queryFn: () => getHeldBills(storeId),
    enabled: isOpen,
  })

  const restoreMutation = useMutation({
    mutationFn: restoreHeldBill,
    onSuccess: (bill) => {
      restoreCart(bill.items, bill.customer, bill.sale_discount)
      qc.invalidateQueries({ queryKey: ['held-bills', storeId] })
      onClose()
    },
  })

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString(isNl ? 'nl-SR' : 'en-SR', {
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pos.openBills')} width={420}>
      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>{t('app.loading')}</div>
      ) : bills.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 24 }}>
          {isNl ? 'Geen bewaarde bonnen' : 'No held bills'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bills.map((bill: HeldBill) => {
            // Items in cart_data may or may not carry the client-side `computed`
            // block (DemoSeeder rows don't), so we compute counts here and use
            // the backend-stored total instead of summing line totals.
            const items = bill.items ?? []
            const itemCount = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
            const total = parseFloat(bill.total_srd ?? '0')
            return (
              <button
                key={bill.id}
                onClick={() => restoreMutation.mutate(bill.id)}
                disabled={restoreMutation.isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {bill.label ?? (isNl ? `Bon ${formatTime(bill.created_at)}` : `Bill ${formatTime(bill.created_at)}`)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {bill.customer?.name ?? (isNl ? 'Loopklant' : 'Walk-in')}
                    {' · '}
                    {Math.round(itemCount)} {isNl ? 'artikel' : 'item'}{itemCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="currency-srd" style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--color-accent)' }}>
                  SRD {total.toFixed(2)}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
