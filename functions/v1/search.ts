interface Env {
  DB: D1Database
  SEARXNG_URL: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  // Auth
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: '需要 API 金鑰' }, { status: 401, headers: corsHeaders })
  }
  const apiKey = auth.slice(7)

  // Validate API key
  const keyRow = await env.DB.prepare(
    'SELECT ak.id, ak.user_id, u.credits_used, u.monthly_credits FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_prefix = ? AND ak.revoked = 0'
  ).bind(apiKey.slice(0, 12)).first<{ id: string; user_id: string; credits_used: number; monthly_credits: number }>()

  if (!keyRow) {
    return Response.json({ error: '無效的 API 金鑰' }, { status: 401, headers: corsHeaders })
  }

  // Check credits
  if (keyRow.credits_used >= keyRow.monthly_credits) {
    return Response.json({ error: '額度已用完', credits_used: keyRow.credits_used, monthly_credits: keyRow.monthly_credits }, { status: 429, headers: corsHeaders })
  }

  // Parse body
  let body: { query: string; lang?: string; max_results?: number; include_content?: boolean; time_range?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '無效的 JSON' }, { status: 400, headers: corsHeaders })
  }

  if (!body.query?.trim()) {
    return Response.json({ error: '缺少 query 參數' }, { status: 400, headers: corsHeaders })
  }

  const lang = body.lang || 'zh-TW'
  const maxResults = Math.min(body.max_results || 5, 20)
  const searxngUrl = env.SEARXNG_URL || 'https://searxng-tw.zeabur.app'

  // Query SearXNG
  const params = new URLSearchParams({
    q: body.query,
    format: 'json',
    language: lang,
  })
  if (body.time_range && body.time_range !== 'all') {
    params.set('time_range', body.time_range)
  }

  try {
    const searxRes = await fetch(`${searxngUrl}/search?${params}`, {
      headers: { 'User-Agent': 'Kaiwu/1.0' },
    })

    if (!searxRes.ok) {
      return Response.json({ error: '搜尋引擎暫時無法使用' }, { status: 502, headers: corsHeaders })
    }

    const searxData = await searxRes.json() as { results: any[] }
    const results = (searxData.results || []).slice(0, maxResults).map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      published: r.publishedDate || null,
      engine: r.engine || null,
      score: r.score || null,
      language: lang,
    }))

    // Deduct credit
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET credits_used = credits_used + 1, updated_at = datetime(\'now\') WHERE id = ?').bind(keyRow.user_id),
      env.DB.prepare('UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = datetime(\'now\') WHERE id = ?').bind(keyRow.id),
      env.DB.prepare('INSERT INTO usage_logs (id, api_key_id, endpoint, credits_used, query, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').bind(
        crypto.randomUUID(), keyRow.id, '/v1/search', 1, body.query
      ),
    ])

    return Response.json({
      query: body.query,
      lang,
      results,
      credits_used: keyRow.credits_used + 1,
      credits_remaining: keyRow.monthly_credits - keyRow.credits_used - 1,
    }, { headers: corsHeaders })
  } catch (e: any) {
    return Response.json({ error: '搜尋失敗', detail: e.message }, { status: 500, headers: corsHeaders })
  }
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
