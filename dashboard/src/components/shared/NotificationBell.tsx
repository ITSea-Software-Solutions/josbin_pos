import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/api/notifications'

interface Props {
  /** Accent for the unread badge + header (theme-aware: green for tax portal). */
  accent?: string
  /** Called when a notification is clicked — host decides where to navigate. */
  onNavigate: (n: AppNotification) => void
}

/** Compact relative-time label, bilingual. */
function relTime(iso: string | null, nl: boolean): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return nl ? 'zojuist' : 'just now'
  if (m < 60) return `${m} ${nl ? 'min' : 'min'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${nl ? 'u' : 'h'}`
  const d = Math.floor(h / 24)
  return `${d} ${nl ? 'd' : 'd'}`
}

function dotColor(type?: string): string {
  if (type === 'btw_disputed') return '#c8102e'
  if (type === 'btw_accepted') return '#1f9d55'
  if (type === 'btw_resubmitted') return '#d97706'
  return '#6366f1'
}

export default function NotificationBell({ accent = '#6366f1', onNavigate }: Props) {
  const { i18n } = useTranslation()
  const nl = i18n.language === 'nl'
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 60000,        // poll every 60s
    refetchOnWindowFocus: true,
    staleTime: 30000,
  })

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = data?.data ?? []
  const unread = data?.unread_count ?? 0

  function handleClick(n: AppNotification) {
    if (!n.read_at) readOne.mutate(n.id)
    setOpen(false)
    onNavigate(n)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        aria-label={nl ? 'Meldingen' : 'Notifications'}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', width: 38, height: 38, borderRadius: 10,
          border: '1px solid #e9e9ef', background: open ? '#f5f5f8' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4b4b5e',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f8' }}
        onMouseLeave={e => { e.currentTarget.style.background = open ? '#f5f5f8' : '#fff' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 19, height: 19 }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 3, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 9, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            boxShadow: '0 0 0 2px #fff',
          }}>{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 46, width: 360, maxWidth: '90vw',
          background: '#fff', borderRadius: 14, border: '1px solid #e9e9ef',
          boxShadow: '0 12px 40px rgba(0,0,0,0.16)', zIndex: 1000, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', borderBottom: '1px solid #f0f0f4',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>
              {nl ? 'Meldingen' : 'Notifications'}
            </span>
            {unread > 0 && (
              <button
                onClick={() => readAll.mutate()}
                disabled={readAll.isPending}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: accent }}
              >
                {nl ? 'Alles als gelezen' : 'Mark all read'}
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ padding: '36px 16px', textAlign: 'center', color: '#9090a0', fontSize: 13 }}>
                {nl ? 'Geen meldingen' : 'No notifications'}
              </div>
            )}
            {items.map(n => {
              const title = n.data.title?.[nl ? 'nl' : 'en'] ?? ''
              const message = n.data.message?.[nl ? 'nl' : 'en'] ?? ''
              const unreadItem = !n.read_at
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', gap: 11, width: '100%', textAlign: 'left',
                    padding: '12px 16px', border: 'none', borderBottom: '1px solid #f4f4f8',
                    background: unreadItem ? '#f7faff' : '#fff', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f2f7' }}
                  onMouseLeave={e => { e.currentTarget.style.background = unreadItem ? '#f7faff' : '#fff' }}
                >
                  <span style={{
                    flexShrink: 0, width: 8, height: 8, borderRadius: '50%', marginTop: 6,
                    background: unreadItem ? dotColor(n.data.type) : '#d4d4dd',
                  }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1c1c2e' }}>{title}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5b5b6e', marginTop: 2, lineHeight: 1.4 }}>{message}</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#9b9bab', marginTop: 4 }}>{relTime(n.created_at, nl)}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
