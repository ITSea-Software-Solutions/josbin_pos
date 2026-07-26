import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BtwExemptModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (reason: string) => void
}

/**
 * Sale-level BTW exemption (vrijstelling) — e.g. a government department
 * that does not pay the tax. The reason is MANDATORY (backend enforces
 * min 5 chars): it goes on the sale, the receipt and the audit trail, so
 * Belastingdienst can always see why a sale carried no BTW.
 */
export default function BtwExemptModal({ isOpen, onClose, onApply }: BtwExemptModalProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')

  if (!isOpen) return null

  // Common Suriname exemption grounds as one-tap starters; the cashier
  // completes the specifics (department name, order ref) in the text box.
  const quickReasons = [
    t('pos.btwExempt.reasonGovernment'),
    t('pos.btwExempt.reasonDiplomatic'),
    t('pos.btwExempt.reasonExport'),
  ]

  const valid = reason.trim().length >= 5

  function apply() {
    if (!valid) return
    onApply(reason.trim())
    setReason('')
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '92vw', background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
          🏛 {t('pos.btwExempt.title')}
        </h3>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          {t('pos.btwExempt.explain')}
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickReasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r + ' — ')}
              style={{
                padding: '8px 12px', borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <div>
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            {t('pos.btwExempt.reasonLabel')} *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('pos.btwExempt.reasonPlaceholder')}
            rows={3}
            autoFocus
            data-testid="btw-exempt-reason"
            style={{
              width: '100%', background: 'var(--bg-input)', resize: 'vertical',
              border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
              color: 'var(--text-primary)', padding: '10px 14px',
              fontSize: 'var(--font-size-base)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {!valid && reason.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>
              {t('pos.btwExempt.reasonTooShort')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              height: 44, padding: '0 18px', borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-base)',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={apply}
            disabled={!valid}
            data-testid="btw-exempt-apply"
            style={{
              height: 44, padding: '0 18px', borderRadius: 'var(--border-radius)',
              border: 'none', background: valid ? 'var(--color-primary)' : 'var(--bg-input)',
              color: valid ? '#fff' : 'var(--text-muted)',
              cursor: valid ? 'pointer' : 'not-allowed', fontWeight: 700,
              fontSize: 'var(--font-size-base)',
            }}
          >
            {t('pos.btwExempt.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
