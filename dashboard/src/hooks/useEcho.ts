/**
 * Laravel Echo / Reverb WebSocket hook for the Super Admin Dashboard
 *
 * Provides a singleton Echo instance configured for Reverb.
 * Private channels are authenticated via Sanctum.
 * Reconnects automatically on network drop (Pusher.js handles this).
 */
import { useEffect, useRef } from 'react'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

let echoInstance: Echo<'reverb'> | null = null

function createEchoInstance(): Echo<'reverb'> {
  const token = localStorage.getItem('josbin_pos_dashboard_token')

  return new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY ?? 'josbin_pos-reverb',
    wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
    wsPort: parseInt(import.meta.env.VITE_REVERB_PORT ?? '6001'),
    wssPort: parseInt(import.meta.env.VITE_REVERB_PORT ?? '6001'),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: '/broadcasting/auth',
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  })
}

export function getEcho(): Echo<'reverb'> {
  if (!echoInstance) {
    echoInstance = createEchoInstance()
  }
  return echoInstance
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect()
    echoInstance = null
  }
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Subscribe to an org's private channel for dashboard updates */
export function useOrgChannel(orgId: string | null, handlers: {
  onSaleCompleted?: (data: unknown) => void
  onZReportSubmitted?: (data: unknown) => void
  onStoreStatusChanged?: (data: unknown) => void
  onProductUpdated?: (data: unknown) => void
  onLicenseWarning?: (data: unknown) => void
}) {
  const echo = getEcho()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!orgId) return

    const channel = echo.private(`org.${orgId}`)

    if (handlersRef.current.onSaleCompleted) {
      channel.listen('.sale.completed', handlersRef.current.onSaleCompleted)
    }
    if (handlersRef.current.onZReportSubmitted) {
      channel.listen('.z-report.submitted', handlersRef.current.onZReportSubmitted)
    }
    if (handlersRef.current.onStoreStatusChanged) {
      channel.listen('.store.status', handlersRef.current.onStoreStatusChanged)
    }
    if (handlersRef.current.onProductUpdated) {
      channel.listen('.product.updated', handlersRef.current.onProductUpdated)
    }
    if (handlersRef.current.onLicenseWarning) {
      channel.listen('.license.warning', handlersRef.current.onLicenseWarning)
    }

    return () => {
      echo.leave(`org.${orgId}`)
    }
  }, [echo, orgId])
}

/** Subscribe to the platform-wide super admin channel */
export function usePlatformChannel(handlers: {
  onLicenseWarning?: (data: unknown) => void
  onStoreStatusChanged?: (data: unknown) => void
}) {
  const echo = getEcho()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const channel = echo.private('platform.admin')

    if (handlersRef.current.onLicenseWarning) {
      channel.listen('.license.warning', handlersRef.current.onLicenseWarning)
    }
    if (handlersRef.current.onStoreStatusChanged) {
      channel.listen('.store.status', handlersRef.current.onStoreStatusChanged)
    }

    return () => {
      echo.leave('platform.admin')
    }
  }, [echo])
}
