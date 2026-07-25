import { describe, it, expect } from 'vitest'
import {
  CANDIDATE_PORTS,
  apiBaseFor,
  buildProbeTargets,
  deriveScanSubnet,
  healthUrlFor,
  hostsForSubnet,
  intToIp,
  ipToInt,
  isJosbinHealthPayload,
  isPrivateIPv4,
  netmaskToPrefix,
  rankDiscoveries,
  subnetsFromInterfaces,
  type DiscoveredServer,
  type NetworkInterfaceInfo,
} from '../lan'

// Pure logic behind the "Find my server" LAN sweep. The socket work lives in
// electron/main.ts and is deliberately not covered here.

describe('ipToInt / intToIp', () => {
  it('round-trips a dotted quad', () => {
    expect(ipToInt('192.168.0.250')).toBe(3232235770)
    expect(intToIp(3232235770)).toBe('192.168.0.250')
    expect(intToIp(ipToInt('10.0.0.1')!)).toBe('10.0.0.1')
  })

  it('handles the edges', () => {
    expect(ipToInt('0.0.0.0')).toBe(0)
    expect(ipToInt('255.255.255.255')).toBe(4294967295)
    expect(intToIp(4294967295)).toBe('255.255.255.255')
  })

  it('rejects malformed input instead of guessing', () => {
    expect(ipToInt('192.168.0')).toBeNull()
    expect(ipToInt('192.168.0.256')).toBeNull()
    expect(ipToInt('192.168.0.1.1')).toBeNull()
    expect(ipToInt('192.168.0.x')).toBeNull()
    expect(ipToInt('')).toBeNull()
    expect(ipToInt('fe80::1')).toBeNull()
  })
})

describe('isPrivateIPv4 (RFC1918 filter)', () => {
  it('accepts the three private ranges', () => {
    expect(isPrivateIPv4('192.168.0.250')).toBe(true)
    expect(isPrivateIPv4('192.168.1.10')).toBe(true)
    expect(isPrivateIPv4('10.0.0.5')).toBe(true)
    expect(isPrivateIPv4('10.255.255.254')).toBe(true)
    expect(isPrivateIPv4('172.16.0.1')).toBe(true)
    expect(isPrivateIPv4('172.31.255.254')).toBe(true)
  })

  it('rejects public, link-local, loopback and the 172 near-misses', () => {
    expect(isPrivateIPv4('172.15.0.1')).toBe(false)
    expect(isPrivateIPv4('172.32.0.1')).toBe(false)
    expect(isPrivateIPv4('142.93.88.143')).toBe(false) // the demo droplet — never sweep the internet
    expect(isPrivateIPv4('169.254.10.5')).toBe(false)  // APIPA, no DHCP
    expect(isPrivateIPv4('100.64.0.1')).toBe(false)    // carrier-grade NAT
    expect(isPrivateIPv4('127.0.0.1')).toBe(false)
    expect(isPrivateIPv4('not-an-ip')).toBe(false)
  })
})

describe('netmaskToPrefix', () => {
  it('converts the common masks', () => {
    expect(netmaskToPrefix('255.255.255.0')).toBe(24)
    expect(netmaskToPrefix('255.255.0.0')).toBe(16)
    expect(netmaskToPrefix('255.0.0.0')).toBe(8)
    expect(netmaskToPrefix('255.255.255.252')).toBe(30)
    expect(netmaskToPrefix('255.255.255.255')).toBe(32)
    expect(netmaskToPrefix('0.0.0.0')).toBe(0)
  })

  it('rejects non-contiguous or malformed masks', () => {
    expect(netmaskToPrefix('255.0.255.0')).toBeNull()
    expect(netmaskToPrefix('255.255.255')).toBeNull()
    expect(netmaskToPrefix('banana')).toBeNull()
  })
})

