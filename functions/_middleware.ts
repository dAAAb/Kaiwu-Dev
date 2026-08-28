/**
 * Site routing for kaiwu.dev (Cloudflare Pages Functions root middleware).
 *
 * - API paths (/api/*, /v1/*, /mcp, /openapi.json, /install.sh) pass straight through to
 *   their own Functions / assets — untouched.
 * - Public pages (/, /cli, /developers, /about, /contact, /privacy) are prerendered at build
 *   time; every client gets the same complete HTML (no UA sniffing). `Accept: text/markdown`
 *   returns the Markdown variant with `Vary: Accept`.
 * - /dashboard/** gets the empty SPA shell (app.html), noindex.
 * - Everything else is a real 404 (HTML / Markdown / JSON by Accept).
 * - www.kaiwu.dev → kaiwu.dev (301), /docs → /developers.
 */

interface Env { ASSETS: { fetch: (req: Request) => Promise<Response> } }

const SITE = 'https://kaiwu.dev'
const STATIC_EXT = /\.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|webp|avif|woff|woff2|ttf|eot|map|webmanifest|txt|xml|json|md|pdf|sh)$/i
const PRERENDERED = new Set(['/', '/cli', '/developers', '/about', '/contact', '/privacy'])
const PASSTHROUGH = [/^\/api\//, /^\/v1\//, /^\/mcp\/?$/, /^\/openapi\.json\/?$/, /^\/install\.sh\/?$/]
const REDIRECTS: Record<string, string> = {
  '/docs': '/developers',
  '/developer': '/developers',
  '/api-docs': '/developers',
  '/pricing': '/#pricing',
  '/skills': '/cli#skills',
  '/.well-known/openapi.json': '/openapi.json',
  '/api/openapi.json': '/openapi.json',
  '/favicon.ico': '/logo.png',
}
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

/* ── Accept negotiation (RFC 9110 §12.5.1) ── */
type Pref = { html: number; md: number; json: number; any: number; listed: boolean; mdExplicit: boolean }
function parseAccept(header: string | null): Pref {
  const pref: Pref = { html: -1, md: -1, json: -1, any: -1, listed: false, mdExplicit: false }
  if (!header) return pref
  for (const part of header.split(',')) {
    const [typeRaw, ...params] = part.trim().split(';')
    const type = typeRaw.trim().toLowerCase()
    if (!type) continue
    let q = 1
    for (const p of params) { const m = p.trim().match(/^q=([0-9.]+)$/i); if (m) q = Math.max(0, Math.min(1, parseFloat(m[1]) || 0)) }
    pref.listed = true
    if (type === 'text/markdown' || type === 'text/x-markdown') { pref.md = Math.max(pref.md, q); if (q > 0) pref.mdExplicit = true }
    else if (type === 'text/html' || type === 'application/xhtml+xml') pref.html = Math.max(pref.html, q)
    else if (type === 'application/json') pref.json = Math.max(pref.json, q)
    else if (type === '*/*') pref.any = Math.max(pref.any, q)
    else if (type === 'text/*') { pref.html = Math.max(pref.html, q); pref.md = Math.max(pref.md, q) }
    else if (type === 'text/plain') pref.md = Math.max(pref.md, q)
  }
  return pref
}
function choose(pref: Pref): 'html' | 'md' | 'json' | 'none' {
  if (!pref.listed) return 'html'
  const html = pref.html >= 0 ? pref.html : pref.any
  const md = pref.md >= 0 ? pref.md : pref.any
  const json = pref.json >= 0 ? pref.json : pref.any
  if (pref.mdExplicit && pref.md >= html) return 'md'
  if (html > 0) return 'html'
  if (md > 0) return 'md'
  if (json > 0) return 'json'
  if (pref.any > 0) return 'html'
  return 'none'
}

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) out.headers.set(k, v)
  return out
}
function mergeVary(res: Response, value: string) {
  const cur = res.headers.get('vary')
  const parts = new Set((cur ? cur.split(',') : []).map((s) => s.trim().toLowerCase()).filter(Boolean))
  parts.add(value.toLowerCase())
  res.headers.set('vary', Array.from(parts).map((p) => p.replace(/(^|-)(\w)/g, (_, d, c) => d + c.toUpperCase())).join(', '))
}
async function asset(env: Env, origin: string, path: string, request?: Request): Promise<Response | null> {
  const headers = new Headers()
  const inm = request?.headers.get('if-none-match')
  if (inm) headers.set('if-none-match', inm)
  const res = await env.ASSETS.fetch(new Request(new URL(path, origin), { headers }))
  return res.ok || res.status === 304 ? res : null
}
/**
 * Rebuild an asset response with our headers while keeping validators so revisits get 304s.
 * The Pages asset server sends no ETag for prerendered .html (only for other static files),
 * so when one is missing we hash the body (≤ ~60 KB) and honour If-None-Match ourselves.
 */
