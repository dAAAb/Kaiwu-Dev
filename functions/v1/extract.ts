import { lookupApiKey } from '../_lib/auth'
import { isPublicHttpUrl, safeFetch, TooManyRedirectsError, UnsafeUrlError } from '../_lib/net'
import { isPlainObject } from '../_lib/validate'

interface Env {
  DB: D1Database
  GEMINI_API_KEY: string
  OLLAMA_URL?: string
}

interface ExtractResult {
  url: string
  title: string | null
  content: string
  format: 'markdown' | 'text'
  length: number
  status: 'success' | 'failed'
  error?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ---------------------------------------------------------------------------
// Decode common HTML entities
// ---------------------------------------------------------------------------
function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

// ---------------------------------------------------------------------------
// Extract <title>
// ---------------------------------------------------------------------------
function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ').trim()) : null
}

// ---------------------------------------------------------------------------
// Strip boilerplate, isolate <body>
// ---------------------------------------------------------------------------
function isolateBody(html: string): string {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  const body = h.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (body) h = body[1]
  // Prefer <article> or <main> when present (likely the real content)
  const article = h.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (article && article[1].length > 200) return article[1]
  const main = h.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (main && main[1].length > 200) return main[1]
  return h
}

// ---------------------------------------------------------------------------
// HTML → clean markdown (lightweight, no DOM parser in Workers)
// ---------------------------------------------------------------------------
function htmlToMarkdown(html: string): string {
  let h = isolateBody(html)

  // Headings
  for (let i = 1; i <= 6; i++) {
    const tag = `h${i}`
    h = h.replace(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'),
      (_, t) => `\n\n${'#'.repeat(i)} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
  }

  h = h
    // Links → [text](href)
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, t) => {
        const text = t.replace(/<[^>]+>/g, '').trim()
        if (!text) return ''
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return text
        return `[${text}](${href})`
      })
    // Bold / italic
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_, t) => `**${t.replace(/<[^>]+>/g, '').trim()}**`)
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_, t) => `*${t.replace(/<[^>]+>/g, '').trim()}*`)
    // Inline code / pre
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, t) => `\n\n\`\`\`\n${t.replace(/<[^>]+>/g, '')}\n\`\`\`\n\n`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, t) => `\`${t.replace(/<[^>]+>/g, '')}\``)
    // List items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, '').trim()}`)
    // Block separators
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|tr|blockquote|ul|ol|table)>/gi, '\n\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')

  return decodeEntities(h)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------------------
// HTML → plain text
// ---------------------------------------------------------------------------
function htmlToText(html: string): string {
  return decodeEntities(
    isolateBody(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li|tr|blockquote|section)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------------------
// Fetch + convert a single URL
// SSRF guard lives in _lib/net (public http(s) hosts only; every redirect hop
// is re-validated, max 5).
// ---------------------------------------------------------------------------
async function extractOne(
  url: string,
  format: 'markdown' | 'text',
  timeoutMs = 8000,
): Promise<ExtractResult> {
  const failed = (error: string): ExtractResult => ({ url, title: null, content: '', format, length: 0, status: 'failed', error })
  if (!isPublicHttpUrl(url)) return failed('無效或不允許的 URL')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await safeFetch(url, {
      headers: {
        'User-Agent': 'Kaiwu/1.0 (+https://kaiwu.dev; extract bot)',
        'Accept': 'text/html,application/xhtml+xml,text/plain',
      },
      signal: controller.signal,
    })

    if (!res.ok) return failed(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return failed(`不支援的內容類型: ${contentType}`)
    }

    const html = await res.text()
    const title = extractTitle(html)
    const content = format === 'text' ? htmlToText(html) : htmlToMarkdown(html)
    return { url, title, content, format, length: content.length, status: 'success' }
  } catch (e: any) {
    if (e instanceof UnsafeUrlError) return failed('無效或不允許的 URL')
    if (e instanceof TooManyRedirectsError) return failed('重新導向過多')
    return failed(e?.name === 'AbortError' ? '逾時' : '抓取失敗')
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// LLM (Gemini → Ollama fallback) for query-based filtering
// ---------------------------------------------------------------------------
async function llmGenerate(env: Env, prompt: string, systemPrompt: string): Promise<string> {
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: '好的。' }] },
              { role: 'user', parts: [{ text: prompt }] },
            ],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
          }),
        },
      )
      if (res.ok) {
        const data = await res.json() as any
        const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (txt) return txt
      }
    } catch {}
  }
  throw new Error('LLM unavailable')
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
    return await handleExtract(context)
  } catch {
    return Response.json({ error: 'Internal error', code: 'internal_error' }, { status: 500, headers: corsHeaders })
  }
}

