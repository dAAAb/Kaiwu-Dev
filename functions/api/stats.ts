interface Env {
  DB: D1Database
  // Optional display baselines (set in wrangler.toml [vars]). Added on top of
  // real counts so early-stage numbers don't look empty. Default 0 = pure real.
  STATS_BASELINE_USERS?: string
  STATS_BASELINE_QUERIES?: string
  STATS_BASELINE_TOKENS?: string
}

// Rough estimate of tokens processed per credit consumed.
// A basic search returns ~5 snippets; advanced fetches & summarizes pages.
// Derived from real credit usage — labelled as an estimate in the UI.
const TOKENS_PER_CREDIT = 1500

function baseline(v?: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

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
        users: totalUsers + baseline(env.STATS_BASELINE_USERS),
        queries: totalQueries + baseline(env.STATS_BASELINE_QUERIES),
        credits: totalCredits,
        tokens_estimated: totalCredits * TOKENS_PER_CREDIT + baseline(env.STATS_BASELINE_TOKENS),
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
