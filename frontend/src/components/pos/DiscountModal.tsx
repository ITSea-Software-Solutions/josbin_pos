import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'
import type { CartDiscount } from '@/types/models'

interface DiscountModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (discount: CartDiscount) => void
  onRemove: () => void
  current: CartDiscount | null
  maxAmount?: number  // for validation
  title?: string
}

export default function DiscountModal({
  isOpen, onClose, onApply, onRemove, current, maxAmount, title,
}: DiscountModalProps) {
  const { t } = useTranslation()

  const [type, setType] = useState<'percent' | 'fixed'>(current?.type ?? 'percent')
  const [value, setValue] = useState(current ? String(current.value) : '')
  const [error, setError] = useState('')

  function reset() {
    setType(current?.type ?? 'percent')
    setValue(current ? String(current.value) : '')
    setError('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleApply() {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) { setError(t('pos.discount.tooHigh')); return }
    if (type === 'percent' && num > 100) { setError(t('pos.discount.tooHigh')); return }
    if (type === 'fixed' && maxAmount !== undefined && num > maxAmount) {
      setError(t('pos.discount.tooHigh'))
      return
    }
    onApply({ type, value: num })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title ?? t('pos.discount.title')} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Type selector */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['percent', 'fixed'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setType(opt)}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 'var(--border-radius)',
                border: type === opt ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                background: type === opt ? 'var(--color-primary)' : 'var(--bg-elevated)',
                color: type === opt ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: type === opt ? 600 : 400,
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {t(`pos.discount.${opt}`)}
            </button>
          ))}
        </div>

        {/* Value input */}
        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            {t('pos.discount.value')}
          </label>
          <input
            type="number"
            min="0"
            step={type === 'percent' ? '1' : '0.01'}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            autoFocus
            style={{
              width: '100%',
              height: 'var(--touch-target)',
              background: 'var(--bg-input)',
              border: `1px solid ${error ? 'var(--color-error)' : 'var(--border-color)'}`,
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-md)',
              fontWeight: 700,
              padding: '0 16px',
              outline: 'none',
            }}
          />
          {error && <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', marginTop: 4 }}>{error}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {current && current.value > 0 && (
            <button
              onClick={() => { onRemove(); onClose() }}
              style={{
                flex: '0 0 auto',
                padding: '0 16px',
                height: 'var(--touch-target)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--color-error)',
                background: 'transparent',
                color: 'var(--color-error)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
              }}
            >
              {t('pos.discount.remove')}
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              flex: 1,
              height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {t('app.cancel')}
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {t('pos.discount.apply')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