async function rebuild(src: Response, status: number, extra: Record<string, string>, request?: Request): Promise<Response> {
  const vary304 = (r: Response) => { r.headers.set('vary', 'Accept'); return r }
  if (src.status === 304) {
    const r = withHeaders(new Response(null, { status: 304 }), {})
    const et = src.headers.get('etag'); if (et) r.headers.set('etag', et)
    return vary304(r)
  }
  const robots = src.headers.get('x-robots-tag')
  // Always derive the HTML validator from the bytes we actually send: the asset server's ETag for
  // .html files is inconsistent between local dev and production, and a wrong one is worse than none.
  const isHtml = /text\/html/i.test(extra['content-type'] || '')
  let etag = isHtml ? null : src.headers.get('etag')
  let body: BodyInit | null = src.body
  if (!etag && status === 200) {
    const buf = await src.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-1', buf)
    // Strong ETag on purpose: Cloudflare drops weak ETags when it rewrites the body (Email Obfuscation).
    etag = `"${Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')}"`
    const norm = (t: string) => t.trim().replace(/^W\//, '')
    const inm = request?.headers.get('if-none-match')
    body = buf
    if (inm && inm.split(',').some((t) => norm(t) === norm(etag!))) {
      const r = withHeaders(new Response(null, { status: 304 }), { etag, 'cache-control': extra['cache-control'] || '' })
      if (robots) r.headers.set('x-robots-tag', robots)
      return vary304(r)
    }
  }
  const out = withHeaders(new Response(body, { status }), extra)
  if (etag && status === 200) out.headers.set('etag', etag)
  if (robots) out.headers.set('x-robots-tag', robots)
  return out
}
async function servePage(env: Env, url: URL, request: Request, htmlPath: string, mdPath: string, status = 200): Promise<Response> {
  const kind = choose(parseAccept(request.headers.get('accept')))
  const cache = status === 200 ? 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' : 'public, max-age=60'
  if (kind === 'none' || kind === 'json') {
    return withHeaders(new Response(JSON.stringify({ error: 'Not acceptable', code: 'not_acceptable', available: ['text/html', 'text/markdown'], markdown: `${SITE}${mdPath}`, api: `${SITE}/openapi.json` }), { status: 406, headers: { 'content-type': 'application/json; charset=utf-8', vary: 'Accept' } }), {})
  }
  if (kind === 'md') {
    const md = await asset(env, url.origin, mdPath, request)
    if (md) {
      return rebuild(md, status, {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': cache,
        'content-location': mdPath,
        link: `<${SITE}${htmlPath === '/' ? '/' : htmlPath.replace(/\/$/, '')}>; rel="canonical"; type="text/html"`,
        vary: 'Accept',
      }, request)
    }
  }
  const html = await asset(env, url.origin, htmlPath, request)
  if (!html) return notFound(env, url, request)
  const res = await rebuild(html, status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache }, request)
  mergeVary(res, 'Accept')
  return res
}

