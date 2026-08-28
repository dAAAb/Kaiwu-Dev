import { lookupApiKey } from '../_lib/auth'

interface Env {
  DB: D1Database
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: '需要 API 金鑰', code: 'missing_api_key' }, { status: 401, headers: corsHeaders })
  }
  const apiKey = auth.slice(7)

  // Shared full-key lookup (key_prefix + key_hash) with lazy monthly credit reset
  const row = await lookupApiKey(env, apiKey)
  if (!row) {
    return Response.json({ error: '無效的 API 金鑰', code: 'invalid_api_key' }, { status: 401, headers: corsHeaders })
  }

  return Response.json({
    monthly_credits: row.monthly_credits,
    credits_used: row.credits_used,
    credits_remaining: row.monthly_credits - row.credits_used,
    resets_at: row.credits_reset_at,
  }, { headers: corsHeaders })
}

// HEAD mirrors GET (same auth, status and headers; body dropped).
export const onRequestHead: PagesFunction<Env> = async (context) => {
  const res = await onRequestGet(context)
  return new Response(null, res)
}
