import { isPlainObject } from '../_lib/validate'

interface Env {
  DB: D1Database
  PRIVY_APP_ID: string
  PRIVY_APP_SECRET: string
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }

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

function badRequest(error: string, code = 'invalid_request'): Response {
  return Response.json({ error, code }, { status: 400, headers: corsHeaders })
}

type ParsedBody = { ok: true; body: Record<string, unknown> } | { ok: false; res: Response }

// Read a JSON object body. `allowEmpty` treats a missing/blank body as `{}`
// (POST /api/keys documents its body as optional).
async function parseJsonObject(request: Request, allowEmpty: boolean): Promise<ParsedBody> {
  const text = await request.text()
  if (!text.trim()) {
    return allowEmpty ? { ok: true, body: {} } : { ok: false, res: badRequest('缺少 JSON body', 'invalid_json') }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, res: badRequest('無效的 JSON', 'invalid_json') }
  }
  if (!isPlainObject(parsed)) return { ok: false, res: badRequest('請求 body 必須是 JSON 物件') }
  return { ok: true, body: parsed }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401, headers: corsHeaders })

  const { results } = await env.DB.prepare(
    'SELECT id, name, key_prefix, type, usage_count, created_at, last_used_at, revoked FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all()

  return Response.json({ keys: results }, { headers: corsHeaders })
}

// HEAD mirrors GET (same auth, status and headers; body dropped).
export const onRequestHead: PagesFunction<Env> = async (context) => {
  const res = await onRequestGet(context)
  return new Response(null, res)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401, headers: corsHeaders })

  const parsed = await parseJsonObject(request, true)
  if (!parsed.ok) return parsed.res
  const { body } = parsed
  if (body.name !== undefined && body.name !== null && typeof body.name !== 'string') return badRequest('name 必須是字串')
  const name = (typeof body.name === 'string' && body.name.trim()) || 'default'

  const keyId = crypto.randomUUID()
  const keyValue = 'kw_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32)
  const keyPrefix = keyValue.slice(0, 12)

  await env.DB.prepare(
    'INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, type, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).bind(keyId, user.id, name, keyValue, keyPrefix, 'dev').run()

  return Response.json({
    key: {
      id: keyId,
      name,
      key_prefix: keyPrefix,
      type: 'dev',
      usage_count: 0,
      full_key: keyValue,
    },
  }, { headers: corsHeaders })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const user = await getUserFromToken(env, request)
  if (!user) return Response.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401, headers: corsHeaders })

  const parsed = await parseJsonObject(request, false)
  if (!parsed.ok) return parsed.res
  const keyId = parsed.body.key_id
  if (typeof keyId !== 'string' || !keyId.trim()) return badRequest('key_id 必須是非空字串')

  await env.DB.prepare(
    'UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?'
  ).bind(keyId.trim(), user.id).run()

  return Response.json({ success: true }, { headers: corsHeaders })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
