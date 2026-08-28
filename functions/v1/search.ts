import { lookupApiKey } from '../_lib/auth'
import { safeFetch } from '../_lib/net'
import { isPlainObject, isTimeRange, parseMaxResults, TIME_RANGES } from '../_lib/validate'

interface Env {
  DB: D1Database
  SEARXNG_URL: string
  GEMINI_API_KEY: string
  OLLAMA_URL?: string
}

interface SearchResult {
  title: string
  url: string
  snippet: string
  content?: string
  published: string | null
  engine: string | null
  score: number | null
  language: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ---------------------------------------------------------------------------
// HTML → plain text (lightweight, no DOM parser needed in Workers)
// ---------------------------------------------------------------------------
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Fetch page content with timeout
// ---------------------------------------------------------------------------
async function fetchPageContent(url: string, timeoutMs = 5000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    // SSRF protection lives in _lib/net: public http(s) hosts only, and every
    // redirect hop is re-validated (max 5).
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': 'Kaiwu/1.0 (search bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })

    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null

    const html = await res.text()
    const text = htmlToText(html)
    // Truncate to ~4000 chars to keep LLM response fast
    return text.slice(0, 4000)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Gemini call (fast, ~2s, for latency-sensitive tasks)
// ---------------------------------------------------------------------------
async function geminiGenerate(env: Env, prompt: string, systemPrompt?: string): Promise<string> {
  const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  const contents: any[] = []
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] })
    contents.push({ role: 'model', parts: [{ text: '好的，我會按照指示處理。' }] })
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents, generationConfig: { temperature: 0.3, maxOutputTokens: 2048 } }),
  })
  if (!res.ok) throw new Error('Gemini unavailable')
  const data = await res.json() as any
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

// ---------------------------------------------------------------------------
// Ollama call (self-hosted, ~12 tok/s, for cost-sensitive tasks)
// ---------------------------------------------------------------------------
async function ollamaGenerate(env: Env, prompt: string, systemPrompt?: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  const messages: { role: string; content: string }[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemma4:e4b', messages, stream: false, options: { temperature: 0.3, num_predict: 2048 } }),
    signal: controller.signal,
  })
  clearTimeout(timer)
  if (!res.ok) throw new Error('Ollama unavailable')
  const data = await res.json() as { message: { content: string } }
  return data.message?.content?.trim() || ''
}

// ---------------------------------------------------------------------------
// LLM router — picks the right backend based on task
// ---------------------------------------------------------------------------
async function llmGenerate(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  preferFast = false,
): Promise<string> {
  // Fast path: use Gemini directly (for advanced chunking with large input)
  if (preferFast && env.GEMINI_API_KEY) {
    try { return await geminiGenerate(env, prompt, systemPrompt) } catch {}
  }

  // Normal path: Gemini first (Ollama too unreliable on CPU for production)
  // TODO: re-enable Ollama when running on GPU or with faster model
  if (env.GEMINI_API_KEY) {
    try { return await geminiGenerate(env, prompt, systemPrompt) } catch {}
  }
  if (env.OLLAMA_URL) {
    try { return await ollamaGenerate(env, prompt, systemPrompt) } catch {}
  }

  throw new Error('LLM 服務暫時無法使用')
}

