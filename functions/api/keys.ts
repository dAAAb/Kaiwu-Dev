interface Env {
  DB: D1Database
  PRIVY_APP_ID: string
  PRIVY_APP_SECRET: string
}

async function getUserFromToken(env: Env, request: Request): Promise<any | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const token = auth.slice(7)

  // Find user by Privy token - simplified: look up by token verification
  try {
    const res = await fetch('https://auth.privy.io/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const privyUser = await res.json() as any
    const privyId = privyUser.id || privyUser.user_id || privyUser.sub
    if (!privyId) return null

    return env.DB.prepare('SELECT * FROM users WHERE privy_id = ?').bind(privyId).first()
  } catch {
    return null
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

  const { results } = await env.DB.prepare(
    'SELECT id, name, key_prefix, type, usage_count, created_at, last_used_at, revoked FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all()

  return Response.json({ keys: results }, { headers: corsHeaders })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

  const body = await request.json() as { name?: string }
  const keyId = crypto.randomUUID()
  const keyValue = 'kw_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
  const keyPrefix = keyValue.slice(0, 12)

  await env.DB.prepare(
    'INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, type, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).bind(keyId, user.id, body.name || 'default', keyValue, keyPrefix, 'dev').run()

  return Response.json({
    key: {
      id: keyId,
      name: body.name || 'default',
      key_prefix: keyPrefix,
      type: 'dev',
      usage_count: 0,
      full_key: keyValue,
    },
  }, { headers: corsHeaders })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

  const body = await request.json() as { key_id: string }
  await env.DB.prepare(
    'UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?'
  ).bind(body.key_id, user.id).run()

  return Response.json({ success: true }, { headers: corsHeaders })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
