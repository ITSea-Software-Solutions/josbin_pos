/**
 * Pure LAN-discovery helpers — "Find my server".
 *
 * A store server usually lives at 192.168.0.250, but plenty of shop routers
 * hand out 192.168.1.x or 10.0.0.x instead, so the baked address can be
 * unreachable on a fresh field install. The till sweeps its own /24 and
 * finds the server itself.
 *
 * Everything here is pure and synchronous so it can be unit tested. The
 * socket work lives in the Electron main process (electron/main.ts), which
 * imports these helpers — the renderer has no raw sockets.
 */

/** Ports a Josbin server realistically answers on, in probe priority order. */
export const CANDIDATE_PORTS = [8080, 80] as const

/** Addresses tried first inside a /24 — .250 is the install convention. */
const LIKELY_LAST_OCTETS = [250, 1, 2, 10, 100, 200, 251, 252, 254]

// ── Address maths ───────────────────────────────────────────────────────────

/** Dotted quad → unsigned 32-bit int. Returns null for anything malformed. */
export function ipToInt(ip: string): number | null {
  const parts = (ip || '').trim().split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value >>> 0
}

export function intToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.')
}

/** RFC1918 only: 10/8, 172.16/12, 192.168/16. Everything else is skipped. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = (ip || '').split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/** "255.255.255.0" → 24. Null for non-contiguous or malformed masks. */
export function netmaskToPrefix(netmask: string): number | null {
  const value = ipToInt(netmask)
  if (value === null) return null
  if (value === 0) return 0
  // A valid mask is a run of 1s followed by a run of 0s.
  const inverted = ~value >>> 0
  if (((inverted + 1) & inverted) !== 0) return null
  let prefix = 0
  for (let bit = 31; bit >= 0; bit--) {
    if ((value & (1 << bit)) === 0) break
    prefix++
  }
  return prefix
}

// ── Interface → scannable subnet ────────────────────────────────────────────

/** The shape we need out of os.networkInterfaces() entries. */
export interface NetworkInterfaceInfo {
  address: string
  netmask: string
  family?: string | number
  internal?: boolean
}

export interface ScanSubnet {
  /** First three octets, e.g. "192.168.0". We never scan wider than a /24. */
  base: string
  /** The till's own address on this subnet — used for result ordering. */
  selfIp: string
  /** The interface's real prefix length (informational). */
  prefix: number
}

/**
 * Decide whether an interface is worth sweeping, and reduce it to a /24.
 *
 * Skipped: loopback/internal, IPv6, non-RFC1918 (a public or carrier-NAT
 * address means the till is not on a shop LAN — never sweep those), broken
 * masks, and point-to-point links (/31, /32 — typically VPN adapters with no
 * neighbours to find).
 *
 * A /16 or /8 interface is NOT skipped, it is clamped: we only ever sweep the
 * 254 hosts of the /24 the till itself sits in, so the work is bounded no
 * matter how large the broadcast domain is.
 */
export function deriveScanSubnet(iface: NetworkInterfaceInfo): ScanSubnet | null {
  if (!iface || iface.internal) return null
  const family = iface.family
  if (family !== undefined && family !== 'IPv4' && family !== 4) return null
  if (ipToInt(iface.address) === null) return null
  if (!isPrivateIPv4(iface.address)) return null

  const prefix = netmaskToPrefix(iface.netmask)
  if (prefix === null || prefix < 8 || prefix > 30) return null

  return {
    base: iface.address.split('.').slice(0, 3).join('.'),
    selfIp: iface.address,
    prefix,
  }
}

/** Map os.networkInterfaces() to a deduped list of /24s to sweep. */
export function subnetsFromInterfaces(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined>,
): ScanSubnet[] {
  const out: ScanSubnet[] = []
  const seen = new Set<string>()
  for (const list of Object.values(interfaces ?? {})) {
    for (const iface of list ?? []) {
      const subnet = deriveScanSubnet(iface)
      if (!subnet || seen.has(subnet.base)) continue
      seen.add(subnet.base)
      out.push(subnet)
    }
  }
  return out
}