async function handleExtract(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
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

  // Normalize URL input — accept url, urls (string or array), comma-separated
  let urls: string[] = []
  if (body.urls !== undefined && body.urls !== null) {
    if (Array.isArray(body.urls)) {
      if (!body.urls.every((u): u is string => typeof u === 'string')) return badRequest('urls 陣列的每個元素必須是字串')
      urls = body.urls
    } else if (typeof body.urls === 'string') {
      urls = body.urls.split(',')
    } else {
      return badRequest('urls 必須是字串陣列或逗號分隔字串')
    }
  } else if (body.url !== undefined && body.url !== null) {
    if (typeof body.url !== 'string') return badRequest('url 必須是字串')
    urls = [body.url]
  }
  urls = urls.map(u => u.trim()).filter(Boolean)

  if (urls.length === 0) {
    return badRequest('缺少 urls 參數', 'missing_urls')
  }
  if (urls.length > 20) {
    return badRequest('一次最多 20 個 URL', 'too_many_urls')
  }

  if (body.format !== undefined && body.format !== null && body.format !== 'markdown' && body.format !== 'text') {
    return badRequest('format 必須是 markdown 或 text')
  }
  const format: 'markdown' | 'text' = body.format === 'text' ? 'text' : 'markdown'

  if (body.query !== undefined && body.query !== null && typeof body.query !== 'string') return badRequest('query 必須是字串')
  const query = typeof body.query === 'string' ? body.query.trim() : ''

  // Credits: 1 per URL, +1 if query-based LLM filtering is requested
  let creditsNeeded = urls.length
  if (query) creditsNeeded += 1

  if (keyRow.credits_used + creditsNeeded > keyRow.monthly_credits) {
    return Response.json({
      error: '額度不足',
      code: 'insufficient_credits',
      credits_needed: creditsNeeded,
      credits_remaining: keyRow.monthly_credits - keyRow.credits_used,
    }, { status: 429, headers: corsHeaders })
  }

  // Fetch all URLs in parallel
  let results = await Promise.all(urls.map(u => extractOne(u, format)))

  // Optional query-based semantic filtering on successful extractions
  if (query) {
    const ok = results.filter(r => r.status === 'success' && r.content)
    if (ok.length > 0) {
      const pages = ok
        .map((r, i) => `=== 來源 ${i + 1} (${r.url}) ===\n${r.content.slice(0, 6000)}`)
        .join('\n\n')
      const systemPrompt = '你是內容提取助手。只輸出與查詢相關的內容，保留 markdown 格式，不要加額外說明。'
      const prompt = `查詢：「${query}」

針對每個來源，只保留與查詢相關的段落（保留標題與重點，移除無關內容）。

格式：
[來源 1]
相關內容

[來源 2]
相關內容

${pages}`
      try {
        const response = await llmGenerate(env, prompt, systemPrompt)
        const blocks = response.split(/\[來源\s*\d+\]/).filter(Boolean)
        let bi = 0
        results = results.map(r => {
          if (r.status === 'success' && r.content) {
            const filtered = blocks[bi++]?.trim()
            if (filtered) return { ...r, content: filtered, length: filtered.length }
          }
          return r
        })
      } catch {
        // LLM unavailable — fall back to raw extraction, no extra charge
        creditsNeeded -= 1
      }
    } else {
      creditsNeeded -= 1
    }
  }

  // Only charge for URLs that succeeded (plus query surcharge if applied)
  const successCount = results.filter(r => r.status === 'success').length
  const failCount = results.length - successCount
  creditsNeeded -= failCount > 0 ? failCount : 0
  if (creditsNeeded < 0) creditsNeeded = 0

  // Deduct credits + log
  if (creditsNeeded > 0) {
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET credits_used = credits_used + ?, updated_at = datetime('now') WHERE id = ?")
        .bind(creditsNeeded, keyRow.user_id),
      env.DB.prepare("UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?")
        .bind(keyRow.id),
      env.DB.prepare("INSERT INTO usage_logs (id, api_key_id, endpoint, credits_used, query, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))")
        .bind(crypto.randomUUID(), keyRow.id, '/v1/extract', creditsNeeded, urls.join(', ').slice(0, 500)),
    ])
  }

  return Response.json({
    results,
    success_count: successCount,
    failed_count: failCount,
    format,
    credits_used: keyRow.credits_used + creditsNeeded,
    credits_remaining: keyRow.monthly_credits - keyRow.credits_used - creditsNeeded,
  }, { headers: corsHeaders })
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders })
}
