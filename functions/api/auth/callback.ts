interface Env {
  DB: D1Database
  PRIVY_APP_ID: string
  PRIVY_APP_SECRET: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Missing token' }, { status: 401, headers: corsHeaders })
  }
  const token = auth.slice(7)

  // Verify Privy token
  let privyUser: any
  try {
    const verifyRes = await fetch('https://auth.privy.io/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!verifyRes.ok) {
      // Try alternative: verify via Privy API
      const altRes = await fetch(`https://auth.privy.io/api/v1/token/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': env.PRIVY_APP_ID,
          Authorization: `Basic ${btoa(env.PRIVY_APP_ID + ':' + env.PRIVY_APP_SECRET)}`,
        },
        body: JSON.stringify({ token }),
      })
      if (!altRes.ok) {
        return Response.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
      }
      privyUser = await altRes.json()
    } else {
      privyUser = await verifyRes.json()
    }
  } catch (e: any) {
    return Response.json({ error: 'Auth verification failed' }, { status: 401, headers: corsHeaders })
  }

  const privyId = privyUser.id || privyUser.user_id || privyUser.sub || token.slice(0, 32)
  const email = privyUser.email?.address || privyUser.email || null

  // Upsert user
  let user = await env.DB.prepare('SELECT * FROM users WHERE privy_id = ?').bind(privyId).first()

  if (!user) {
    const userId = crypto.randomUUID()
    const now = new Date()
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    await env.DB.prepare(
      'INSERT INTO users (id, privy_id, email, monthly_credits, credits_used, credits_reset_at, created_at, updated_at) VALUES (?, ?, ?, 1000, 0, ?, datetime(\'now\'), datetime(\'now\'))'
    ).bind(userId, privyId, email, resetAt).run()

    // Create default API key
    const keyId = crypto.randomUUID()
    const keyValue = 'kw_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
    const keyPrefix = keyValue.slice(0, 12)

    await env.DB.prepare(
      'INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, type, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
    ).bind(keyId, userId, 'default', keyValue, keyPrefix, 'dev').run()

    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  } else if (email && !user.email) {
    await env.DB.prepare('UPDATE users SET email = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(email, user.id).run()
    user = { ...user, email }
  }

  return Response.json({
    user: {
      id: user!.id,
      email: user!.email,
      monthly_credits: user!.monthly_credits,
      credits_used: user!.credits_used,
    },
  }, { headers: corsHeaders })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
