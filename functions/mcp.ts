import { lookupApiKey, type ApiKeyRecord } from './_lib/auth'
import { isPlainObject } from './_lib/validate'

interface Env {
  DB: D1Database
  SEARXNG_URL: string
  GEMINI_API_KEY: string
  OLLAMA_URL?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Accept',
}

const SERVER_INFO = {
  name: 'kaiwu',
  version: '0.3.0',
}

const TOOLS = [
  {
    name: 'kaiwu_search',
    description: '搜尋中文網頁內容。支援繁簡中文自動擴展、多引擎聚合（Google、DuckDuckGo、Brave）、語意摘要與答案生成。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜尋關鍵字' },
        search_depth: {
          type: 'string',
          enum: ['basic', 'advanced'],
          description: 'basic：快速搜尋回傳 snippets。advanced：抓取網頁全文並產生語意摘要（較慢但更詳細）',
        },
        include_answer: {
          type: 'boolean',
          description: '是否根據搜尋結果生成綜合答案',
        },
        max_results: {
          type: 'number',
          description: '回傳結果數量（預設 5，最大 20）',
        },
        lang: {
          type: 'string',
          description: '搜尋語言（預設 zh-TW）',
        },
        time_range: {
          type: 'string',
          enum: ['day', 'week', 'month', 'year', 'all'],
          description: '時間範圍篩選。省略則依查詢語意推斷。',
        },
        category: {
          type: 'string',
          enum: ['general', 'news', 'auto'],
          description: 'general 一般網頁、news 新聞；省略或 auto 則依查詢推斷。',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'kaiwu_extract',
    description: '從一個或多個 URL 抓取內容，轉成乾淨的 markdown 或純文字（自動移除導覽列、廣告等雜訊）。已有特定網址、想讀全文時使用。',
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: '要抓取的 URL 清單（最多 20 個）',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'text'],
          description: '輸出格式（預設 markdown）',
        },
        query: {
          type: 'string',
          description: '選填。只保留與此查詢相關的內容（LLM 語意過濾）',
        },
      },
      required: ['urls'],
    },
  },
]

// ---------------------------------------------------------------------------
// Auth: validate API key from header or query param
// ---------------------------------------------------------------------------
type KeyRow = ApiKeyRecord
type AuthErrorCode = 'missing_api_key' | 'invalid_api_key'

// Resolve the API key: `Authorization: Bearer kw_…` header first, then the
// legacy `?apiKey=` query parameter (kept for clients that cannot set headers).
function getApiKey(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const fromHeader = auth.slice(7).trim()
    if (fromHeader) return fromHeader
  }
  return new URL(request.url).searchParams.get('apiKey')
}

async function validateApiKey(
  env: Env,
  request: Request,
): Promise<{ keyRow: KeyRow | null; code: AuthErrorCode | null }> {
  const apiKey = getApiKey(request)
  if (!apiKey) return { keyRow: null, code: 'missing_api_key' }

  // Shared full-key lookup (key_prefix + key_hash) with lazy monthly credit reset
  const keyRow = await lookupApiKey(env, apiKey)
  return keyRow ? { keyRow, code: null } : { keyRow: null, code: 'invalid_api_key' }
}

// ---------------------------------------------------------------------------
// Call the search API internally
// ---------------------------------------------------------------------------
async function callSearch(env: Env, request: Request, args: any): Promise<string> {
  const url = new URL(request.url)
  const apiKey = getApiKey(request)

  const searchUrl = `${url.origin}/v1/search`
  const res = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: args.query,
      search_depth: args.search_depth || 'basic',
      include_answer: args.include_answer || false,
      // Forwarded as-is: /v1/search applies the shared max_results rules
      // (omitted/0 → 5, 1–20 clamped, otherwise 400 invalid_request).
      max_results: args.max_results,
      lang: args.lang || 'zh-TW',
      time_range: args.time_range,
      category: args.category,
    }),
  })

  const data = await res.json() as any

  if (data.error) {
    return `搜尋錯誤：${data.error}`
  }

  // Format results as readable text for LLM consumption
  let output = ''

  if (data.answer) {
    output += `## 答案\n${data.answer}\n\n---\n\n`
  }

  output += `## 搜尋結果（${data.results.length} 筆）\n\n`
  for (const r of data.results) {
    output += `### ${r.title}\n`
    output += `${r.url}\n`
    if (r.content) {
      output += `${r.content}\n`
    } else {
      output += `${r.snippet}\n`
    }
    output += '\n'
  }

  output += `\n---\nCredits: ${data.credits_remaining} 剩餘`

  return output
}

// ---------------------------------------------------------------------------
// Call the extract API internally
// ---------------------------------------------------------------------------
async function callExtract(env: Env, request: Request, args: any): Promise<string> {
  const url = new URL(request.url)
  const apiKey = getApiKey(request)

  // Accept urls as array or comma-separated string
  let urls = args.urls
  if (typeof urls === 'string') urls = urls.split(',').map((s: string) => s.trim())

  const extractUrl = `${url.origin}/v1/extract`
  const res = await fetch(extractUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      urls,
      format: args.format || 'markdown',
      query: args.query,
    }),
  })

  const data = await res.json() as any

  if (data.error) {
    return `抓取錯誤：${data.error}`
  }

  // Format results as readable text for LLM consumption
  let output = `## 抓取結果（${data.success_count} 成功 / ${data.failed_count} 失敗）\n\n`
  for (const r of data.results) {
    if (r.status === 'success') {
      output += `### ${r.title || r.url}\n${r.url}\n\n${r.content}\n\n---\n\n`
    } else {
      output += `### ✗ ${r.url}\n抓取失敗：${r.error}\n\n---\n\n`
    }
  }

  output += `\nCredits: ${data.credits_remaining} 剩餘`

  return output
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
function jsonrpcResponse(id: number | string, result: any) {
  return { jsonrpc: '2.0', id, result }
}

