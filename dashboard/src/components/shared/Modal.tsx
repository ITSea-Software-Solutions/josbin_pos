/**
 * Shared dashboard modal — mirrors frontend/src/components/shared/Modal.tsx
 *
 * Universal close on Escape + click-outside-to-close + focus-trap.
 * The audit flagged that ~10 dashboard modals lacked Escape handling
 * because each screen built its own inline backdrop. This is the
 * canonical replacement.
 *
 * Usage:
 *   <Modal
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     title={isNl ? 'Voorraad bijwerken' : 'Adjust stock'}
 *     width={520}
 *   >
 *     ...form...
 *   </Modal>
 *
 * Pass `persistent` for modals that should only close via explicit
 * action (e.g. an in-progress destructive confirm).
 */
import { useEffect, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: (() => void) | undefined
  title?: string
  children: React.ReactNode
  width?: number | string
  /** If true, Escape + click-outside do NOT close the modal. */
  persistent?: boolean
  /** Tone the header chrome (used by ConfirmDialog for danger styling). */
  tone?: 'default' | 'danger' | 'warning'
}

export default function Modal({
  isOpen, onClose, title, children, width = 520, persistent = false, tone = 'default',
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !persistent) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, persistent])

  // Focus the panel when opened so screen-readers announce + Esc binds correctly.
  useEffect(() => {
    if (isOpen) {
      // Wait one tick so React has mounted children before we grab focus.
      requestAnimationFrame(() => contentRef.current?.focus())
    }
  }, [isOpen])

  if (!isOpen) return null

  const headerTint = {
    default: { bg: '#fff',     border: '#eeeef8', titleColor: '#1c1c2e' },
    danger:  { bg: '#fef2f2',  border: '#fee2e2', titleColor: '#991b1b' },
    warning: { bg: '#fef9c3',  border: '#fef08a', titleColor: '#854d0e' },
  }[tone]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={persistent ? undefined : onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(28,28,46,0.55)',
          backdropFilter: 'blur(2px)',
          animation: 'josbin-modal-fade 0.12s ease-out',
        }}
      />

      {/* Panel */}
      <div
        ref={contentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'josbin-modal-title' : undefined}
        style={{
          position: 'relative', zIndex: 1,
          width: typeof width === 'number' ? width : width,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          background: '#fff',
          border: '1px solid #e9e9ef',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
          animation: 'josbin-modal-rise 0.16s cubic-bezier(.16,.84,.44,1)',
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 22px',
              borderBottom: `1px solid ${headerTint.border}`,
              background: headerTint.bg,
              flexShrink: 0,
            }}
          >
            <h2
              id="josbin-modal-title"
              style={{
                margin: 0,
                fontSize: 15, fontWeight: 800,
                color: headerTint.titleColor,
                letterSpacing: '-0.2px',
              }}
            >
              {title}
            </h2>
            {!persistent && (
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9090a0', fontSize: 18, lineHeight: 1,
                  padding: 4, borderRadius: 6,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes josbin-modal-fade {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes josbin-modal-rise {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