// ---------------------------------------------------------------------------
// Semantic chunking — extract relevant passages from page content
// ---------------------------------------------------------------------------
async function semanticChunk(
  env: Env,
  query: string,
  results: { url: string; rawContent: string }[],
): Promise<Map<string, string>> {
  const chunks = new Map<string, string>()

  // Batch all pages into one LLM call (Ollama serializes requests, so
  // parallel calls just queue up and timeout — one big prompt is faster)
  const pages = results
    .map((r, i) => `=== 來源 ${i + 1} (${r.url}) ===\n${r.rawContent}`)
    .join('\n\n')

  const systemPrompt = '你是搜尋結果摘要助手。只輸出摘要，不要加額外說明。'
  const prompt = `搜尋查詢：「${query}」

針對每個來源，提取與查詢最相關的 1-2 段摘要，每段不超過 150 字。

格式：
[來源 1]
摘要

[來源 2]
摘要

${pages}`

  try {
    // Use Gemini for chunking (fast, handles large input well)
    const response = await llmGenerate(env, prompt, systemPrompt, true)
    const sourceBlocks = response.split(/\[來源\s*\d+\]/).filter(Boolean)
    results.forEach((r, i) => {
      if (sourceBlocks[i]) {
        chunks.set(r.url, sourceBlocks[i].trim())
      }
    })
  } catch {
    results.forEach(r => {
      chunks.set(r.url, r.rawContent.slice(0, 500))
    })
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Generate answer from search results
// ---------------------------------------------------------------------------
async function generateAnswer(
  env: Env,
  query: string,
  results: SearchResult[],
): Promise<string> {
  const context = results
    .slice(0, 5)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content || r.snippet}`)
    .join('\n\n')

  const systemPrompt = '你是 Kaiwu 搜尋助手。根據搜尋結果回答問題，引用來源編號。使用繁體中文回答。'
  const prompt = `問題：${query}

搜尋結果：
${context}

請根據以上搜尋結果，提供完整且精確的回答。在關鍵資訊後標注來源，如 [1][2]。如果搜尋結果無法完全回答問題，請說明。`

  return llmGenerate(env, prompt, systemPrompt)
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
function badRequest(error: string, code = 'invalid_request'): Response {
  return Response.json({ error, code }, { status: 400, headers: corsHeaders })
}

// Any unexpected throw becomes the documented JSON 500 instead of a platform error page.
export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    return await handleSearch(context)
  } catch {
    return Response.json({ error: 'Internal error', code: 'internal_error' }, { status: 500, headers: corsHeaders })
  }
}

async function handleSearch(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const { request, env } = context

  // Auth
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: '需要 API 金鑰', code: 'missing_api_key' }, { status: 401, headers: corsHeaders })
  }
  const apiKey = auth.slice(7)

  // Shared full-key lookup (key_prefix + key_hash) with lazy monthly credit reset
  const keyRow = await lookupApiKey(env, apiKey)
  if (!keyRow) {
    return Response.json({ error: '無效的 API 金鑰', code: 'invalid_api_key' }, { status: 401, headers: corsHeaders })
  }

  // Parse + validate body shape before touching any field
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return badRequest('無效的 JSON', 'invalid_json')
  }
  if (!isPlainObject(raw)) return badRequest('請求 body 必須是 JSON 物件')
  const body = raw

  if (body.query === undefined || body.query === null || (typeof body.query === 'string' && !body.query.trim())) {
    return badRequest('缺少 query 參數', 'missing_query')
  }
  if (typeof body.query !== 'string') return badRequest('query 必須是字串')
  const query = body.query.trim()

  if (body.lang !== undefined && body.lang !== null && typeof body.lang !== 'string') return badRequest('lang 必須是字串')
  const lang = (typeof body.lang === 'string' && body.lang.trim()) || 'zh-TW'

  const maxResults = parseMaxResults(body.max_results)
  if (maxResults === null) return badRequest('max_results 必須是 1–20 的整數（0 或省略 = 5）')

  if (body.time_range !== undefined && body.time_range !== null && !isTimeRange(body.time_range)) {
    return badRequest(`time_range 必須是 ${TIME_RANGES.join(' / ')} 之一`)
  }
  const timeRange = isTimeRange(body.time_range) ? body.time_range : 'all'

  if (body.search_depth !== undefined && body.search_depth !== null && body.search_depth !== 'basic' && body.search_depth !== 'advanced') {
    return badRequest('search_depth 必須是 basic 或 advanced')
  }
  const searchDepth: 'basic' | 'advanced' = body.search_depth === 'advanced' ? 'advanced' : 'basic'

  if (body.include_answer !== undefined && body.include_answer !== null && typeof body.include_answer !== 'boolean') {
    return badRequest('include_answer 必須是布林值')
  }
  const includeAnswer = body.include_answer === true

  // Calculate credits needed
  let creditsNeeded = 1
  if (searchDepth === 'advanced') creditsNeeded += 1
  if (includeAnswer) creditsNeeded += 1

  // Check credits
  if (keyRow.credits_used + creditsNeeded > keyRow.monthly_credits) {
    return Response.json({
      error: '額度不足',
      code: 'insufficient_credits',
      credits_needed: creditsNeeded,
      credits_remaining: keyRow.monthly_credits - keyRow.credits_used,
    }, { status: 429, headers: corsHeaders })
  }

  const searxngUrl = env.SEARXNG_URL || 'https://searxng-tw.zeabur.app'

  // Query SearXNG
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    language: lang,
  })
  if (timeRange !== 'all') {
    params.set('time_range', timeRange)
  }

  try {
    const searxRes = await fetch(`${searxngUrl}/search?${params}`, {
      headers: { 'User-Agent': 'Kaiwu/1.0' },
    })

    if (!searxRes.ok) {
      return Response.json({ error: '搜尋引擎暫時無法使用', code: 'upstream_unavailable' }, { status: 502, headers: corsHeaders })
    }

    const searxData = await searxRes.json() as { results: any[] }
    const rawResults = (searxData.results || []).slice(0, maxResults)

    // Build base results
    let results: SearchResult[] = rawResults.map((r: any) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      published: r.publishedDate || null,
      engine: r.engine || null,
      score: r.score || null,
      language: lang,
    }))

    // Advanced mode: fetch pages + semantic chunking
    if (searchDepth === 'advanced') {
      // Fetch top pages in parallel (limit to 3 to keep LLM processing under timeout)
      const fetchTargets = results.slice(0, 3)
      const pageContents = await Promise.all(
        fetchTargets.map(r => fetchPageContent(r.url))
      )

      // Build content pairs for LLM chunking
      const contentPairs = fetchTargets
        .map((r, i) => ({ url: r.url, rawContent: pageContents[i] }))
        .filter((p): p is { url: string; rawContent: string } => p.rawContent !== null)

      if (contentPairs.length > 0) {
        const chunks = await semanticChunk(env, query, contentPairs)
        results = results.map(r => ({
          ...r,
          content: chunks.get(r.url) || undefined,
        }))
      }
    }

    // Generate answer if requested
    // In advanced mode, use Gemini (fast) since Ollama already spent time on chunking
    let answer: string | undefined
    if (includeAnswer) {
      if (searchDepth === 'advanced') {
        // Fast path — advanced already took time fetching/chunking, use Gemini for speed
        const context = results.slice(0, 5)
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content || r.snippet}`)
          .join('\n\n')
        const sysPrompt = '你是 Kaiwu 搜尋助手。根據搜尋結果回答問題，引用來源編號。使用繁體中文回答。'
        const prompt = `問題：${query}\n\n搜尋結果：\n${context}\n\n請根據以上搜尋結果，提供完整且精確的回答。在關鍵資訊後標注來源，如 [1][2]。`
        answer = await llmGenerate(env, prompt, sysPrompt, true)
      } else {
        // Normal path — basic search, Ollama has bandwidth for this
        answer = await generateAnswer(env, query, results)
      }
    }

    // Deduct credits
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET credits_used = credits_used + ?, updated_at = datetime('now') WHERE id = ?")
        .bind(creditsNeeded, keyRow.user_id),
      env.DB.prepare("UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?")
        .bind(keyRow.id),
      env.DB.prepare("INSERT INTO usage_logs (id, api_key_id, endpoint, credits_used, query, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
        .bind(crypto.randomUUID(), keyRow.id, '/v1/search', creditsNeeded, query),
    ])

    const response: any = {
      query,
      lang,
      search_depth: searchDepth,
      results,
      credits_used: keyRow.credits_used + creditsNeeded,
      credits_remaining: keyRow.monthly_credits - keyRow.credits_used - creditsNeeded,
    }

    if (answer) {
      response.answer = answer
    }

    return Response.json(response, { headers: corsHeaders })
  } catch (e: any) {
    return Response.json({ error: '搜尋失敗', code: 'internal_error' }, { status: 500, headers: corsHeaders })
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
