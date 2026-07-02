import { useEffect, useState } from 'react'

/**
 * Reports raw browser connectivity via `navigator.onLine`, kept live with the
 * window `online` / `offline` events.
 *
 * HONEST SCOPE: the POS does not (yet) maintain a client-side outbox with a
 * queued-transaction count or a last-sync timestamp — sales POST straight to
 * the local Laravel server, and the five-layer sync fallback + Z-Report
 * `sync_status` live server-side. So this hook only surfaces network reach,
 * not a fabricated "N queued" figure. When a real client outbox lands, the
 * TopBar pill can be upgraded to 🟡 N queued without touching this hook's
 * consumers beyond the count.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