describe('deriveScanSubnet', () => {
  it('derives the /24 of a normal shop LAN interface', () => {
    expect(deriveScanSubnet({ address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4' }))
      .toEqual({ base: '192.168.1', selfIp: '192.168.1.42', prefix: 24 })
  })

  it('clamps a wide private subnet to the /24 the till sits in', () => {
    // A 10.x/8 office network is 16 million hosts — we only ever sweep 10.0.0.x.
    expect(deriveScanSubnet({ address: '10.0.0.7', netmask: '255.0.0.0', family: 'IPv4' }))
      .toEqual({ base: '10.0.0', selfIp: '10.0.0.7', prefix: 8 })
    expect(deriveScanSubnet({ address: '172.20.5.9', netmask: '255.255.0.0', family: 'IPv4' }))
      .toEqual({ base: '172.20.5', selfIp: '172.20.5.9', prefix: 16 })
  })

  it('skips loopback, IPv6, public and link-local interfaces', () => {
    expect(deriveScanSubnet({ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true })).toBeNull()
    expect(deriveScanSubnet({ address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6' })).toBeNull()
    expect(deriveScanSubnet({ address: '142.93.88.143', netmask: '255.255.240.0', family: 'IPv4' })).toBeNull()
    expect(deriveScanSubnet({ address: '169.254.3.4', netmask: '255.255.0.0', family: 'IPv4' })).toBeNull()
  })

  it('skips point-to-point links and broken masks', () => {
    expect(deriveScanSubnet({ address: '10.8.0.2', netmask: '255.255.255.255', family: 'IPv4' })).toBeNull() // VPN /32
    expect(deriveScanSubnet({ address: '10.8.0.2', netmask: '255.255.255.254', family: 'IPv4' })).toBeNull() // /31
    expect(deriveScanSubnet({ address: '192.168.0.5', netmask: '255.0.255.0', family: 'IPv4' })).toBeNull()
  })

  it('accepts an interface with no family field (older Node shapes)', () => {
    expect(deriveScanSubnet({ address: '192.168.0.5', netmask: '255.255.255.0' })?.base).toBe('192.168.0')
  })
})

describe('subnetsFromInterfaces', () => {
  const interfaces: Record<string, NetworkInterfaceInfo[]> = {
    lo0:   [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
    en0:   [
      { address: 'fe80::c1a', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6' },
      { address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4' },
    ],
    en1:   [{ address: '10.0.0.7', netmask: '255.255.255.0', family: 'IPv4' }],
    // Second address on the same /24 — one sweep is enough.
    en2:   [{ address: '192.168.1.99', netmask: '255.255.255.0', family: 'IPv4' }],
    ppp0:  [{ address: '196.20.1.9', netmask: '255.255.255.0', family: 'IPv4' }], // 4G dongle, public
  }

  it('keeps only private /24s, deduped, in interface order', () => {
    expect(subnetsFromInterfaces(interfaces).map((s) => s.base)).toEqual(['192.168.1', '10.0.0'])
  })

  it('returns nothing when the till has no private IPv4 interface', () => {
    expect(subnetsFromInterfaces({ lo0: interfaces.lo0, ppp0: interfaces.ppp0 })).toEqual([])
    expect(subnetsFromInterfaces({})).toEqual([])
  })
})

describe('hostsForSubnet', () => {
  const hosts = hostsForSubnet('192.168.0')

  it('covers every usable host and excludes .0 and .255', () => {
    expect(hosts).toHaveLength(254)
    expect(new Set(hosts).size).toBe(254)
    expect(hosts).not.toContain('192.168.0.0')
    expect(hosts).not.toContain('192.168.0.255')
    expect(hosts).toContain('192.168.0.1')
    expect(hosts).toContain('192.168.0.254')
  })

  it('probes the install convention .250 first', () => {
    // The sweep is time-boxed, so probe order decides what a slow network reaches.
    expect(hosts[0]).toBe('192.168.0.250')
    expect(hosts.slice(0, 3)).toEqual(['192.168.0.250', '192.168.0.1', '192.168.0.2'])
  })
})

describe('buildProbeTargets', () => {
  const subnets = subnetsFromInterfaces({
    en0: [{ address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4' }],
    en1: [{ address: '10.0.0.7', netmask: '255.255.255.0', family: 'IPv4' }],
  })
  const targets = buildProbeTargets(subnets)

  it('covers both /24s on both candidate ports', () => {
    expect(targets).toHaveLength(254 * 2 * CANDIDATE_PORTS.length)
    expect(new Set(targets.map((t) => `${t.ip}:${t.port}`)).size).toBe(targets.length)
  })

  it('sweeps 8080 across everything before falling back to 80', () => {
    // If the time budget runs out, the port the server actually listens on
    // must already have been fully covered.
    const firstEighty = targets.findIndex((t) => t.port === 80)
    const lastEightyEighty = targets.map((t) => t.port).lastIndexOf(8080)
    expect(targets[0].port).toBe(8080)
    expect(lastEightyEighty).toBeLessThan(firstEighty)
  })

  it('starts on the first interface and tags each target with its subnet', () => {
    expect(targets[0]).toEqual({ ip: '192.168.1.250', port: 8080, base: '192.168.1' })
    expect(targets.every((t) => t.ip.startsWith(t.base + '.'))).toBe(true)
  })

  it('produces nothing when there is no subnet to sweep', () => {
    expect(buildProbeTargets([])).toEqual([])
  })
})

describe('isJosbinHealthPayload', () => {
  it('matches on the app identity field', () => {
    expect(isJosbinHealthPayload({ app: 'josbin_pos', status: 'ok', timezone: 'America/Paramaribo' })).toBe(true)
    // Identity wins even when the server reports itself degraded.
    expect(isJosbinHealthPayload({ app: 'josbin_pos', status: 'degraded' })).toBe(true)
  })

  it('falls back to the old payload shape (server not yet updated)', () => {
    expect(isJosbinHealthPayload({ status: 'ok', timezone: 'America/Paramaribo', app_env: 'production' })).toBe(true)
  })

  it('rejects other things answering on the LAN', () => {
    expect(isJosbinHealthPayload({ app: 'something_else', status: 'ok', timezone: 'UTC' })).toBe(false)
    expect(isJosbinHealthPayload({ status: 'ok' })).toBe(false)              // printer web UI
    expect(isJosbinHealthPayload({ status: 'degraded', timezone: 'UTC' })).toBe(false)
    expect(isJosbinHealthPayload({ status: 'ok', timezone: '' })).toBe(false)
    expect(isJosbinHealthPayload('ok')).toBe(false)
    expect(isJosbinHealthPayload(null)).toBe(false)
    expect(isJosbinHealthPayload(undefined)).toBe(false)
  })
})

describe('url builders', () => {
  it('probes /api/health and hands the input a full API base', () => {
    expect(healthUrlFor('192.168.0.250', 8080)).toBe('http://192.168.0.250:8080/api/health')
    expect(apiBaseFor('192.168.0.250', 8080)).toBe('http://192.168.0.250:8080/api')
    expect(apiBaseFor('10.0.0.7', 80)).toBe('http://10.0.0.7:80/api')
  })
})

describe('rankDiscoveries', () => {
  const hit = (ip: string, port: number): DiscoveredServer => ({
    url: apiBaseFor(ip, port), ip, port, appEnv: 'production', timezone: 'America/Paramaribo',
  })

  it('drops duplicate urls', () => {
    const ranked = rankDiscoveries([hit('192.168.0.250', 8080), hit('192.168.0.250', 8080)], ['192.168.0'])
    expect(ranked).toHaveLength(1)
  })

  it("puts the till's own subnet first, in interface order", () => {
    const ranked = rankDiscoveries(
      [hit('10.0.0.9', 8080), hit('192.168.1.5', 8080), hit('172.16.4.4', 8080)],
      ['192.168.1', '10.0.0'],
    )
    expect(ranked.map((r) => r.ip)).toEqual(['192.168.1.5', '10.0.0.9', '172.16.4.4'])
  })

  it('prefers 8080 over 80 and then sorts numerically, not as text', () => {
    const ranked = rankDiscoveries(
      [hit('192.168.0.100', 8080), hit('192.168.0.9', 80), hit('192.168.0.9', 8080), hit('192.168.0.20', 8080)],
      ['192.168.0'],
    )
    expect(ranked.map((r) => `${r.ip}:${r.port}`)).toEqual([
      '192.168.0.9:8080', '192.168.0.20:8080', '192.168.0.100:8080', '192.168.0.9:80',
    ])
  })

  it('survives an empty sweep and an unknown subnet order', () => {
    expect(rankDiscoveries([], ['192.168.0'])).toEqual([])
    expect(rankDiscoveries([hit('192.168.9.9', 8080)]).map((r) => r.ip)).toEqual(['192.168.9.9'])
  })
})
