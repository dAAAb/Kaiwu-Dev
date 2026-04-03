interface Env {
  DB: D1Database
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: '需要 API 金鑰' }, { status: 401, headers: corsHeaders })
  }
  const apiKey = auth.slice(7)

  const row = await env.DB.prepare(
    'SELECT u.monthly_credits, u.credits_used, u.credits_reset_at FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_prefix = ? AND ak.revoked = 0'
  ).bind(apiKey.slice(0, 12)).first<{ monthly_credits: number; credits_used: number; credits_reset_at: string }>()

  if (!row) {
    return Response.json({ error: '無效的 API 金鑰' }, { status: 401, headers: corsHeaders })
  }

  return Response.json({
    monthly_credits: row.monthly_credits,
    credits_used: row.credits_used,
    credits_remaining: row.monthly_credits - row.credits_used,
    resets_at: row.credits_reset_at,
  }, { headers: corsHeaders })
}
