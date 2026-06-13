import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import Modal from '@/components/shared/Modal'
import { recordCashMovement } from '@/api/registers'

function errMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { message?: string } | undefined
    return d?.message ?? err.message
  }
  return err instanceof Error ? err.message : 'Error'
}

interface CashMovementModalProps {
  isOpen: boolean
  onClose: () => void
  sessionId: string
}

/**
 * Cashier records a manual drawer movement on the open session:
 *   In  — cash added to the till (change top-up, owner float)
 *   Out — cash removed (supplier paid from till, delivery tip)
 * Adjusts the register's expected cash for the Z-Report reconciliation.
 */
export default function CashMovementModal({ isOpen, onClose, sessionId }: CashMovementModalProps) {
  const { t } = useTranslation()
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => recordCashMovement(sessionId, direction, parseFloat(amount), reason.trim()),
    onSuccess: (res) => {
      setDone(res.expected_cash)
      setAmount(''); setReason('')
    },
  })

  const amt = parseFloat(amount)
  const valid = !Number.isNaN(amt) && amt > 0 && reason.trim().length >= 2

  function close() {
    setDone(null); setAmount(''); setReason(''); mutation.reset()
    onClose()
  }

  const dirBtn = (d: 'in' | 'out', label: string, color: string) => (
    <button
      onClick={() => setDirection(d)}
      style={{
        flex: 1, height: 'var(--touch-target)', borderRadius: 'var(--border-radius)',
        border: `2px solid ${direction === d ? color : 'var(--border-color)'}`,
        background: direction === d ? color : 'var(--bg-elevated)',
        color: direction === d ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)',
      }}
    >
      {label}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('pos.cashMovement.title')} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {done !== null ? (
          <>
            <div style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>
              ✓ {t('pos.cashMovement.recorded')}
            </div>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {t('pos.cashMovement.newExpected')}: <strong className="currency-srd">SRD {done}</strong>
            </div>
            <button onClick={close} style={primaryBtn}>{t('app.close')}</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {dirBtn('in', `↓ ${t('pos.cashMovement.payIn')}`, 'var(--color-success)')}
              {dirBtn('out', `↑ ${t('pos.cashMovement.payOut')}`, 'var(--color-error)')}
            </div>

            <label style={labelStyle}>{t('pos.cashMovement.amount')} (SRD)</label>
            <input
              type="number" inputMode="decimal" min="0" step="0.01" autoFocus
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />

            <label style={labelStyle}>{t('pos.cashMovement.reason')}</label>
            <input
              value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255}
              placeholder={t('pos.cashMovement.reasonPlaceholder')}
              style={inputStyle}
            />

            {mutation.isError && (
              <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                {errMessage(mutation.error)}
              </div>
            )}

            <button
              onClick={() => mutation.mutate()}
              disabled={!valid || mutation.isPending}
              style={{ ...primaryBtn, opacity: !valid || mutation.isPending ? 0.5 : 1 }}
            >
              {mutation.isPending ? '⏳' : t('pos.cashMovement.record')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }
const inputStyle: React.CSSProperties = {
  height: 'var(--touch-target)', borderRadius: 'var(--border-radius)',
  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', padding: '0 12px', fontSize: 'var(--font-size-base)',
}
const primaryBtn: React.CSSProperties = {
  height: 'var(--touch-target)', borderRadius: 'var(--border-radius)', border: 'none',
  background: 'var(--color-primary)', color: '#fff', cursor: 'pointer',
  fontWeight: 700, fontSize: 'var(--font-size-sm)',
}
