import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import ServerConfigModal from '@/components/shared/ServerConfigModal'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useRegisterStore } from '@/store/registerStore'
import { useSettingsStore } from '@/store/settingsStore'
import { getApiBaseUrl, getConfiguredServerUrl } from '@/lib/serverConfig'
import { getZReportHistory } from '@/api/reports'

const MANAGER_ROLES = ['store_manager', 'organisation_admin', 'super_admin']

type Action = 'quit' | 'restart'

/**
 * Settings → System section.
 *
 * Lets a manager-or-above close or restart the Electron POS app from inside
 * the UI (touchscreen-friendly — no reaching for the OS title bar).
 *
 * Safety pipeline before the action fires:
 *   1. Block if cart has items (cashier might lose work)
 *   2. Warn if register session is still open (soft — manager can override)
 *   3. Block if any Z-Report is pending sync (data loss risk on offline+restart)
 *   4. Final confirm modal
 *
 * Web/Capacitor: section is hidden (no app.quit equivalent that makes UX sense).
 */
export function SystemActions() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const cartCount = useCartStore((s) => s.items.length)
  const session = useRegisterStore((s) => s.session)
  const storeId = useSettingsStore((s) => s.storeId)

  const [version, setVersion] = useState<string>('—')
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoLaunch, setAutoLaunchState] = useState<boolean | null>(null)
  const [showServer, setShowServer] = useState(false)

  // Pull app version + current auto-launch state once
  useEffect(() => {
    window.josbin_pos?.getVersion().then(setVersion).catch(() => setVersion('—'))
    window.josbin_pos?.getAutoLaunch?.().then(setAutoLaunchState).catch(() => setAutoLaunchState(null))
  }, [])

  async function toggleAutoLaunch(next: boolean) {
    const applied = await window.josbin_pos.setAutoLaunch(next)
    setAutoLaunchState(applied)
  }

  // Z-Reports awaiting sync — block close/restart if any
  const { data: zReports } = useQuery({
    queryKey: ['z-report-history', storeId],
    queryFn: () => getZReportHistory(storeId!),
    enabled: !!storeId,
    staleTime: 30_000,
  })
  const pendingSyncCount = (zReports ?? []).filter((z) => z.sync_status === 'pending').length

  // Hide entirely on non-Electron platforms (web preview, Android)
  if (typeof window === 'undefined' || !window.josbin_pos?.quit) return null

  // Hide entirely for cashier
  if (!role || !MANAGER_ROLES.includes(role)) return null

  const cartHasItems = cartCount > 0
  const registerOpen = session?.status === 'open'

  async function execute() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending === 'quit') await window.josbin_pos.quit()
      else                    await window.josbin_pos.restart()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const blockReason =
    cartHasItems       ? t('settings.system.blockCart',    { count: cartCount }) :
    pendingSyncCount   ? t('settings.system.blockSync',    { count: pendingSyncCount }) :
    null

  const sectionSt: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16,
  }

  return (
    <>
      <div style={sectionSt}>
        <div>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>
            {t('settings.system.title')}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {t('settings.system.subtitle', { version })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPending('restart')}
            data-testid="btn-restart-app"
            style={{
              flex: 1, minWidth: 160, height: 44,
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            🔄  {t('settings.system.restart')}
          </button>
          <button
            onClick={() => setPending('quit')}
            data-testid="btn-quit-app"
            style={{
              flex: 1, minWidth: 160, height: 44,
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--color-error)',
              background: 'var(--bg-input)', color: 'var(--color-error)',
              cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            🚪  {t('settings.system.quit')}
          </button>
        </div>

        {/* Auto-launch toggle — only meaningful in Electron builds */}
        {autoLaunch !== null && (
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => toggleAutoLaunch(e.target.checked)}
              data-testid="chk-auto-launch"
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                {t('settings.system.autoLaunch')}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                {t('settings.system.autoLaunchHelp')}
              </p>
            </div>
          </label>
        )}

        {/* Store-server address — the till's API endpoint. Changing it
            restarts the app; the login-screen ⚙ Server gear is the same
            control for pre-login (fresh install) situations. */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              {t('pos.serverConfig.title')}
              {getConfiguredServerUrl() !== null && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--color-warning)' }}>
                  ({t('pos.serverConfig.overrideBadge')})
                </span>
              )}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getApiBaseUrl()}
            </p>
          </div>
          <button
            onClick={() => setShowServer(true)}
            data-testid="btn-change-server"
            style={{
              height: 36, padding: '0 14px',
              borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            {t('app.edit')}
          </button>
        </div>
      </div>

      <ServerConfigModal isOpen={showServer} onClose={() => setShowServer(false)} />

      {pending && (
        <ConfirmModal
          action={pending}
          blockReason={blockReason}
          warning={registerOpen ? t('settings.system.warnRegisterOpen') : null}
          busy={busy}
          error={error}
          onCancel={() => { if (!busy) { setPending(null); setError(null) } }}
          onConfirm={execute}
        />
      )}
    </>
  )
}

function ConfirmModal(props: {
  action: Action
  blockReason: string | null
  warning: string | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { action, blockReason, warning, busy, error, onCancel, onConfirm } = props
  const titleKey = action === 'quit' ? 'settings.system.confirmQuitTitle' : 'settings.system.confirmRestartTitle'
  const bodyKey  = action === 'quit' ? 'settings.system.confirmQuitBody'  : 'settings.system.confirmRestartBody'

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,30,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16, backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
        padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,.22)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t(titleKey)}</h3>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t(bodyKey)}
        </p>

        {blockReason && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--border-radius)',
            background: 'rgba(239,68,68,.1)', border: '1px solid var(--color-error)',
            color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5,
          }}>
            {blockReason}
          </div>
        )}

        {!blockReason && warning && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--border-radius)',
            background: 'rgba(245,158,11,.1)', border: '1px solid #f59e0b',
            color: '#92400e', fontSize: 'var(--font-size-sm)', lineHeight: 1.5,
          }}>
            ⚠️  {warning}
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          <button
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, height: 44, borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!!blockReason || busy}
            data-testid="btn-confirm-system-action"
            style={{
              flex: 1, height: 44, borderRadius: 'var(--border-radius)',
              border: 'none',
              background: blockReason ? 'var(--bg-input)' : 'var(--color-error)',
              color: blockReason ? 'var(--text-secondary)' : '#fff',
              cursor: blockReason || busy ? 'not-allowed' : 'pointer',
              fontWeight: 700,
            }}
          >
            {busy ? '…' : action === 'quit' ? t('settings.system.quit') : t('settings.system.restart')}
          </button>
        </div>
      </div>
    </div>
  )
}
