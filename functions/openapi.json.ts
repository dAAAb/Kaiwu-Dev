// GET /openapi.json — OpenAPI 3.1 description of the 開物 Kaiwu API.
//
// Hand-maintained from the real handlers in functions/v1/*, functions/api/*
// and functions/mcp.ts. Keep request/response shapes in sync when those change.
// This is the public document: dashboard-internal routes (/api/keys,
// /api/auth/callback — Privy-token auth) are deliberately not listed.
// /api/openapi.json 301-redirects here (root middleware).

export const API_VERSION = '1.0.0'

const SITE = 'https://kaiwu.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const ERROR_REF = { $ref: '#/components/schemas/Error' }

function jsonBody(ref: string, description?: string) {
  return { description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } }
}

function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: ERROR_REF } } }
}

const unauthorized = errorResponse(
  '未授權：缺少 Authorization header（code=missing_api_key，WWW-Authenticate: Bearer realm="kaiwu"）' +
  '或金鑰無效／已撤銷（code=invalid_api_key，WWW-Authenticate: Bearer realm="kaiwu", error="invalid_token"）。',
)
const internalError = errorResponse('伺服器內部錯誤（code=internal_error）。')
const insufficientCredits = errorResponse(
  '額度不足（code=insufficient_credits）。body 另含 credits_needed 與 credits_remaining，可據此降級（改 basic、減少 max_results）或等每月重置。',
)

