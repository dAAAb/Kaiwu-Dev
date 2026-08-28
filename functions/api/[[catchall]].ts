// Catch-all for /api/* — JSON 404/405 instead of falling through to the SPA shell.
// Pages Functions picks the most specific file first, so real routes
// (stats.ts, keys.ts, health.ts, …) are unaffected; this only sees unmatched
// paths and known paths hit with a method their handler doesn't export.

const DOCS = 'https://kaiwu.dev/openapi.json'
const LLMS_TXT = 'https://kaiwu.dev/llms.txt'

// Methods actually exported by the sibling route files (keep in sync).
// (/api/openapi.json is a 301 to /openapi.json in the root middleware.)
const KNOWN_ROUTES: Record<string, string[]> = {
  '/api/stats': ['GET', 'HEAD', 'OPTIONS'],
  '/api/health': ['GET', 'HEAD', 'OPTIONS'],
  '/api/keys': ['GET', 'HEAD', 'POST', 'DELETE', 'OPTIONS'],
  '/api/auth/callback': ['POST', 'OPTIONS'],
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const onRequest: PagesFunction = async ({ request }) => {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  const allowed = KNOWN_ROUTES[path]
  const allow = (allowed ?? ['GET', 'POST', 'DELETE', 'OPTIONS']).join(', ')

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': allow, Allow: allow },
    })
  }

  // Note: routes that support HEAD export onRequestHead themselves (same auth,
  // status and headers as GET), so a HEAD reaching here is a genuine 404/405.
  if (allowed) {
    const usable = allowed.filter((m) => m !== 'OPTIONS')
    return Response.json(
      {
        error: 'Method not allowed',
        code: 'method_not_allowed',
        hint: `${method} is not supported on ${path}; use ${usable.join(' or ')}.`,
        docs: DOCS,
        llms_txt: LLMS_TXT,
      },
      { status: 405, headers: { ...corsHeaders, Allow: allow, 'Cache-Control': 'no-store' } },
    )
  }

  return Response.json(
    {
      error: 'Not found',
      code: 'not_found',
      hint: `No route for ${method} ${path}. Public API lives under /v1/* (Authorization: Bearer kw_…); see the OpenAPI document for every operation.`,
      docs: DOCS,
      llms_txt: LLMS_TXT,
    },
    { status: 404, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
  )
}
