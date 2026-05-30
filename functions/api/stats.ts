interface Env {
  DB: D1Database
}

// Rough estimate of tokens processed per credit consumed.
// A basic search returns ~5 snippets; advanced fetches & summarizes pages.
// Derived from real credit usage — labelled as an estimate in the UI.
const TOKENS_PER_CREDIT = 1500

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context

  try {
    const [users, logs] = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS n FROM users'),
      env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(credits_used), 0) AS credits FROM usage_logs'),
    ])

    const totalUsers = (users.results?.[0] as { n: number })?.n ?? 0
    const logRow = logs.results?.[0] as { n: number; credits: number } | undefined
    const totalQueries = logRow?.n ?? 0
    const totalCredits = logRow?.credits ?? 0

    return Response.json(
      {
        users: totalUsers,
        queries: totalQueries,
        credits: totalCredits,
        tokens_estimated: totalCredits * TOKENS_PER_CREDIT,
        updated_at: new Date().toISOString(),
      },
      {
        headers: {
          ...corsHeaders,
          // Edge-cache for 5 min so the landing page stays snappy under load
          'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
      },
    )
  } catch {
    return Response.json({ error: 'stats unavailable' }, { status: 500, headers: corsHeaders })
  }
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders })
}