export const spec = {
  openapi: '3.1.0',
  info: {
    title: '開物 Kaiwu API',
    version: API_VERSION,
    summary: '中文世界的 AI 搜尋 API · Web search built for AI agents, in Chinese',
    description:
      '開物 Kaiwu 是專為 AI Agent 打造的中文搜尋 API：聚合 Google / DuckDuckGo / Brave、繁簡雙語自動互查、不經百度／搜狗等已審查來源，' +
      '回傳給 LLM 最佳化的乾淨結果，並提供網頁抓取（extract）、AI 綜合答案與額度查詢；資料路徑在台灣。' +
      '所有錯誤一律回傳 JSON `{error, code}`。' +
      ' Kaiwu is a Chinese-language web search and extraction API built for AI agents, returning LLM-ready results with optional AI-generated answers.',
    termsOfService: `${SITE}/`,
    contact: { name: '開物 Kaiwu', email: 'hello@kaiwu.dev', url: SITE },
    license: { name: 'MIT', identifier: 'MIT' },
    'x-guidance':
      'To use this API as an agent: sign in at https://kaiwu.dev/dashboard and copy an API key (it starts with kw_), then send it on every /v1/* request as ' +
      '`Authorization: Bearer kw_…` with `Content-Type: application/json`. Each call spends credits from a monthly allowance (Free plan: 1,000/month): ' +
      'POST /v1/search costs 1 credit (search_depth=basic), 2 (advanced), plus 1 when include_answer=true; POST /v1/extract costs 1 per successfully fetched URL ' +
      'plus 1 when `query` filtering is used (failed URLs are free); GET /v1/credits is free. Check /v1/credits before large batches. On HTTP 429 the body carries ' +
      'credits_needed and credits_remaining — degrade (basic depth, fewer results) or wait for the monthly reset; on 502 back off and retry. Recommended pipeline: ' +
      'basic search to find URLs → extract only the pages you actually need → advanced search only when you need LLM-summarised page content. ' +
      'Keep queries short (< 400 characters, keyword-style); split complex questions into sub-queries. MCP clients can use https://kaiwu.dev/mcp with the same key.',
    'x-llms-txt': `${SITE}/llms.txt`,
    'x-docs': `${SITE}/developers`,
  },
  externalDocs: { description: '開發者文件 · Developer docs', url: `${SITE}/developers` },
  servers: [{ url: SITE, description: 'Production（Cloudflare Pages，部署於台灣資料路徑）' }],
  tags: [
    { name: 'Search', description: '中文網路搜尋（繁簡互查、無審查、LLM-ready）' },
    { name: 'Extract', description: '從 URL 抓取乾淨的 markdown / 純文字' },
    { name: 'Credits', description: '額度查詢' },
    { name: 'MCP', description: 'Model Context Protocol server（Streamable HTTP，JSON-RPC 2.0）' },
    { name: 'Public', description: '公開、免認證的端點' },
    { name: 'Meta', description: 'API 描述與健康檢查' },
  ],
  security: [{ apiKey: [] }],
  paths: {
    '/v1/search': {
      post: {
        operationId: 'searchWeb',
        tags: ['Search'],
        summary: '搜尋中文網路',
        description:
          '以 SearXNG 聚合 Google / DuckDuckGo / Brave 搜尋，回傳給 LLM 最佳化的結果。`search_depth=basic` 回傳搜尋引擎 snippet；' +
          '`advanced` 另抓取前 3 筆結果的網頁全文並由 LLM 語意摘要為 `content`；`include_answer=true` 額外生成繁體中文綜合答案（附 [1][2] 來源標註）。' +
          '省略 `time_range` / `category`（或 `category=auto`）時，會先用 LLM 依查詢推斷時間窗、新聞／一般分類，並展開繁簡與官方名稱；呼叫端明確指定的值優先。' +
          '搜尋引擎回空陣列時會對調分類或放寬時間再試；仍無結果則不生成答案、不加收 include_answer 額度，並回 `warning`。' +
          '\n\n額度：basic = 1、advanced = 2、include_answer 另 +1（僅在有搜尋結果時）。額度不足時回 429 且不扣款。' +
          '\n\n回應中的 `credits_used` 為本月累計已用額度（含本次），`credits_remaining` 為剩餘額度。',
        security: [{ apiKey: [] }],
        'x-credits': { basic: 1, advanced: 2, include_answer: '+1', unit: 'credits per call' },
        requestBody: { required: true, ...jsonBody('SearchRequest') },
        responses: {
          '200': jsonBody('SearchResponse', '搜尋結果'),
          '400': errorResponse(
            '請求無效：JSON 無法解析（code=invalid_json）、缺少或空白 query（code=missing_query），' +
            '或欄位型別／值不符（code=invalid_request：body 非 JSON 物件、query 非字串、max_results 非 0–20 的整數、time_range / category / search_depth 不在列舉內、include_answer 非布林）。',
          ),
          '401': unauthorized,
          '429': insufficientCredits,
          '500': errorResponse('搜尋流程失敗（code=internal_error）。'),
          '502': errorResponse('搜尋引擎暫時無法使用（code=upstream_unavailable），建議退避重試。'),
        },
      },
    },
    '/v1/extract': {
      post: {
        operationId: 'extractUrls',
        tags: ['Extract'],
        summary: '從 URL 抓取乾淨內容',
        description:
          '抓取一或多個 URL（最多 20 個），移除 script / nav / footer / 廣告等雜訊，轉成 markdown（預設）或純文字。' +
          '每個 URL 獨立回報 `status`（success / failed），失敗不計費；可選 `query` 以 LLM 只保留與查詢相關的段落。' +
          '\n\n額度：每個成功 URL = 1、使用 `query` 另 +1（LLM 不可用時自動退回原文且不加收）。內網／非 http(s) URL 會被拒絕（該筆 status=failed）。' +
          '\n\n`urls` 可為陣列或逗號分隔字串；也接受單一 `url` 欄位。',
        security: [{ apiKey: [] }],
        'x-credits': { per_success_url: 1, query: '+1', max_urls: 20, unit: 'credits per call' },
        requestBody: { required: true, ...jsonBody('ExtractRequest') },
        responses: {
          '200': jsonBody('ExtractResponse', '逐 URL 的抓取結果（含失敗項目）'),
          '400': errorResponse(
            '請求無效：JSON 無法解析（invalid_json）、缺少 urls（missing_urls）、超過 20 個 URL（too_many_urls），' +
            '或欄位型別不符（invalid_request：body 非 JSON 物件、urls 含非字串元素、url / query 非字串、format 不在列舉內）。',
          ),
          '401': unauthorized,
          '429': insufficientCredits,
          '500': internalError,
        },
      },
    },
    '/v1/credits': {
      get: {
        operationId: 'getCredits',
        tags: ['Credits'],
        summary: '查詢剩餘額度',
        description:
          '回傳目前金鑰所屬帳戶的每月額度、已用量、剩餘量與重置時間。免費（0 額度）。大量搜尋／抓取前建議先呼叫。' +
          '\n\n額度每月 1 日 00:00 UTC 重置：到達 `resets_at` 後的第一次 API 請求（任一端點）會把 `credits_used` 歸零並把 `resets_at` 推到下個月 1 日。',
        security: [{ apiKey: [] }],
        'x-credits': { cost: 0 },
        responses: {
          '200': jsonBody('CreditsResponse', '額度狀態'),
          '401': unauthorized,
        },
      },
    },
    '/mcp': {
      post: {
        operationId: 'mcpJsonRpc',
        tags: ['MCP'],
        summary: 'MCP Server（JSON-RPC 2.0 over Streamable HTTP）',
        description:
          'Model Context Protocol 端點。送出 JSON-RPC 2.0 訊息（單則或陣列），支援 `initialize`、`tools/list`、`tools/call`；' +
          '提供工具 `kaiwu_search`（參數同 SearchRequest）與 `kaiwu_extract`（參數同 ExtractRequest 的 urls / format / query）。' +
          '\n\n認證：`Authorization: Bearer kw_…` header 優先，亦接受 `?apiKey=kw_…` 查詢參數。**未認證時 HTTP 狀態仍為 200**，' +
          'body 為 JSON-RPC error（code -32000，`error.data.code` = missing_api_key / invalid_api_key）。' +
          '\n\n回應為 `text/event-stream`，每則訊息一個 SSE frame：`event: message\\ndata: <JSON-RPC response>\\n\\n`。' +
          '`initialize` 回應附 `Mcp-Session-Id` header。純通知（無 id）回 202 空 body。工具結果為 `result.content[0].text`（markdown），失敗時 `result.isError=true`。' +
          '\n\n額度與 /v1/search、/v1/extract 相同。範例：`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"kaiwu_search","arguments":{"query":"台灣 AI 基本法"}}}`',
        security: [{ apiKey: [] }, { apiKeyQuery: [] }],
        'x-credits': { kaiwu_search: 'same as /v1/search (1–3)', kaiwu_extract: 'same as /v1/extract' },
        'x-stream-response': true,
        'x-mcp': {
          transport: 'streamable-http',
          protocolVersion: '2025-03-26',
          tools: [
            { name: 'kaiwu_search', description: '搜尋中文網頁內容', inputSchema: '#/components/schemas/SearchRequest' },
            { name: 'kaiwu_extract', description: '從 URL 抓取乾淨內容', inputSchema: '#/components/schemas/McpExtractToolInput' },
          ],
        },
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { $ref: '#/components/schemas/McpRequest' },
                  { type: 'array', items: { $ref: '#/components/schemas/McpRequest' }, description: 'JSON-RPC batch' },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'SSE stream，每個 frame 的 data 為一則 JSON-RPC response（含認證失敗的 -32000 error）',
            headers: { 'Mcp-Session-Id': { description: '僅 initialize 回應附帶', schema: { type: 'string' } } },
            content: { 'text/event-stream': { schema: { $ref: '#/components/schemas/McpResponse' } } },
          },
          '202': { description: '純通知（無 id）已接收，無 body' },
        },
      },
      get: {
        operationId: 'mcpEventStream',
        tags: ['MCP'],
        summary: 'MCP 伺服器事件流（keep-alive）',
        description: '開啟 SSE 串流：送出一個 `event: ping` 後保持 30 秒關閉。Kaiwu 不主動推送訊息，此端點僅供需要它的 MCP 客戶端使用。',
        security: [{ apiKey: [] }, { apiKeyQuery: [] }],
        'x-credits': { cost: 0 },
        'x-stream-response': true,
        responses: {
          '200': { description: 'text/event-stream', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          '401': unauthorized,
        },
      },
      delete: {
        operationId: 'mcpEndSession',
        tags: ['MCP'],
        summary: '結束 MCP session',
        description: '無狀態伺服器，一律回 202。',
        security: [],
        'x-credits': { cost: 0 },
        responses: { '202': { description: 'Accepted，無 body' } },
      },
    },
    '/api/stats': {
      get: {
        operationId: 'getPublicStats',
        tags: ['Public'],
        summary: '公開使用統計',
        description: '用戶數、查詢數、累計扣除額度與估算處理 token 數。免認證、可快取（Cache-Control public, max-age=60）。數字含展示基線，token 為估算值。',
        security: [],
        'x-credits': { cost: 0 },
        responses: {
          '200': jsonBody('Stats', '統計'),
          '500': errorResponse('統計暫時無法取得（code=internal_error）。'),
        },
      },
    },
    '/api/health': {
      get: {
        operationId: 'getHealth',
        tags: ['Meta'],
        summary: '健康檢查',
        description: '不觸碰資料庫的存活檢查。',
        security: [],
        'x-credits': { cost: 0 },
        responses: { '200': jsonBody('Health', '服務正常') },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['Meta'],
        summary: '本 OpenAPI 文件',
        description: '回傳此 OpenAPI 3.1 文件（application/json，public max-age=300）。/api/openapi.json 與 /.well-known/openapi.json 會 301 轉址到此。',
        security: [],
        'x-credits': { cost: 0 },
        responses: {
          '200': { description: 'OpenAPI 3.1 document', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'kw_<32 chars>',
        description: 'API 金鑰：`Authorization: Bearer kw_…`。到 https://kaiwu.dev/dashboard 取得。',
      },
      apiKeyQuery: {
        type: 'apiKey',
        in: 'query',
        name: 'apiKey',
        description: '僅 /mcp 接受的替代方式：`?apiKey=kw_…`（無法設定 header 的 MCP 客戶端用）。',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        description: '所有錯誤回應的統一格式。',
        required: ['error'],
        properties: {
          error: { type: 'string', description: '人類可讀的錯誤訊息（多為繁體中文）' },
          code: {
            type: 'string',
            description: '機器可讀錯誤碼',
            examples: [
              'missing_api_key', 'invalid_api_key', 'invalid_json', 'invalid_request', 'missing_query', 'missing_urls', 'too_many_urls',
              'insufficient_credits', 'upstream_unavailable', 'internal_error', 'not_found', 'method_not_allowed',
            ],
          },
          credits_needed: { type: 'integer', description: '僅 429：本次所需額度' },
          credits_remaining: { type: 'integer', description: '僅 429：目前剩餘額度' },
          hint: { type: 'string', description: '僅 404 / 405：修正建議' },
          docs: { type: 'string', format: 'uri', description: '僅 404 / 405：OpenAPI 文件位置' },
          llms_txt: { type: 'string', format: 'uri', description: '僅 404 / 405：llms.txt 位置' },
        },
        additionalProperties: true,
      },
      SearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 1, description: '搜尋關鍵字（建議 400 字內，用關鍵詞而非整段 prompt）', examples: ['台灣 AI 基本法草案重點'] },
          lang: { type: 'string', default: 'zh-TW', description: '搜尋語言；繁簡會自動互查。', examples: ['zh-TW', 'zh-CN', 'en'] },
          max_results: {
            type: 'integer', minimum: 0, maximum: 20, default: 5,
            description: '回傳結果數（1–20）；超過 20 會被截為 20；0 或省略視同預設 5。負數、非整數或非數字 → 400 invalid_request。',
          },
          time_range: {
            type: 'string',
            enum: ['day', 'week', 'month', 'year', 'all'],
            description: '時間範圍。省略則依查詢語意推斷；明確傳入則覆蓋推斷。`all` = 不限。列舉以外的值 → 400 invalid_request。',
          },
          category: {
            type: 'string',
            enum: ['general', 'news', 'auto'],
            default: 'auto',
            description: 'SearXNG 分類。`auto` 或省略 = 依查詢推斷（時事走 news）；`general` / `news` 覆蓋推斷。',
          },
          search_depth: { type: 'string', enum: ['basic', 'advanced'], default: 'basic', description: 'basic：snippet（1 額度）。advanced：抓前 3 筆網頁 + LLM 語意摘要為 content（2 額度）' },
          include_answer: { type: 'boolean', default: false, description: '有搜尋結果時生成繁體中文綜合答案，附 [1][2] 來源標註（+1 額度）。無結果不加收、不生成答案。' },
        },
      },
      SearchResult: {
        type: 'object',
        required: ['title', 'url', 'snippet', 'published', 'engine', 'score', 'language'],
        properties: {
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          snippet: { type: 'string', description: '搜尋引擎提供的摘要片段' },
          content: { type: 'string', description: '僅 advanced：LLM 語意摘要後的網頁內容（前 3 筆且抓取成功時才有）' },
          published: { type: ['string', 'null'], description: '發布日期（引擎提供時）' },
          engine: { type: ['string', 'null'], description: '來源引擎，如 google / duckduckgo / brave' },
          score: { type: ['number', 'null'], description: '相關性分數' },
          language: { type: 'string', description: '請求的 lang' },
        },
      },
      SearchResponse: {
        type: 'object',
        required: ['query', 'lang', 'search_depth', 'results', 'credits_used', 'credits_remaining'],
        properties: {
          query: { type: 'string' },
          lang: { type: 'string' },
          search_depth: { type: 'string', enum: ['basic', 'advanced'] },
          results: { type: 'array', items: { $ref: '#/components/schemas/SearchResult' } },
          planned: {
            type: 'object',
            description: '實際採用的查詢規劃（推斷或呼叫端覆蓋後）。',
            required: ['queries', 'category', 'time_range', 'source'],
            properties: {
              queries: { type: 'array', items: { type: 'string' }, description: '原查詢與展開變體（最多 3）' },
              category: { type: 'string', enum: ['general', 'news'] },
              time_range: { type: 'string', enum: ['day', 'week', 'month', 'year', 'all'] },
              source: { type: 'string', enum: ['inferred', 'user', 'mixed'], description: 'inferred = 全由規劃；user = 分類與時間皆由呼叫端指定；mixed = 其一由呼叫端指定' },
            },
          },
          warning: { type: 'string', description: '重試後仍無結果等可恢復情況的說明；此時不會有 answer' },
          unresponsive_engines: {
            type: 'array',
            description: 'SearXNG 回報的失敗引擎，如 [["brave","too many requests"]]',
            items: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
          },
          answer: { type: 'string', description: '僅 include_answer=true 且有結果：繁體中文綜合答案，含 [n] 來源標註' },
          credits_used: { type: 'integer', description: '本月累計已用額度（含本次扣除）' },
          credits_remaining: { type: 'integer', description: '本次扣除後的剩餘額度' },
        },
      },
      ExtractRequest: {
        type: 'object',
        anyOf: [{ required: ['urls'] }, { required: ['url'] }],
        properties: {
          urls: {
            description: '一或多個 URL：字串陣列，或逗號分隔字串。最多 20 個。陣列含非字串元素 → 400 invalid_request。',
            oneOf: [
              { type: 'array', items: { type: 'string', format: 'uri' }, minItems: 1, maxItems: 20 },
              { type: 'string', description: '逗號分隔' },
            ],
          },
          url: { type: 'string', format: 'uri', description: '單一 URL（urls 的替代寫法）' },
          format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown' },
          query: { type: 'string', description: '選填。以 LLM 只保留與此查詢相關的段落（+1 額度）' },
        },
      },
      ExtractResult: {
        type: 'object',
        required: ['url', 'title', 'content', 'format', 'length', 'status'],
        properties: {
          url: { type: 'string', format: 'uri' },
          title: { type: ['string', 'null'], description: '網頁 <title>' },
          content: { type: 'string', description: '乾淨的 markdown / 純文字；失敗時為空字串' },
          format: { type: 'string', enum: ['markdown', 'text'] },
          length: { type: 'integer', description: 'content 字元數' },
          status: { type: 'string', enum: ['success', 'failed'] },
          error: { type: 'string', description: '僅 failed：原因，如 `HTTP 403`、`逾時`、`不支援的內容類型: …`、`無效或不允許的 URL`' },
        },
      },
      ExtractResponse: {
        type: 'object',
        required: ['results', 'success_count', 'failed_count', 'format', 'credits_used', 'credits_remaining'],
        properties: {
          results: { type: 'array', items: { $ref: '#/components/schemas/ExtractResult' } },
          success_count: { type: 'integer' },
          failed_count: { type: 'integer' },
          format: { type: 'string', enum: ['markdown', 'text'] },
          credits_used: { type: 'integer', description: '本月累計已用額度（含本次扣除）' },
          credits_remaining: { type: 'integer' },
        },
      },
      CreditsResponse: {
        type: 'object',
        required: ['monthly_credits', 'credits_used', 'credits_remaining', 'resets_at'],
        properties: {
          monthly_credits: { type: 'integer', description: '每月額度（Free 方案 1000）' },
          credits_used: { type: 'integer' },
          credits_remaining: { type: 'integer' },
          resets_at: { type: ['string', 'null'], format: 'date-time', description: '下次重置時間（ISO 8601，每月 1 日 00:00 UTC）；到期後的第一次請求會把 credits_used 歸零並更新此值' },
        },
      },
      McpRequest: {
        type: 'object',
        description: 'JSON-RPC 2.0 request。省略 id 視為通知（不回應）。',
        required: ['jsonrpc', 'method'],
        properties: {
          jsonrpc: { type: 'string', const: '2.0' },
          id: { type: ['integer', 'string', 'null'] },
          method: { type: 'string', examples: ['initialize', 'tools/list', 'tools/call'] },
          params: {
            type: 'object',
            additionalProperties: true,
            description: 'tools/call：`{ name: "kaiwu_search" | "kaiwu_extract", arguments: {...} }`',
            properties: {
              name: { type: 'string', enum: ['kaiwu_search', 'kaiwu_extract'] },
              arguments: {
                oneOf: [
                  { $ref: '#/components/schemas/SearchRequest' },
                  { $ref: '#/components/schemas/McpExtractToolInput' },
                ],
              },
            },
          },
        },
      },
      McpExtractToolInput: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: { type: 'array', items: { type: 'string', format: 'uri' }, maxItems: 20, description: '要抓取的 URL（也接受逗號分隔字串）' },
          format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown' },
          query: { type: 'string', description: '選填。只保留與此查詢相關的內容（+1 額度）' },
        },
      },
      McpResponse: {
        type: 'object',
        description: 'JSON-RPC 2.0 response（SSE frame 的 data）。',
        required: ['jsonrpc', 'id'],
        properties: {
          jsonrpc: { type: 'string', const: '2.0' },
          id: { type: ['integer', 'string', 'null'] },
          result: {
            type: 'object',
            additionalProperties: true,
            description: 'initialize → {protocolVersion, capabilities, serverInfo}；tools/list → {tools[]}；tools/call → {content:[{type:"text",text}], isError}',
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'integer', description: '-32000 認證失敗、-32700 parse error、-32600 invalid request（非物件／非物件陣列）、-32601 method not found' },
              message: { type: 'string' },
              data: { type: 'object', properties: { code: { type: 'string', description: 'missing_api_key / invalid_api_key / invalid_json / invalid_request / method_not_found' } } },
            },
          },
        },
      },
      Stats: {
        type: 'object',
        required: ['users', 'queries', 'credits', 'tokens_estimated', 'updated_at'],
        properties: {
          users: { type: 'integer', description: '用戶數（含展示基線）' },
          queries: { type: 'integer', description: '查詢數（含展示基線）' },
          credits: { type: 'integer', description: '累計扣除額度（純實際值）' },
          tokens_estimated: { type: 'integer', description: '估算處理 token 數' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Health: {
        type: 'object',
        required: ['ok', 'service', 'version', 'time'],
        properties: {
          ok: { type: 'boolean', const: true },
          service: { type: 'string', const: 'kaiwu' },
          version: { type: 'string' },
          time: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
}

// Serialised once per isolate; the document is static.
const body = JSON.stringify(spec, null, 2)

// /openapi.json is served by this Function at the site root, so public/_headers
// never applies — set the hygiene headers here explicitly.
const responseHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

export const onRequestGet: PagesFunction = async () => new Response(body, { headers: responseHeaders })

export const onRequestHead: PagesFunction = async () => new Response(null, { headers: responseHeaders })

export const onRequestOptions: PagesFunction = async () => new Response(null, { status: 204, headers: corsHeaders })
