/**
 * Shared toast notifications for the POS terminal.
 *
 * Used to surface errors that previously got swallowed (hold-bill
 * failure, USB-export failure, refund errors). Same API as the
 * dashboard's Toast — kept separate so each app uses its own theme
 * variables and stays bundle-independent.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.error(t('pos.hold_failed'))
 *   toast.success(t('pos.sale_completed'))
 *
 * Mount <ToastProvider> once at the app root.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  ttlMs: number
}

interface ToastAPI {
  success: (message: string, ttlMs?: number) => void
  error: (message: string, ttlMs?: number) => void
  info: (message: string, ttlMs?: number) => void
  warning: (message: string, ttlMs?: number) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastAPI | null>(null)

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string, ttlMs?: number) => {
    const id = nextId++
    // Errors stay 8s (cashier may be mid-customer); success 3.5s; info/warning between.
    const defaultTtl = kind === 'error' ? 8000 : kind === 'warning' ? 6000 : 3500
    setItems((prev) => [...prev, { id, kind, message, ttlMs: ttlMs ?? defaultTtl }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const api: ToastAPI = {
    success: (m, t) => push('success', m, t),
    error:   (m, t) => push('error',   m, t),
    info:    (m, t) => push('info',    m, t),
    warning: (m, t) => push('warning', m, t),
    dismiss,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: 60,           // below POS TopBar
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 400,
        pointerEvents: 'none',
      }}
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (item.ttlMs <= 0) return
    const handle = window.setTimeout(() => onDismiss(item.id), item.ttlMs)
    return () => window.clearTimeout(handle)
  }, [item.id, item.ttlMs, onDismiss])

  const palette = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', accent: '#16a34a', icon: '✓' },
    error:   { bg: '#fef2f2', border: '#fecaca', accent: '#dc2626', icon: '✕' },
    warning: { bg: '#fef3c7', border: '#fde68a', accent: '#92400e', icon: '⚠' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', accent: '#2563eb', icon: 'ℹ' },
  }[item.kind]

  return (
    <div
      role="alert"
      style={{
        pointerEvents: 'auto',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderLeft: `4px solid ${palette.accent}`,
        borderRadius: 10,
        padding: '14px 16px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 14,
        color: '#1c1c2e',
        animation: 'josbin-pos-toast-in 0.18s ease-out',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 24, height: 24, borderRadius: 12,
          background: palette.accent, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14, lineHeight: 1,
        }}
      >
        {palette.icon}
      </span>
      <div style={{ flex: 1, lineHeight: 1.45 }}>{item.message}</div>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#9090a0', fontSize: 18, lineHeight: 1, padding: 0,
          marginLeft: 4,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes josbin-pos-toast-in {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  )
}
