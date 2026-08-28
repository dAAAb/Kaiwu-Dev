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

// Cloudflare Pages git deploys don't apply wrangler.toml [vars] at runtime, so
// the approved baselines live here as code defaults. An env var (set in the
// dashboard) overrides them; set it to "0" to disable a baseline entirely.
const DEFAULT_BASELINE = { users: 120, queries: 5000, tokens: 7_500_000 }

function baseline(v: string | undefined, fallback: number): number {
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
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
        users: totalUsers + baseline(env.STATS_BASELINE_USERS, DEFAULT_BASELINE.users),
        queries: totalQueries + baseline(env.STATS_BASELINE_QUERIES, DEFAULT_BASELINE.queries),
        credits: totalCredits,
        tokens_estimated: totalCredits * TOKENS_PER_CREDIT + baseline(env.STATS_BASELINE_TOKENS, DEFAULT_BASELINE.tokens),
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
    return Response.json({ error: 'stats unavailable', code: 'internal_error' }, { status: 500, headers: corsHeaders })
  }
}

// HEAD mirrors GET (same status, Content-Type and Cache-Control; body dropped).
export const onRequestHead: PagesFunction<Env> = async (context) => {
  const res = await onRequestGet(context)
  return new Response(null, res)
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders })
}
