import { apiClient } from './client'

/**
 * POS desktop installer, served by the server this dashboard talks to.
 *
 * On a store install that server sits on the shop LAN, so a manager can add a
 * till with the internet cable unplugged — which is the entire point.
 */

export interface PlatformInstaller {
  filename: string
  size_bytes: number
  updated_at: string
  version: string | null
}

export interface InstallerInfo {
  available: boolean
  reason?: string
  expected_dir?: string
  // Flat fields = the Windows exe (original contract)
  filename?: string
  size_bytes?: number
  updated_at?: string
  version?: string | null
  // APK for Android terminals (Posiflex RT etc.); null when not deployed
  android?: PlatformInstaller | null
}

export async function getInstallerInfo(): Promise<InstallerInfo> {
  const { data } = await apiClient.get<InstallerInfo>('/installer')
  return data
}

/**
 * Download the installer through the authenticated API and hand the bytes to
 * the browser as a file. The token lives in the Authorization header (never in
 * a URL), which is why this can't be a plain <a href> — the trade-off is that
 * the file passes through memory once. Fine for a ~100 MB once-per-till action
 * on a back-office PC.
 */
export async function downloadInstaller(
  filename: string,
  onProgress?: (pct: number | null) => void,
  platform: 'windows' | 'android' = 'windows',
): Promise<void> {
  const res = await apiClient.get('/installer/download', {
    params: { platform },
    responseType: 'blob',
    timeout: 0, // large file over a shop LAN — no client-side deadline
    onDownloadProgress: (e) => {
      if (!onProgress) return
      // total is absent when the server streams without a length header
      onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : null)
    },
  })

  const url = URL.createObjectURL(res.data as Blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start writing before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * The address a till must be pointed at, derived from whatever this dashboard
 * is talking to. `http://192.168.0.250:8080/api` → `192.168.0.250:8080` — the
 * exact string the POS ⚙ Server field expects (it adds scheme and /api back).
 */
export function posServerAddress(): string {
  const base = apiClient.defaults.baseURL ?? ''
  const absolute = base.startsWith('http')
    ? base
    : `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}`

  try {
    const u = new URL(absolute)
    return u.host
  } catch {
    return absolute.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '')
  }
}