function jsonrpcError(id: number | string | null, code: number, message: string, data?: Record<string, unknown>) {
  return { jsonrpc: '2.0', id, error: data ? { code, message, data } : { code, message } }
}

// Format as SSE event (matching Tavily's format)
function sseResponse(data: any, extraHeaders?: Record<string, string>): Response {
  const body = `event: message\ndata: ${JSON.stringify(data)}\n\n`
  return new Response(body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      ...extraHeaders,
    },
  })
}

// ---------------------------------------------------------------------------
// POST handler — JSON-RPC over Streamable HTTP (SSE transport)
// ---------------------------------------------------------------------------
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Validate API key
  const { keyRow, code: authCode } = await validateApiKey(env, request)
  if (!keyRow) {
    return sseResponse(
      jsonrpcError(null, -32000, '需要 API 金鑰。請在 URL 加上 ?apiKey=kw_xxx 或使用 Authorization header。', { code: authCode }),
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return sseResponse(jsonrpcError(null, -32700, 'Parse error', { code: 'invalid_json' }))
  }

  // JSON-RPC 2.0: a request must be an object, a batch a non-empty array of objects.
  // (`null`, numbers, strings, [] and batches with non-object entries all land here.)
  const isBatch = Array.isArray(body)
  if (isBatch ? body.length === 0 || !body.every(isPlainObject) : !isPlainObject(body)) {
    return sseResponse(jsonrpcError(null, -32600, 'Invalid Request', { code: 'invalid_request' }))
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const events: string[] = []
    for (const msg of body) {
      const res = await handleMessage(env, request, msg)
      if (res) events.push(`event: message\ndata: ${JSON.stringify(res)}\n\n`)
    }
    if (events.length === 0) {
      return new Response('', { status: 202, headers: corsHeaders })
    }
    return new Response(events.join(''), {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' },
    })
  }

  // Handle single message
  const result = await handleMessage(env, request, body)

  // Notification (no id) → 202
  if (!result) {
    return new Response('', { status: 202, headers: corsHeaders })
  }

  // Initialize → include session header
  const extraHeaders: Record<string, string> = {}
  if (body.method === 'initialize') {
    extraHeaders['Mcp-Session-Id'] = crypto.randomUUID()
  }

  return sseResponse(result, extraHeaders)
}

async function handleMessage(env: Env, request: Request, msg: any): Promise<any | null> {
  // Notification (no id)
  if (msg.id === undefined || msg.id === null) {
    return null
  }

  switch (msg.method) {
    case 'initialize':
      return jsonrpcResponse(msg.id, {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      })

    case 'tools/list':
      return jsonrpcResponse(msg.id, { tools: TOOLS })

    case 'tools/call': {
      const toolName = msg.params?.name
      const args = msg.params?.arguments || {}

      try {
        let text: string
        if (toolName === 'kaiwu_search') {
          text = await callSearch(env, request, args)
        } else if (toolName === 'kaiwu_extract') {
          text = await callExtract(env, request, args)
        } else {
          return jsonrpcResponse(msg.id, {
            content: [{ type: 'text', text: `未知的工具：${toolName}` }],
            isError: true,
          })
        }
        return jsonrpcResponse(msg.id, {
          content: [{ type: 'text', text }],
          isError: false,
        })
      } catch (e: any) {
        return jsonrpcResponse(msg.id, {
          content: [{ type: 'text', text: `工具執行失敗：${e.message || '未知錯誤'}` }],
          isError: true,
        })
      }
    }

    default:
      return jsonrpcError(msg.id, -32601, `Method not found: ${msg.method}`, { code: 'method_not_found' })
  }
}

// ---------------------------------------------------------------------------
// GET handler — SSE stream (keep-alive for server-initiated messages)
// ---------------------------------------------------------------------------
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const { keyRow, code: authCode } = await validateApiKey(env, request)
  if (!keyRow) {
    // RFC 6750 §3.1: no error attribute when the request carried no credential.
    const challenge = authCode === 'missing_api_key' ? 'Bearer realm="kaiwu"' : 'Bearer realm="kaiwu", error="invalid_token"'
    return Response.json(
      { error: '需要 API 金鑰', code: authCode },
      { status: 401, headers: { ...corsHeaders, 'WWW-Authenticate': challenge } },
    )
  }

  // Return an SSE endpoint that sends a ping then closes
  // (Kaiwu doesn't need server-initiated messages, but clients may open this)
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'))
      // Keep stream open for 30s then close
      setTimeout(() => controller.close(), 30000)
    },
  })

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ---------------------------------------------------------------------------
// DELETE handler — terminate session
// ---------------------------------------------------------------------------
export const onRequestDelete: PagesFunction<Env> = async () => {
  return new Response('', { status: 202, headers: corsHeaders })
}

// ---------------------------------------------------------------------------
// OPTIONS handler — CORS preflight
// ---------------------------------------------------------------------------
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { headers: corsHeaders })
}

/** HEAD mirrors GET (status + headers, no body) so probes/uptime checks see the real auth state. */
export const onRequestHead: PagesFunction<Env> = async (context) => {
  const res = await onRequestGet(context)
  return new Response(null, res)
}
