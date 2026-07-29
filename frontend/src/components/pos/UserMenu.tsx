import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The cashier's own corner of the top bar.
 *
 * Name, switch-store and log out used to sit loose at the end of the row.
 * On a 1024- or 1280-wide till — which is most of them — the row ran past the
 * screen edge and took log out with it, so the one control a cashier needs at
 * the end of a shift was the one they could not reach. Collapsing it behind
 * the name costs one tap and always fits.
 */

const LANGS: Array<{ code: string; label: string }> = [
  { code: 'nl',  label: 'NL' },
  { code: 'en',  label: 'EN' },
  { code: 'srn', label: 'SRN' },
]

interface Props {
  name: string
  /** Shown under the name in the menu so a shared terminal makes it obvious
   *  who is actually signed in. */
  roleLabel?: string
  storeName?: string
  language: string
  onSetLanguage: (code: string) => void
  /** Windows-only on-screen keyboard. Omitted on Android and in the browser,
   *  where the system keyboard already appears on focus. */
  keyboardOpen?: boolean
  onToggleKeyboard?: () => void
  onSwitchStore: () => void
  /** Present only while a register session is open. */
  onCloseRegister?: () => void
  onLogout: () => void
}

export default function UserMenu({
  name, roleLabel, storeName, language, onSetLanguage,
  keyboardOpen, onToggleKeyboard, onSwitchStore, onCloseRegister, onLogout,
}: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape. A till is a touch screen first, so
  // tapping anywhere else has to dismiss this — there is no stray keyboard to
  // fall back on.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = name
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'

  const item: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 14px', background: 'none', border: 'none',
    textAlign: 'left', cursor: 'pointer',
    fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        data-testid="user-menu-trigger"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 34, padding: '0 10px 0 4px',
          background: open ? 'var(--bg-elevated)' : 'none',
          border: '1px solid var(--border-color)',
          borderRadius: 20, cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)',
        }}
      >
        <span style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'var(--color-primary)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, letterSpacing: '.02em',
        }}>{initials}</span>
        {/* The name is the first thing to go when the row gets tight — the
            avatar alone still identifies who is signed in. */}
        <span className="user-menu-name" style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60,
            minWidth: 220,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            boxShadow: '0 12px 32px rgba(0,0,0,.28)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{name}</div>
            {roleLabel && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{roleLabel}</div>
            )}
            {storeName && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📍 {storeName}</div>
            )}
          </div>

          {/* Language lives here rather than in the bar: it is set once per
              cashier, not per sale, and the bar has no room to spare. All
              three are offered — the old bar toggle only ever flipped between
              two, so Sranantongo was unreachable outside Settings. */}
          <div style={{ ...item, cursor: 'default', gap: 8 }}>
            <span style={{ width: 18, textAlign: 'center' }}>🌐</span>
            <span style={{ display: 'flex', gap: 4 }}>
              {LANGS.map((l) => {
                const active = language.startsWith(l.code)
                return (
                  <button
                    key={l.code}
                    onClick={() => onSetLanguage(l.code)}
                    style={{
                      padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      color: active ? '#fff' : 'var(--text-secondary)',
                    }}
                  >{l.label}</button>
                )
              })}
            </span>
          </div>

          {onToggleKeyboard && (
            <button role="menuitem" style={item} onClick={() => { setOpen(false); onToggleKeyboard() }}>
              <span style={{ width: 18, textAlign: 'center' }}>⌨</span>
              {t('pos.userMenu.keyboard')}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: keyboardOpen ? 'var(--color-primary)' : 'var(--text-muted)', fontWeight: 700 }}>
                {keyboardOpen ? t('common.on') : t('common.off')}
              </span>
            </button>
          )}

          <button role="menuitem" style={item} onClick={() => { setOpen(false); onSwitchStore() }}>
            <span style={{ width: 18, textAlign: 'center' }}>⇄</span>
            {t('pos.userMenu.switchStore')}
          </button>

          {onCloseRegister && (
            <button
              role="menuitem"
              data-testid="user-menu-close-register"
              style={{ ...item, color: 'var(--color-danger)', borderTop: '1px solid var(--border-color)' }}
              onClick={() => { setOpen(false); onCloseRegister() }}
            >
              <span style={{ width: 18, textAlign: 'center' }}>🔒</span>
              {t('pos.closeRegister.action')}
            </button>
          )}

          <button
            role="menuitem"
            data-testid="user-menu-logout"
            style={{ ...item, color: 'var(--color-danger)', fontWeight: 700, borderTop: '1px solid var(--border-color)' }}
            onClick={() => { setOpen(false); onLogout() }}
          >
            <span style={{ width: 18, textAlign: 'center' }}>⎋</span>
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  )
}
