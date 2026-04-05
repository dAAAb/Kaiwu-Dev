interface Env {
  DB: D1Database
  SEARXNG_URL: string
  GEMINI_API_KEY: string
  OLLAMA_URL?: string
}

interface SearchRequest {
  query: string
  lang?: string
  max_results?: number
  time_range?: string
  search_depth?: 'basic' | 'advanced'
  include_answer?: boolean
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
  try {
    // SSRF protection: block internal/private IPs and non-HTTP protocols
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) return null

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Kaiwu/1.0 (search bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)

    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null

    const html = await res.text()
    const text = htmlToText(html)
    // Truncate to ~8000 chars to stay within LLM context limits
    return text.slice(0, 8000)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// LLM call — tries Ollama first, falls back to Gemini
// ---------------------------------------------------------------------------
async function llmGenerate(
  env: Env,
  prompt: string,
  systemPrompt?: string,
): Promise<string> {
  // Try Ollama first (self-hosted)
  if (env.OLLAMA_URL) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 25000)
      const messages: { role: string; content: string }[] = []
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
      messages.push({ role: 'user', content: prompt })

      const ollamaRes = await fetch(`${env.OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma4:e4b',
          messages,
          stream: false,
          options: { temperature: 0.3, num_predict: 2048 },
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (ollamaRes.ok) {
        const data = await ollamaRes.json() as { message: { content: string } }
        if (data.message?.content?.trim()) return data.message.content.trim()
      }
    } catch {
      // Fall through to Gemini
    }
  }

  // Gemini Flash (fallback)
  const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

  const contents: any[] = []
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] })
    contents.push({ role: 'model', parts: [{ text: '好的，我會按照指示處理。' }] })
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] })

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  })

  if (!geminiRes.ok) {
    throw new Error(`LLM 服務暫時無法使用`)
  }

  const geminiData = await geminiRes.json() as any
  return geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
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

  // Batch all pages into one prompt for efficiency
  const pages = results
    .map((r, i) => `=== 來源 ${i + 1} (${r.url}) ===\n${r.rawContent}`)
    .join('\n\n')

  const systemPrompt = '你是搜尋結果摘要助手。只輸出摘要，不要加額外說明。'
  const prompt = `搜尋查詢：「${query}」

從以下網頁內容中，針對每個來源提取與查詢最相關的 2-3 段摘要。
每段摘要不超過 300 字，保留關鍵數據和事實。
用 [...] 分隔每段摘要。

格式：
[來源 1]
摘要內容 [...] 摘要內容

[來源 2]
摘要內容 [...] 摘要內容

${pages}`

  try {
    const response = await llmGenerate(env, prompt, systemPrompt)
    // Parse response — split by [來源 N]
    const sourceBlocks = response.split(/\[來源\s*\d+\]/).filter(Boolean)
    results.forEach((r, i) => {
      if (sourceBlocks[i]) {
        chunks.set(r.url, sourceBlocks[i].trim())
      }
    })
  } catch {
    // If LLM fails, fall back to truncated raw content
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
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Auth
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: '需要 API 金鑰' }, { status: 401, headers: corsHeaders })
  }
  const apiKey = auth.slice(7)

  const keyRow = await env.DB.prepare(
    'SELECT ak.id, ak.user_id, u.credits_used, u.monthly_credits FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_prefix = ? AND ak.revoked = 0'
  ).bind(apiKey.slice(0, 12)).first<{ id: string; user_id: string; credits_used: number; monthly_credits: number }>()

  if (!keyRow) {
    return Response.json({ error: '無效的 API 金鑰' }, { status: 401, headers: corsHeaders })
  }

  // Parse body
  let body: SearchRequest
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
  const searchDepth = body.search_depth || 'basic'
  const includeAnswer = body.include_answer || false

  // Calculate credits needed
  let creditsNeeded = 1
  if (searchDepth === 'advanced') creditsNeeded += 1
  if (includeAnswer) creditsNeeded += 1

  // Check credits
  if (keyRow.credits_used + creditsNeeded > keyRow.monthly_credits) {
    return Response.json({
      error: '額度不足',
      credits_needed: creditsNeeded,
      credits_remaining: keyRow.monthly_credits - keyRow.credits_used,
    }, { status: 429, headers: corsHeaders })
  }

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
      // Fetch top pages in parallel (limit to 5 for latency)
      const fetchTargets = results.slice(0, 5)
      const pageContents = await Promise.all(
        fetchTargets.map(r => fetchPageContent(r.url))
      )

      // Build content pairs for LLM chunking
      const contentPairs = fetchTargets
        .map((r, i) => ({ url: r.url, rawContent: pageContents[i] }))
        .filter((p): p is { url: string; rawContent: string } => p.rawContent !== null)

      if (contentPairs.length > 0) {
        const chunks = await semanticChunk(env, body.query, contentPairs)
        results = results.map(r => ({
          ...r,
          content: chunks.get(r.url) || undefined,
        }))
      }
    }

    // Generate answer if requested
    let answer: string | undefined
    if (includeAnswer) {
      answer = await generateAnswer(env, body.query, results)
    }

    // Deduct credits
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET credits_used = credits_used + ?, updated_at = datetime('now') WHERE id = ?")
        .bind(creditsNeeded, keyRow.user_id),
      env.DB.prepare("UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?")
        .bind(keyRow.id),
      env.DB.prepare("INSERT INTO usage_logs (id, api_key_id, endpoint, credits_used, query, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
        .bind(crypto.randomUUID(), keyRow.id, '/v1/search', creditsNeeded, body.query),
    ])

    const response: any = {
      query: body.query,
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
    return Response.json({ error: '搜尋失敗' }, { status: 500, headers: corsHeaders })
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
