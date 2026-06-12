import { useTranslation } from 'react-i18next'
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for destructive actions (default true). */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Lightweight confirm dialog for the POS (Electron) frontend — built on the
 * shared Modal so it inherits Escape-to-close + click-outside + focus trap.
 * Replaces the silent data-loss paths (clear cart, restore held bill over a
 * non-empty cart, log out mid-sale) with an explicit yes/no.
 */
export default function ConfirmDialog({
  isOpen, title, message, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            {cancelLabel ?? t('app.cancel')}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              flex: 1, height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: danger ? 'var(--color-error)' : 'var(--color-primary)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)',
            }}
          >
            {confirmLabel ?? t('app.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
