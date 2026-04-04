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

  // Decode Privy JWT to get user ID (without full verification for now)
  let privyId: string
  let email: string | null = null
  try {
    // Try Privy user info endpoint first
    const res = await fetch('https://auth.privy.io/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'privy-app-id': env.PRIVY_APP_ID,
      },
    })
    if (res.ok) {
      const data = await res.json() as any
      privyId = data.id || data.user_id || data.sub
      email = data.email?.address || data.linked_accounts?.find((a: any) => a.type === 'email')?.address || null
    } else {
      // Fallback: decode JWT payload (base64)
      const parts = token.split('.')
      if (parts.length !== 3) {
        return Response.json({ error: 'Invalid token format' }, { status: 401, headers: corsHeaders })
      }
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      privyId = payload.sub || payload.sid || payload.iss
      if (!privyId) {
        return Response.json({ error: 'Cannot extract user ID from token' }, { status: 401, headers: corsHeaders })
      }
    }
  } catch (e: any) {
    return Response.json({ error: 'Auth failed: ' + e.message }, { status: 401, headers: corsHeaders })
  }

  if (!privyId) {
    return Response.json({ error: 'No user ID found' }, { status: 401, headers: corsHeaders })
  }

  // Upsert user
  let user = await env.DB.prepare('SELECT * FROM users WHERE privy_id = ?').bind(privyId).first() as any

  if (!user) {
    const userId = crypto.randomUUID()
    const now = new Date()
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    await env.DB.prepare(
      `INSERT INTO users (id, privy_id, email, monthly_credits, credits_used, credits_reset_at, created_at, updated_at)
       VALUES (?, ?, ?, 1000, 0, ?, datetime('now'), datetime('now'))`
    ).bind(userId, privyId, email, resetAt).run()

    // Create default API key — store full key in key_hash for retrieval
    const keyId = crypto.randomUUID()
    const keyRandom = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
    const keyValue = 'kw_' + keyRandom
    const keyPrefix = keyValue.slice(0, 12)

    await env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, type, created_at)
       VALUES (?, ?, 'default', ?, ?, 'dev', datetime('now'))`
    ).bind(keyId, userId, keyValue, keyPrefix).run()

    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  } else if (email && !user.email) {
    await env.DB.prepare("UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?").bind(email, user.id).run()
    user = { ...user, email }
  }

  // Get user's API keys (include full key for default key display)
  const { results: keys } = await env.DB.prepare(
    'SELECT id, name, key_hash as full_key, key_prefix, type, usage_count, created_at, last_used_at, revoked FROM api_keys WHERE user_id = ? AND revoked = 0 ORDER BY created_at ASC'
  ).bind(user.id).all()

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      monthly_credits: user.monthly_credits,
      credits_used: user.credits_used,
    },
    keys: keys || [],
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
