/**
 * Styled confirm dialog — replaces `confirm()` across the dashboard.
 *
 * Why: browser `confirm()` is unstyled, inconsistent with our chrome,
 * blocks the event loop, and breaks in some Electron contexts. The
 * audit flagged this for UsersScreen / OrganisationsScreen /
 * CatalogueScreen / ApiKeysScreen / DiscountRulesScreen /
 * PriceOverridesScreen.
 *
 * Usage — controlled (state-driven) pattern:
 *   const [confirmDeact, setConfirmDeact] = useState<User | null>(null)
 *   ...
 *   <ConfirmDialog
 *     isOpen={confirmDeact !== null}
 *     onCancel={() => setConfirmDeact(null)}
 *     onConfirm={() => { mutate(confirmDeact!.id); setConfirmDeact(null) }}
 *     title={isNl ? 'Deactiveren?' : 'Deactivate?'}
 *     message={`${confirmDeact?.name} kan niet meer inloggen.`}
 *     confirmLabel={isNl ? 'Deactiveer' : 'Deactivate'}
 *     tone="danger"
 *   />
 *
 * Always surface a *consequence*, not just the verb. "Deactivate?" tells
 * the user nothing; "3 cashiers will lose POS access" tells them what
 * happens.
 */
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void

  title: string
  /** One-line summary of the *consequence* of confirming. */
  message: string
  /** Optional secondary detail (e.g. list of affected users). */
  detail?: React.ReactNode

  confirmLabel?: string
  cancelLabel?: string

  /** Visual: 'danger' for destructive (red), 'warning' for caution. */
  tone?: 'danger' | 'warning' | 'default'

  /** Disable confirm button while async work in flight. */
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen, onCancel, onConfirm,
  title, message, detail,
  confirmLabel, cancelLabel,
  tone = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const accent = {
    danger:  { bg: '#dc2626', hover: '#b91c1c', tint: 'danger'  as const, ring: 'rgba(220,38,38,0.30)' },
    warning: { bg: '#d97706', hover: '#b45309', tint: 'warning' as const, ring: 'rgba(217,119,6,0.30)' },
    default: { bg: '#293371', hover: '#1e2657', tint: 'default' as const, ring: 'rgba(41,51,113,0.30)' },
  }[tone]

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onCancel}
      title={title}
      width={460}
      persistent={loading}
      tone={accent.tint}
    >
      <div style={{ padding: '20px 22px' }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#374151' }}>
          {message}
        </p>
        {detail && (
          <div style={{ marginTop: 14, fontSize: 13, color: '#6b7280', background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 10, padding: '12px 14px' }}>
            {detail}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px',
          borderTop: '1px solid #f1f1f8',
          background: '#fafbff',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: '#fff', color: '#374151',
            border: '1px solid #e5e7eb',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {cancelLabel ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: accent.bg, color: '#fff',
            border: 'none',
            cursor: loading ? 'progress' : 'pointer',
            boxShadow: `0 2px 10px ${accent.ring}`,
            opacity: loading ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.background = accent.hover) }}
          onMouseLeave={(e) => { if (!loading) (e.currentTarget.style.background = accent.bg) }}
        >
          {loading && (
            <span
              aria-hidden
              style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                animation: 'josbin-spin 0.7s linear infinite',
              }}
            />
          )}
          {confirmLabel ?? 'Confirm'}
        </button>
      </div>

      <style>{`
        @keyframes josbin-spin { to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  )
}
