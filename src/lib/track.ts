/**
 * Analytics — optional, build-time configured, privacy-respecting.
 *
 *   VITE_GA_ID=G-XXXXXXX        → Google Analytics 4 (gtag), loaded after first paint
 *   VITE_CF_BEACON=<token>      → Cloudflare Web Analytics beacon (no cookies)
 *
 * Both are read at build time (Cloudflare Pages build env). With neither set, track()
 * is a silent no-op — the site works identically.
 */
const GA_ID = (import.meta as any).env?.VITE_GA_ID as string | undefined
const CF_BEACON = (import.meta as any).env?.VITE_CF_BEACON as string | undefined

export function initAnalytics() {
  if (typeof window === 'undefined') return
  try {
    if (GA_ID) {
      const w = window as any
      w.dataLayer = w.dataLayer || []
      w.gtag = function () { w.dataLayer.push(arguments) }
      w.gtag('js', new Date())
      w.gtag('config', GA_ID, { anonymize_ip: true })
      const s = document.createElement('script')
      s.async = true
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
      document.head.appendChild(s)
    }
    if (CF_BEACON) {
      const s = document.createElement('script')
      s.defer = true
      s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
      s.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_BEACON }))
      document.head.appendChild(s)
    }
  } catch { /* ignore */ }
}

/** Conversion events. Never throws; no-op without an analytics backend. */
export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  try {
    if (typeof window === 'undefined') return
    const g = (window as any).gtag
    if (typeof g === 'function') g('event', event, params)
  } catch { /* ignore */ }
}