// ── Candidate generation ────────────────────────────────────────────────────

/**
 * All 254 usable hosts of a /24 (.0 network and .255 broadcast excluded),
 * ordered so the conventional server addresses are probed first — with a
 * hard time budget on the sweep, probe order decides what actually gets hit.
 */
export function hostsForSubnet(base: string): string[] {
  const likely = LIKELY_LAST_OCTETS.filter((n) => n >= 1 && n <= 254)
  const rest: number[] = []
  for (let last = 1; last <= 254; last++) {
    if (!likely.includes(last)) rest.push(last)
  }
  return [...likely, ...rest].map((last) => `${base}.${last}`)
}

export interface ProbeTarget {
  ip: string
  port: number
  /** /24 this target came from — carried through to rank results later. */
  base: string
}

/**
 * Flatten subnets × ports into a probe list.
 *
 * Port-major: every host on 8080 first, then everything on 80. A sweep that
 * runs out of its time budget has then at least covered the port the Josbin
 * server actually listens on.
 */
export function buildProbeTargets(
  subnets: ScanSubnet[],
  ports: readonly number[] = CANDIDATE_PORTS,
): ProbeTarget[] {
  const targets: ProbeTarget[] = []
  for (const port of ports) {
    for (const subnet of subnets) {
      for (const ip of hostsForSubnet(subnet.base)) {
        targets.push({ ip, port, base: subnet.base })
      }
    }
  }
  return targets
}

// ── Identifying a Josbin server ─────────────────────────────────────────────

export interface HealthPayload {
  app?: unknown
  status?: unknown
  timezone?: unknown
  app_env?: unknown
}

/**
 * Is this /api/health response a Josbin server?
 *
 * Primary signal is the identity field `app === 'josbin_pos'`. A payload that
 * names some *other* app is rejected outright — an identity claim is stronger
 * evidence than a coincidentally similar shape.
 *
 * Only when there is no `app` field at all do we fall back to the shape
 * (status ok + a timezone): that keeps discovery working against a store
 * server predating this field, which is exactly the old install this feature
 * exists to rescue.
 */
export function isJosbinHealthPayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  const payload = body as HealthPayload
  if (typeof payload.app === 'string' && payload.app.length > 0) return payload.app === 'josbin_pos'
  return payload.status === 'ok' && typeof payload.timezone === 'string' && payload.timezone.length > 0
}

export function healthUrlFor(ip: string, port: number): string {
  return `http://${ip}:${port}/api/health`
}

/** The value handed to the server-config input — already a full API base. */
export function apiBaseFor(ip: string, port: number): string {
  return `http://${ip}:${port}/api`
}

// ── Results ─────────────────────────────────────────────────────────────────

export interface DiscoveredServer {
  /** Full API base, e.g. "http://192.168.0.250:8080/api". */
  url: string
  ip: string
  port: number
  appEnv: string | null
  timezone: string | null
}

/**
 * Dedupe by url and rank: the till's own subnet first (in interface order),
 * then 8080 before 80, then numeric IP order. The operator should see the
 * server on the network they're standing on at the top of the list.
 */
export function rankDiscoveries(
  results: DiscoveredServer[],
  subnetOrder: string[] = [],
  ports: readonly number[] = CANDIDATE_PORTS,
): DiscoveredServer[] {
  const seen = new Set<string>()
  const unique = results.filter((r) => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  const subnetRank = (ip: string) => {
    const base = ip.split('.').slice(0, 3).join('.')
    const index = subnetOrder.indexOf(base)
    return index === -1 ? subnetOrder.length : index
  }
  const portRank = (port: number) => {
    const index = ports.indexOf(port)
    return index === -1 ? ports.length : index
  }

  return unique.sort((a, b) => {
    const bySubnet = subnetRank(a.ip) - subnetRank(b.ip)
    if (bySubnet !== 0) return bySubnet
    const byPort = portRank(a.port) - portRank(b.port)
    if (byPort !== 0) return byPort
    return (ipToInt(a.ip) ?? 0) - (ipToInt(b.ip) ?? 0)
  })
}
