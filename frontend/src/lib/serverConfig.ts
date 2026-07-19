/**
 * Runtime-configurable POS server address.
 *
 * The Electron build bakes VITE_API_URL in at compile time, which made a
 * mis-pointed field install (wrong store-server IP) fixable only with a
 * rebuild. This module lets the till override the server URL at runtime:
 * the override lives in localStorage and wins over the baked env. Every
 * consumer of the API base (axios client, Reverb WS bootstrap, demo
 * banner) reads through getApiBaseUrl() so one override moves them all.
 */

const STORAGE_KEY = 'josbin_server_url'

export function getDefaultApiUrl(): string {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'
}

/** The raw saved override, or null when running on the baked default. */
export function getConfiguredServerUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** What the app actually uses: override first, then the baked env. */
export function getApiBaseUrl(): string {
  return getConfiguredServerUrl() ?? getDefaultApiUrl()
}

/**
 * Normalise operator input to a full API base:
 *  "192.168.0.250:8080"          → "http://192.168.0.250:8080/api"
 *  "http://192.168.0.250:8080/"  → "http://192.168.0.250:8080/api"
 *  "https://pos.example.sr/api"  → unchanged
 * Returns '' for empty/unusable input.
 */
export function normalizeServerUrl(input: string): string {
  let url = (input || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`
  url = url.replace(/\/+$/, '')
  if (!/\/api$/i.test(url)) url = `${url}/api`
  return url
}

export function saveServerUrl(input: string): string {
  const url = normalizeServerUrl(input)
  if (url) localStorage.setItem(STORAGE_KEY, url)
  return url
}

export function clearServerUrl(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export interface ServerTestResult {
  ok: boolean
  detail: string
}

/**
 * Probe {url}/health without touching the shared axios instance (its
 * baseURL is fixed at module init). 5s cap — field networks are slow, but
 * an operator standing at a till shouldn't wait longer for a wrong IP.
 */
export async function testServerUrl(input: string): Promise<ServerTestResult> {
  const base = normalizeServerUrl(input)
  if (!base) return { ok: false, detail: 'empty' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${base}/health`, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    const body = await res.json().catch(() => null)
    if (body?.status === 'ok') return { ok: true, detail: body.timezone ?? 'ok' }
    return { ok: false, detail: 'unexpected response' }
  } catch {
    return { ok: false, detail: 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
