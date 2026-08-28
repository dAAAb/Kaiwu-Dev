// Catch-all for /v1/* — JSON 404/405 instead of falling through to the SPA shell.
// Pages Functions picks the most specific file first, so search.ts / extract.ts /
// credits.ts are unaffected; this only sees unmatched paths and known paths hit
// with a method their handler doesn't export (e.g. GET /v1/search → 405).

const DOCS = 'https://kaiwu.dev/openapi.json'
const LLMS_TXT = 'https://kaiwu.dev/llms.txt'

// Methods actually exported by the sibling route files (keep in sync).
const KNOWN_ROUTES: Record<string, string[]> = {
  '/v1/search': ['POST', 'OPTIONS'],
  '/v1/extract': ['POST', 'OPTIONS'],
  '/v1/credits': ['GET', 'HEAD', 'OPTIONS'],
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const onRequest: PagesFunction = async ({ request }) => {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  const allowed = KNOWN_ROUTES[path]
  const allow = (allowed ?? ['GET', 'POST', 'OPTIONS']).join(', ')

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
    const wantsPost = usable.includes('POST')
    return Response.json(
      {
        error: 'Method not allowed',
        code: 'method_not_allowed',
        hint: wantsPost
          ? `${method} is not supported on ${path}; send POST with a JSON body and Authorization: Bearer kw_… (see ${DOCS}).`
          : `${method} is not supported on ${path}; use ${usable.join(' or ')}.`,
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
      hint: `No route for ${method} ${path}. Available: POST /v1/search, POST /v1/extract, GET /v1/credits (Authorization: Bearer kw_…).`,
      docs: DOCS,
      llms_txt: LLMS_TXT,
    },
    { status: 404, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
  )
}