async function appShell(env: Env, url: URL): Promise<Response> {
  const shell = await asset(env, url.origin, '/app')
  if (!shell) return new Response('App shell missing', { status: 500 })
  return withHeaders(new Response(shell.body, { status: 200 }), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' })
}

async function notFound(env: Env, url: URL, request: Request): Promise<Response> {
  const kind = choose(parseAccept(request.headers.get('accept')))
  const start_here = { home: `${SITE}/`, sitemap: `${SITE}/sitemap.xml`, llms_txt: `${SITE}/llms.txt`, developers: `${SITE}/developers`, openapi: `${SITE}/openapi.json`, health: `${SITE}/api/health` }
  if (kind === 'json') {
    return withHeaders(new Response(JSON.stringify({ error: 'Not found', code: 'not_found', path: url.pathname, hint: '這個網址不存在。This URL does not exist on kaiwu.dev.', start_here }, null, 2), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8', vary: 'Accept', 'cache-control': 'public, max-age=60' } }), {})
  }
  if (kind === 'md' || kind === 'none') {
    const md = `# 404 — 找不到頁面 / Not found\n\n\`${url.pathname}\` 不存在於 kaiwu.dev。\n\n從這裡開始 / Start here:\n\n- [首頁 Home](${SITE}/)\n- [開發者文件 Developers](${SITE}/developers)\n- [llms.txt](${SITE}/llms.txt) — 給語言模型的摘要\n- [OpenAPI](${SITE}/openapi.json)\n- [Sitemap](${SITE}/sitemap.xml)\n`
    return withHeaders(new Response(md, { status: 404, headers: { 'content-type': 'text/markdown; charset=utf-8', vary: 'Accept', 'cache-control': 'public, max-age=60' } }), {})
  }
  const html = await asset(env, url.origin, '/404')
  const res = withHeaders(new Response(html ? html.body : '<h1>404</h1>', { status: 404 }), { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' })
  mergeVary(res, 'Accept')
  return res
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname

  // Canonical host
  if (url.hostname === 'www.kaiwu.dev') return Response.redirect(`${SITE}${path}${url.search}`, 301)

  // Exact-path redirects come first so aliases under /api/ (e.g. /api/openapi.json) still resolve.
  if (path in REDIRECTS) {
    const target = REDIRECTS[path]
    return Response.redirect(url.origin + target + (target.includes('#') ? '' : url.search), 301)
  }

  // API / functions / installer: never touched here (only hygiene headers on /mcp, which has no scoped middleware).
  if (PASSTHROUGH.some((re) => re.test(path))) {
    const res = await context.next()
    if (/^\/mcp\/?$/.test(path)) {
      const out = withHeaders(res, { 'x-robots-tag': 'noindex' })
      if (res.status === 401) out.headers.set('cache-control', 'no-store')
      return out
    }
    return res
  }

  // Everything below is a document or static file: GET/HEAD only (the asset server used to answer 405 too).
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withHeaders(new Response(null, { status: 405, headers: { allow: 'GET, HEAD', 'cache-control': 'no-store' } }), {})
  }

  if (path.length > 1 && path.endsWith('/')) return Response.redirect(url.origin + path.slice(0, -1) + url.search, 301)
  if (path.endsWith('/index.html')) return Response.redirect(url.origin + (path.slice(0, -'/index.html'.length) || '/') + url.search, 301)

  // Static assets & machine files (hashed assets, fonts and images are excluded via public/_routes.json and never reach here)
  if (path.startsWith('/assets/') || STATIC_EXT.test(path) || path.startsWith('/.well-known/')) {
    const res = await context.next()
    if (res.status === 404) return notFound(env, url, request)
    const out = withHeaders(res, {})
    if (res.ok && path.startsWith('/assets/')) out.headers.set('cache-control', 'public, max-age=31536000, immutable')
    if (path === '/llms.txt' || path === '/llms-full.txt') { out.headers.set('content-type', 'text/markdown; charset=utf-8'); out.headers.set('cache-control', 'public, max-age=300') }
    if (/\.md$/i.test(path)) {
      // Direct .md URLs are the Markdown variant of a page: point canonical at the HTML route and keep them out of the index.
      out.headers.set('content-type', 'text/markdown; charset=utf-8')
      out.headers.set('cache-control', 'public, max-age=300')
      out.headers.set('x-robots-tag', 'noindex')
      const route = path.replace(/\/index\.md$/, '').replace(/\.md$/, '') || '/'
      if (route === '/404') return new Response(out.body, { status: 404, headers: out.headers })
      out.headers.set('link', `<${SITE}${route === '' ? '/' : route}>; rel="canonical"; type="text/html"`)
    }
    return out
  }

  if (PRERENDERED.has(path)) {
    const base = path === '/' ? '' : path
    return servePage(env, url, request, `${base}/`, `${base}/index.md`)
  }
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return appShell(env, url)

  return notFound(env, url, request)
}
