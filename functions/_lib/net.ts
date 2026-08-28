// Shared outbound-fetch guard (SSRF protection) for /v1/extract and the
// advanced-mode page fetch in /v1/search.
//
// Not a route: wrangler ignores `_`-prefixed directories under functions/ for
// routing but still bundles them when imported.

export class UnsafeUrlError extends Error {
  constructor(message = 'blocked URL') {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

export class TooManyRedirectsError extends Error {
  constructor(message = 'too many redirects') {
    super(message)
    this.name = 'TooManyRedirectsError'
  }
}

const MAX_REDIRECTS = 5

// ---------------------------------------------------------------------------
// IPv4
// ---------------------------------------------------------------------------
function parseIPv4(host: string): number[] | null {
  // The WHATWG URL parser already normalises octal/hex/integer forms to
  // dotted-decimal, so a strict dotted-quad check is sufficient here.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return null
  const octets = m.slice(1).map(Number)
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null
}

function isPublicIPv4([a, b]: number[]): boolean {
  if (a === 0) return false // 0.0.0.0/8 ("this" network, incl. 0.0.0.0)
  if (a === 10) return false // 10/8
  if (a === 100 && b >= 64 && b <= 127) return false // 100.64/10 (CGNAT)
  if (a === 127) return false // 127/8 loopback
  if (a === 169 && b === 254) return false // 169.254/16 link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return false // 172.16/12
  if (a === 192 && b === 0) return false // 192.0.0/24 IETF protocol assignments
  if (a === 192 && b === 168) return false // 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return false // 198.18/15 benchmarking
  if (a >= 224) return false // 224/4 multicast, 240/4 reserved, broadcast
  return true
}

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------
function expandIPv6(raw: string): number[] | null {
  let s = raw.toLowerCase()
  // Embedded dotted IPv4 tail (e.g. ::ffff:127.0.0.1) → two hextets
  const tail = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s)
  if (tail) {
    const v4 = parseIPv4(tail[2])
    if (!v4) return null
    s = tail[1] + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16)
  }
  const parts = s.split('::')
  if (parts.length > 2) return null
  const head = parts[0] ? parts[0].split(':') : []
  const rest = parts.length === 2 && parts[1] ? parts[1].split(':') : []
  if (parts.length === 1 && head.length !== 8) return null
  if (head.length + rest.length > 8) return null
  const fill = parts.length === 2 ? 8 - head.length - rest.length : 0
  const groups = [...head, ...Array(fill).fill('0'), ...rest]
  if (groups.length !== 8) return null
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

function isPublicIPv6(raw: string): boolean {
  const h = expandIPv6(raw)
  if (!h) return false
  const leading = (n: number) => h.slice(0, n).every((x) => x === 0)
  // ::/96 — unspecified (::), loopback (::1) and deprecated v4-compatible space
  if (leading(6)) return false
  // ::ffff:0:0/96 — IPv4-mapped: apply the IPv4 rules to the embedded address
  if (leading(5) && h[5] === 0xffff) return isPublicIPv4([h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff])
  // 64:ff9b::/96 — NAT64
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) {
    return isPublicIPv4([h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff])
  }
  // 2002::/16 — 6to4 (embedded IPv4 in hextets 1–2)
  if (h[0] === 0x2002) return isPublicIPv4([h[1] >> 8, h[1] & 0xff, h[2] >> 8, h[2] & 0xff])
  if ((h[0] & 0xfe00) === 0xfc00) return false // fc00::/7 ULA
  if ((h[0] & 0xffc0) === 0xfe80) return false // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return false // fec0::/10 site-local (deprecated)
  if ((h[0] & 0xff00) === 0xff00) return false // ff00::/8 multicast
  return true
}

// ---------------------------------------------------------------------------
// Host / URL checks
// ---------------------------------------------------------------------------
const BLOCKED_SUFFIXES = ['.localhost', '.internal', '.local', '.home.arpa', '.in-addr.arpa', '.ip6.arpa']

export function isPublicHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.+$/, '')
  if (!h) return false
  if (h === 'localhost' || BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return false
  if (h.startsWith('[') && h.endsWith(']')) return isPublicIPv6(h.slice(1, -1))
  if (h.includes(':')) return isPublicIPv6(h)
  const v4 = parseIPv4(h)
  if (v4) return isPublicIPv4(v4)
  return true
}

/** True when `raw` is an absolute http(s) URL pointing at a public host. */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  return isPublicHost(u.hostname)
}

// ---------------------------------------------------------------------------
// fetch with manual redirects, re-validating every hop
// ---------------------------------------------------------------------------
export interface SafeFetchInit {
  headers?: Record<string, string>
  signal?: AbortSignal
  maxRedirects?: number
}

/**
 * GET `url` following at most `maxRedirects` (default 5) redirects, checking the
 * original URL and every Location hop against the private-network blocklist.
 * Throws UnsafeUrlError / TooManyRedirectsError; other fetch errors propagate.
 */
export async function safeFetch(url: string, init: SafeFetchInit = {}): Promise<Response> {
  const maxRedirects = init.maxRedirects ?? MAX_REDIRECTS
  let current = url
  for (let hop = 0; ; hop++) {
    if (!isPublicHttpUrl(current)) throw new UnsafeUrlError()

    const res = await fetch(current, {
      method: 'GET',
      headers: init.headers,
      signal: init.signal,
      redirect: 'manual',
    })

    const location = res.headers.get('location')
    const isRedirect = res.status >= 300 && res.status < 400 && location !== null
    if (!isRedirect) return res

    // Drop the redirect body so the connection is released before the next hop.
    try { await res.body?.cancel() } catch {}

    if (hop >= maxRedirects) throw new TooManyRedirectsError()
    let next: URL
    try {
      next = new URL(location, current)
    } catch {
      throw new UnsafeUrlError('invalid redirect target')
    }
    next.hash = ''
    current = next.toString()
  }
}
