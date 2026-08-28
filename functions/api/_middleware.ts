// Scoped middleware for /api/* — response hygiene headers only.
// CORS is untouched (each route sets its own Access-Control-* headers).
// NOTE: the site-wide functions/_middleware.ts is owned by site routing; keep
// API-only concerns here.

const INDEXABLE = new Set(['/api/stats'])

function withHeaders(res: Response, apply: (h: Headers) => void): Response {
  try {
    apply(res.headers)
    return res
  } catch {
    // Immutable headers (e.g. a passthrough asset response) — re-wrap.
    const out = new Response(res.body, res)
    apply(out.headers)
    return out
  }
}

export const onRequest: PagesFunction = async ({ request, next }) => {
  const res = await next()
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  const authenticated = request.headers.has('Authorization')

  return withHeaders(res, (h) => {
    if (!INDEXABLE.has(path)) h.set('X-Robots-Tag', 'noindex')
    h.set('X-Content-Type-Options', 'nosniff')
    if ((authenticated || res.status === 401 || (method !== 'GET' && method !== 'HEAD')) && !h.has('Cache-Control')) {
      h.set('Cache-Control', 'no-store')
    }
    // RFC 6750 §3.1: only add error="invalid_token" when a credential was actually
    // presented and rejected; a bare challenge when none was sent. Routes that set
    // their own header win.
    if (res.status === 401 && !h.has('WWW-Authenticate')) {
      h.set('WWW-Authenticate', authenticated ? 'Bearer realm="kaiwu", error="invalid_token"' : 'Bearer realm="kaiwu"')
    }
  })
}
