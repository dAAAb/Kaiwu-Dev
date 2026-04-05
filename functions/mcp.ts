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
  version: '0.2.0',
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
          description: '時間範圍篩選',
        },
      },
      required: ['query'],
    },
  },
]

// ---------------------------------------------------------------------------
// Auth: validate API key from query param or header
// ---------------------------------------------------------------------------
async function validateApiKey(
  env: Env,
  request: Request,
): Promise<{ id: string; user_id: string; credits_used: number; monthly_credits: number } | null> {
  const url = new URL(request.url)
  let apiKey = url.searchParams.get('apiKey')

  if (!apiKey) {
    const auth = request.headers.get('Authorization')
    if (auth?.startsWith('Bearer ')) apiKey = auth.slice(7)
  }

  if (!apiKey) return null

  return env.DB.prepare(
    'SELECT ak.id, ak.user_id, u.credits_used, u.monthly_credits FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_prefix = ? AND ak.revoked = 0'
  ).bind(apiKey.slice(0, 12)).first<{ id: string; user_id: string; credits_used: number; monthly_credits: number }>()
}

// ---------------------------------------------------------------------------
// Call the search API internally
// ---------------------------------------------------------------------------
async function callSearch(env: Env, request: Request, args: any): Promise<string> {
  const url = new URL(request.url)
  let apiKey = url.searchParams.get('apiKey')
  if (!apiKey) {
    const auth = request.headers.get('Authorization')
    if (auth?.startsWith('Bearer ')) apiKey = auth.slice(7)
  }

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
      max_results: args.max_results || 5,
      lang: args.lang || 'zh-TW',
      time_range: args.time_range,
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
// JSON-RPC helpers
// ---------------------------------------------------------------------------
function jsonrpcResponse(id: number | string, result: any) {
  return { jsonrpc: '2.0', id, result }
}

function jsonrpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

// ---------------------------------------------------------------------------
// POST handler — JSON-RPC over Streamable HTTP
// ---------------------------------------------------------------------------
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Validate API key
  const keyRow = await validateApiKey(env, request)
  if (!keyRow) {
    return Response.json(
      jsonrpcError(null, -32000, '需要 API 金鑰。請在 URL 加上 ?apiKey=kw_xxx 或使用 Authorization header。'),
      { status: 401, headers: corsHeaders },
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json(
      jsonrpcError(null, -32700, 'Parse error'),
      { status: 400, headers: corsHeaders },
    )
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const responses = []
    for (const msg of body) {
      const res = await handleMessage(env, request, msg)
      if (res) responses.push(res)
    }
    if (responses.length === 0) {
      return new Response('', { status: 202, headers: corsHeaders })
    }
    return Response.json(responses, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Handle single message
  const result = await handleMessage(env, request, body)

  // Notification (no id) → 202
  if (!result) {
    return new Response('', { status: 202, headers: corsHeaders })
  }

  // Initialize → include session header
  const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (body.method === 'initialize') {
    headers['Mcp-Session-Id'] = crypto.randomUUID()
  }

  return new Response(JSON.stringify(result), { headers })
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
      if (toolName !== 'kaiwu_search') {
        return jsonrpcResponse(msg.id, {
          content: [{ type: 'text', text: `未知的工具：${toolName}` }],
          isError: true,
        })
      }

      try {
        const text = await callSearch(env, request, msg.params?.arguments || {})
        return jsonrpcResponse(msg.id, {
          content: [{ type: 'text', text }],
          isError: false,
        })
      } catch (e: any) {
        return jsonrpcResponse(msg.id, {
          content: [{ type: 'text', text: `搜尋失敗：${e.message || '未知錯誤'}` }],
          isError: true,
        })
      }
    }

    default:
      return jsonrpcError(msg.id, -32601, `Method not found: ${msg.method}`)
  }
}

// ---------------------------------------------------------------------------
// GET handler — SSE stream (keep-alive for server-initiated messages)
// ---------------------------------------------------------------------------
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const keyRow = await validateApiKey(env, request)
  if (!keyRow) {
    return Response.json(
      { error: '需要 API 金鑰' },
      { status: 401, headers: corsHeaders },
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
