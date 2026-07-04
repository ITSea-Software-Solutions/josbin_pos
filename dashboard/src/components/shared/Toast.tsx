/**
 * Shared toast notifications for the dashboard.
 *
 * Why: ~10 places across the dashboard either silently swallow errors
 * (`// TODO toast`) or render raw 500 strings. The audit flagged this
 * as a P1 UX issue — silent failure in compliance-critical paths
 * (USB export, hold-bill) misleads the operator into thinking the
 * action succeeded.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.error('Could not save customer')
 *   toast.success('Receipt sent')
 *   toast.info('Sync started in background')
 *
 * Mount <ToastProvider> once near the top of the app tree.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  // Auto-dismiss after N ms. 0 = sticky until user closes.
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
    // Errors stick longer; warnings medium; success/info shorter.
    const defaultTtl = kind === 'error' ? 8000 : kind === 'warning' ? 6000 : 4000
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
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
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
        padding: '12px 14px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.10)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        fontSize: 13,
        color: '#16203a',
        animation: 'josbin-toast-in 0.18s ease-out',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 22, height: 22, borderRadius: 11,
          background: palette.accent, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, lineHeight: 1,
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
          color: '#7e88a0', fontSize: 16, lineHeight: 1, padding: 0,
          marginLeft: 4,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes josbin-toast-in {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  )
}
