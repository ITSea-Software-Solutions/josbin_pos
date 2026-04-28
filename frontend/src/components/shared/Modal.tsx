import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  isOpen: boolean
  onClose: (() => void) | undefined
  title?: string
  children: React.ReactNode
  width?: number | string
  /** If true, clicking the backdrop does NOT close the modal */
  persistent?: boolean
}

export default function Modal({ isOpen, onClose, title, children, width = 480, persistent = false }: ModalProps) {
  const { t } = useTranslation()
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

  // Focus trap
  useEffect(() => {
    if (isOpen) contentRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={persistent ? undefined : onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        ref={contentRef}
        tabIndex={-1}
        style={{
          position: 'relative',
          zIndex: 1,
          width,
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--border-radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700 }}>{title}</h2>
            {!persistent && (
              <button
                onClick={onClose}
                aria-label={t('app.close')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: 4,
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
