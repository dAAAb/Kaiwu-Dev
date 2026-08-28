/**
 * Static, prerendered pages: /about, /contact, /privacy, /developers, 404.
 * Each exports its META so the prerender step writes <head>, JSON-LD and the Markdown variant.
 */
import SiteHeader from '../components/SiteHeader'
import SiteFooter, { EmailOff } from '../components/SiteFooter'
import AgentQuickstart from '../components/AgentQuickstart'
import { Icon } from '../components/Icons'

export type PageMeta = { path: string; title: string; description: string; type?: 'website' | 'article' }

function Shell({ children, title, lede, eyebrow }: { children: React.ReactNode; title: string; lede?: string; eyebrow?: string }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="container-x py-12 sm:py-20">
        <header className="max-w-2xl mb-10 sm:mb-14">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="text-h1 font-semibold">{title}</h1>
          {lede && <p className="mt-4 text-lg text-fg-muted leading-relaxed">{lede}</p>}
        </header>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

/* ───────────────────────────── About ───────────────────────────── */

export const ABOUT_META: PageMeta = {
  path: '/about',
  title: '關於開物 Kaiwu — 為 AI agent 打造的中文搜尋',
  description: '開物 Kaiwu 是台灣團隊打造的中文 AI 搜尋 API：無審查來源、繁簡互查、LLM-ready 結果。了解我們為什麼做這件事、怎麼做，以及資料如何處理。',
}

export function About() {
  return (
    <Shell eyebrow="ABOUT · 關於" title="讓 AI 看見完整的中文世界。" lede="開物（Kaiwu）是一個專為 AI agent 設計的中文搜尋 API。名字取自明代《天工開物》——記錄工藝如何把原料變成有用之物；我們做的事一樣：把散落、被過濾、繁簡分裂的中文網路，整理成 agent 能直接使用的知識。">
      <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
        <article className="prose-kaiwu">
          <h2>開物是什麼</h2>
          <p>開物提供一個 HTTP API：送進一個中文查詢，回傳排序過的搜尋結果、可選的網頁正文，以及一段附來源標注的綜合答案。它聚合 Google、DuckDuckGo、Brave 等國際搜尋引擎，把查詢同時展開成繁體與簡體用語，再由 LLM 依語意整理，讓結果可以直接餵給模型，不需要 agent 自己抓網頁、清雜訊。</p>
          <p>除了 REST API，開物也以遠端 MCP Server、命令列工具 <code>kw</code>、以及 Claude Code / Cursor 的 Agent Skills 提供，所有入口共用同一把 API 金鑰與同一套額度。</p>

          <h2>為什麼做這件事</h2>
          <p>我們在打造中文 AI agent 時反覆遇到同一個問題：現有的搜尋 API 以英文網路為中心，中文結果稀疏，而且常只覆蓋簡體來源。簡體搜尋引擎又在索引與排序兩層做政治審查，agent 拿到的是被修剪過的世界。繁體與簡體用語不同（軟體／软件、晶片／芯片），一個查詢只會命中一半的網路。開物就是為了補上這個缺口。</p>

          <h2>我們相信的事</h2>
          <ul>
            <li><strong>完整優先於方便。</strong>不用會過濾內容的來源，寧可多一層去重與排序的工。</li>
            <li><strong>Agent 是第一公民。</strong>回傳格式為模型設計；文件同時提供 OpenAPI、llms.txt 與 Markdown 內容協商，讓機器自己讀得懂。</li>
            <li><strong>資料路徑透明。</strong>服務部署在台灣，請求不進中國、不經美國；查詢內容只用於計費與除錯。</li>
            <li><strong>誠實的數字。</strong>首頁的統計來自真實資料庫並加上公開的基線偏移，<a className="link" href="/developers#stats">計算方式寫在文件裡</a>，而不是宣稱從未達到的規模。</li>
          </ul>

          <h2>怎麼運作</h2>
          <p>前端與 API 跑在 Cloudflare Pages 與 Pages Functions；帳號、金鑰與用量紀錄存在 Cloudflare D1；搜尋層是自架的 SearXNG 節點（台灣），語意整理由 Gemini 2.5 Flash 完成，Ollama 作為備援。認證使用 Privy（Email、Google、GitHub、錢包）換發 JWT，API 以 <code>kw_</code> 開頭的金鑰授權。</p>

          <h2>團隊</h2>
          <p>開物由台灣的獨立開發團隊維護，同時也是 <a href="https://canfly.ai" target="_blank" rel="noopener noreferrer">CanFly.ai</a> 生態的一部分。原始碼在 GitHub 公開，歡迎回報問題與提交修正。</p>
        </article>

        <aside className="space-y-4">
          <div className="card">
            <p className="eyebrow mb-2">一覽</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-4"><dt className="text-fg-muted">成立</dt><dd className="text-fg">2026 · 台北</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fg-muted">部署</dt><dd className="text-fg">台灣節點</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fg-muted">來源</dt><dd className="text-fg text-right">Google · DuckDuckGo · Brave</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fg-muted">聯絡</dt><dd className="text-fg"><EmailOff address="hello@kaiwu.dev" className="font-mono text-xs" /></dd></div>
            </dl>
          </div>
          <div className="card">
            <p className="eyebrow mb-2">連結</p>
            <ul className="text-sm space-y-2">
              <li><a className="link" href="/developers">開發者文件</a></li>
              <li><a className="link" href="https://github.com/dAAAb/Kaiwu-Dev" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a className="link" href="/cli">CLI & Skills</a></li>
              <li><a className="link" href="/contact">聯絡我們</a></li>
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

/* ───────────────────────────── Contact ───────────────────────────── */

export const CONTACT_META: PageMeta = {
  path: '/contact',
  title: '聯絡開物 Kaiwu — 支援、資安通報、合作',
  description: '聯絡開物團隊：技術支援、額度與付費方案、資安漏洞通報、企業與合作洽詢。Email、GitHub Issues 與回覆時間說明。',
}

export function Contact() {
  return (
    <Shell eyebrow="CONTACT · 聯絡" title="找得到人，也找得到 agent。" lede="每封信都會回。資安通報與服務中斷會最先處理；產品問題通常一個工作天內回覆。">
      <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
        {[
          { icon: <Icon.Mail />, t: 'Email', d: '技術支援、額度問題、付費方案通知、媒體詢問。請附上你的帳號 Email 與（若相關）API 回應內容。', action: <EmailOff address="hello@kaiwu.dev" className="link font-mono text-sm" /> },
          { icon: <Icon.Shield />, t: '資安通報', d: '發現漏洞請直接寄信，主旨加上「[security]」。我們會在 48 小時內回覆，並在修復後公開致謝（如你願意）。請勿在公開 issue 揭露。', action: <a className="link text-sm font-mono" href="mailto:hello@kaiwu.dev?subject=%5Bsecurity%5D">hello@kaiwu.dev</a> },
          { icon: <Icon.Github />, t: 'GitHub Issues', d: 'API 行為、CLI、Skills 與文件的問題或建議。原始碼公開，歡迎直接提交修正。', action: <a className="link text-sm" href="https://github.com/dAAAb/Kaiwu-Dev/issues" target="_blank" rel="noopener noreferrer">github.com/dAAAb/Kaiwu-Dev/issues</a> },
          { icon: <Icon.Users />, t: '企業與合作', d: '更高的速率限制、專屬節點、資料留存要求、與你的產品整合。來信說明用量與需求，我們會安排通話。', action: <a className="link text-sm font-mono" href="mailto:hello@kaiwu.dev?subject=%E5%90%88%E4%BD%9C%E6%B4%BD%E8%A9%A2">hello@kaiwu.dev</a> },
        ].map((c) => (
          <div key={c.t} className="card">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">{c.icon}</div>
            <h2 className="text-base font-semibold text-fg">{c.t}</h2>
            <p className="mt-2 text-sm text-fg-muted leading-relaxed">{c.d}</p>
            <p className="mt-4">{c.action}</p>
          </div>
        ))}
      </div>
      <section className="mt-12 max-w-4xl prose-kaiwu">
        <h2>你是 agent 嗎？</h2>
        <p>不需要寫信。讀 <a href="/llms.txt">/llms.txt</a> 取得使用方式，<a href="/openapi.json">/openapi.json</a> 有完整的型別規格；服務狀態可以打 <code>GET https://kaiwu.dev/api/health</code>。找不到的網址會回真正的 404，並附上這些入口。</p>
        <h2>回覆時間</h2>
        <ul>
          <li>服務中斷、資安：優先處理，48 小時內回覆。</li>
          <li>API 與帳號問題：1 個工作天。</li>
          <li>合作與企業洽詢：3 個工作天內安排通話。</li>
        </ul>
        <p>營運主體位於台灣台北，時區 UTC+8。</p>
      </section>
    </Shell>
  )
}

/* ───────────────────────────── Privacy ───────────────────────────── */

export const PRIVACY_META: PageMeta = {
  path: '/privacy',
  title: '隱私權政策 — 開物 Kaiwu 如何處理你的資料',
  description: '開物儲存哪些資料（帳號、API 金鑰、查詢紀錄）、資料在哪裡處理（Cloudflare／台灣）、保存多久、不會拿去做什麼、如何刪除，以及適用的台灣個資法規範。',
}

export function Privacy() {
  return (
    <Shell eyebrow="PRIVACY · 隱私" title="隱私權政策" lede="最後更新：2026 年 8 月 28 日。本政策說明開物 Kaiwu（kaiwu.dev）蒐集什麼、為什麼、放在哪裡、保存多久，以及你如何控制。">
      <article className="prose-kaiwu max-w-3xl">
        <h2>我們蒐集什麼</h2>
        <ul>
          <li><strong>帳號資料：</strong>透過 Privy 登入時取得的 Email 或錢包地址、Privy 使用者 ID、建立時間。我們不儲存密碼；社群登入（Google、GitHub）只取得 Email。</li>
          <li><strong>API 金鑰：</strong>金鑰儲存在我們的資料庫，只有你登入後的儀表板可以查看，可隨時撤銷。呼叫 API 時會比對完整金鑰。我們計畫改為雜湊儲存（屆時金鑰只會在建立時顯示一次），變更會在此頁公告。</li>
          <li><strong>用量紀錄：</strong>每次呼叫的端點、消耗額度、時間，以及查詢字串（用於除錯與濫用偵測）。抓取的網頁內容與生成的答案不會長期保存。</li>
          <li><strong>技術資料：</strong>IP 位址與 User-Agent 會出現在 Cloudflare 的短期日誌中，用於速率限制與安全。</li>
        </ul>
        <h2>資料在哪裡處理</h2>
        <p>網站與 API 執行於 Cloudflare 的邊緣網路；資料庫（Cloudflare D1）與搜尋節點（SearXNG）部署在台灣區域。搜尋請求會轉送到 Google、DuckDuckGo、Brave 等第三方引擎，advanced 模式會由我們的伺服器抓取結果網頁。語意整理使用 Google Gemini API（美國）或自架的 Ollama；送往模型的內容只包含查詢與抓取到的公開網頁片段，不含你的帳號資訊。我們不使用中國境內的服務或資料路徑。</p>
        <h2>我們不會做的事</h2>
        <ul>
          <li>不出售、不分享個人資料給第三方作行銷用途。</li>
          <li>不用你的查詢或抓取內容訓練模型。</li>
          <li>不在網站放追蹤型廣告；分析工具（若啟用）只用於了解流量與轉換，不做跨站追蹤。</li>
        </ul>
        <h2>保存多久</h2>
        <p>帳號與金鑰在你刪除前保留；用量紀錄保留 12 個月供計費爭議與濫用調查；Cloudflare 存取日誌依其預設保留期（通常少於 30 天）。</p>
        <h2>你的權利</h2>
        <p>你可以隨時在儀表板撤銷金鑰。要匯出或刪除帳號與全部資料，寫信到 <EmailOff address="hello@kaiwu.dev" className="link" />（主旨「刪除帳號」），我們會在 7 個工作天內完成並回覆。台灣《個人資料保護法》與 GDPR 賦予的查詢、更正、刪除、限制處理等權利均適用。</p>
        <h2>Cookie 與本機儲存</h2>
        <p>登入狀態由 Privy 以第一方 cookie 與本機儲存維持；網站本身只使用必要的 sessionStorage（例如記住你關閉過的提示）。沒有第三方廣告 cookie。</p>
        <h2>變更</h2>
        <p>政策有重大變更時會在本頁更新日期，並以 Email 通知已登入的使用者。</p>
        <p>營運者：開物 Kaiwu（台灣台北）。聯絡：<EmailOff address="hello@kaiwu.dev" className="link" />。</p>
      </article>
    </Shell>
  )
}

/* ───────────────────────────── Developers ───────────────────────────── */

export const DEVELOPERS_META: PageMeta = {
  path: '/developers',
  title: '開物 Kaiwu 開發者文件 — API、MCP、CLI、Skills',
  description: '開物中文搜尋 API 的快速開始、認證、/v1/search 與 /v1/extract 參數、額度與速率限制、錯誤格式、MCP Server 設定、CLI 與 Claude Code / Cursor Skills、OpenAPI 規格。',
}

const QUICK = `# 1. 到 https://kaiwu.dev/dashboard 登入，複製 API 金鑰（kw_…）
export KAIWU_API_KEY=kw_...

# 2. 搜尋（basic 1 額度；advanced 2；include_answer 再 +1）
curl -s https://kaiwu.dev/v1/search \\
  -H "Authorization: Bearer $KAIWU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"台灣 AI 基本法 草案 重點","search_depth":"advanced","include_answer":true,"max_results":5}'

# 3. 抓網頁正文（每個成功網址 1 額度；加 query 語意過濾 +1）
curl -s https://kaiwu.dev/v1/extract \\
  -H "Authorization: Bearer $KAIWU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"urls":["https://example.com/article"],"format":"markdown"}'

# 4. 查剩餘額度
curl -s https://kaiwu.dev/v1/credits -H "Authorization: Bearer $KAIWU_API_KEY"`

const RESPONSE = `{
  "query": "台灣 AI 基本法 草案 重點",
  "results": [
    { "title": "…", "url": "https://…", "snippet": "…", "content": "（advanced 才有：語意切段後的正文）",
      "published": "2026-05-12", "engine": "google", "score": 0.91, "language": "zh-TW" }
  ],
  "answer": "（include_answer 才有）…附來源標注 [1][2]",
  "credits_used": 42,
  "credits_remaining": 958
}`

const ERROR = `HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="kaiwu", error="invalid_token"
Content-Type: application/json

{ "error": "無效的 API 金鑰", "code": "invalid_api_key" }`

const MCP_CLAUDE = `claude mcp add --transport http kaiwu https://kaiwu.dev/mcp \\
  --header "Authorization: Bearer $KAIWU_API_KEY"`

const MCP_JSON = `{
  "mcpServers": {
    "kaiwu": {
      "url": "https://kaiwu.dev/mcp",
      "headers": { "Authorization": "Bearer kw_..." }
    }
  }
}`

export function Developers() {
  const resources = [
    { href: '/openapi.json', t: 'OpenAPI 3.1 規格', d: '每個操作都有 operationId、型別化的請求與回應、共用的 Error schema。可直接餵給 client 產生器或 function calling。', icon: <Icon.Terminal /> },
    { href: '/llms.txt', t: 'llms.txt', d: '給語言模型看的精簡摘要：開物是什麼、什麼時候該用、怎麼呼叫。完整版在 /llms-full.txt。', icon: <Icon.Book /> },
    { href: '/cli', t: 'CLI & Agent Skills', d: 'kw search / extract / credits；Claude Code 與 Cursor 的 kaiwu-* skills。', icon: <Icon.Plug /> },
    { href: 'https://www.npmjs.com/package/@kaiwu/cli', t: '@kaiwu/cli on npm', d: 'npm i -g @kaiwu/cli，零依賴、Node 18+。', icon: <Icon.Key />, external: true },
    { href: 'https://github.com/dAAAb/Kaiwu-Dev', t: 'GitHub', d: '原始碼、issues、skills 與 plugin marketplace 清單。', icon: <Icon.Github />, external: true },
    { href: '/dashboard/playground', t: '測試場（需登入）', d: '在瀏覽器直接送 search / extract 請求、看原始回應。', icon: <Icon.Play /> },
  ]
  return (
    <Shell eyebrow="DEVELOPERS · 開發者" title="一個 API call，搜遍中文世界。" lede="Base URL https://kaiwu.dev。JSON 進、JSON 出。認證用 API 金鑰（Bearer），沒有 OAuth 要接。目前限時免費：每月 1,000 額度。">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
        <div className="space-y-12 min-w-0">
          <section id="agent-prompt">
            <h2 className="text-h3 font-semibold mb-2">讓你的 agent 自己接上</h2>
            <p className="text-sm text-fg-muted mb-4">把這段貼給 agent。它會讀 <code className="font-mono text-fg">llms.txt</code>、用你給的金鑰呼叫 API，之後遇到中文查詢就會用開物。</p>
            <AgentQuickstart compact />
          </section>

          <section id="quickstart">
            <h2 className="text-h3 font-semibold mb-4">快速開始</h2>
            <div className="code-panel"><pre tabIndex={0}><code className="font-mono whitespace-pre">{QUICK}</code></pre></div>
            <p className="mt-3 text-sm text-fg-muted">金鑰以 <code className="font-mono text-fg">kw_</code> 開頭，共 35 字元。請存到環境變數或密鑰管理器，不要寫進程式碼或網址；外洩時到儀表板撤銷並重建。</p>
          </section>

          <section id="authentication" className="prose-kaiwu">
            <h2>認證</h2>
            <p>所有 <code>/v1/*</code> 端點使用 <code>Authorization: Bearer kw_…</code>。金鑰在 <a href="/dashboard">儀表板</a> 建立與撤銷，可以為不同專案建多把。金鑰不會過期，撤銷即失效。</p>
            <p>公開端點（<code>GET /api/stats</code>、<code>GET /api/health</code>、<code>/openapi.json</code>、<code>/llms.txt</code>）不需要金鑰。</p>
          </section>

          <section id="search" className="prose-kaiwu">
            <h2>POST /v1/search</h2>
            <table>
              <thead><tr><th>參數</th><th>型別</th><th>說明</th></tr></thead>
              <tbody>
                <tr><td><code>query</code></td><td>string</td><td>必填。建議 400 字以內；會自動展開繁簡用語。</td></tr>
                <tr><td><code>search_depth</code></td><td><code>basic</code> | <code>advanced</code></td><td>basic 回傳標題與摘要（1 額度）；advanced 抓取前幾頁、語意切段（2 額度）。</td></tr>
                <tr><td><code>include_answer</code></td><td>boolean</td><td>生成附來源標注的綜合答案（+1 額度）。</td></tr>
                <tr><td><code>max_results</code></td><td>integer</td><td>1–20，預設 5（省略或 0 視同預設）。</td></tr>
                <tr><td><code>time_range</code></td><td><code>day</code> | <code>week</code> | <code>month</code> | <code>year</code></td><td>時間範圍。</td></tr>
                <tr><td><code>lang</code></td><td>string</td><td><code>zh-TW</code>（預設）、<code>zh-CN</code>、<code>en</code>。</td></tr>
              </tbody>
            </table>
            <p>回應：</p>
            <pre><code>{RESPONSE}</code></pre>
            <p><code>credits_used</code> 是本月累計已用額度（含本次扣的 3 額度），不是單次費用；<code>credits_remaining</code> 是本月剩餘額度，也可用 <code>GET /v1/credits</code> 查。</p>
          </section>

          <section id="extract" className="prose-kaiwu">
            <h2>POST /v1/extract</h2>
            <table>
              <thead><tr><th>參數</th><th>型別</th><th>說明</th></tr></thead>
              <tbody>
                <tr><td><code>urls</code></td><td>string | string[]</td><td>一或多個網址，最多 20 個。失敗的網址不計費。</td></tr>
                <tr><td><code>format</code></td><td><code>markdown</code> | <code>text</code></td><td>輸出格式，預設 markdown。</td></tr>
                <tr><td><code>query</code></td><td>string</td><td>只保留與查詢相關的段落（LLM 過濾，+1 額度）。</td></tr>
              </tbody>
            </table>
            <p>每個結果包含 <code>url</code>、<code>title</code>、<code>content</code>、<code>length</code>、<code>status</code>（success / failed）。自動偵測 <code>&lt;article&gt;</code> / <code>&lt;main&gt;</code> 正文，移除導覽、廣告與樣板；內建 SSRF 防護（不抓內網位址）。</p>
          </section>

          <section id="credits" className="prose-kaiwu">
            <h2>額度與速率限制</h2>
            <ul>
              <li>免費方案每月 1,000 額度，每月 1 日重置；<code>GET /v1/credits</code> 查餘額。</li>
              <li>計費：search basic 1、advanced 2、<code>include_answer</code> +1；extract 每個成功網址 1、<code>query</code> +1。</li>
              <li>速率：目前沒有硬性的每秒請求上限，請以約 1 req/s 的節奏呼叫；額度用完會回 <code>429</code>（<code>insufficient_credits</code>）。之後若加入速率限制，會附 <code>Retry-After</code> 並在變更紀錄公告。</li>
              <li>付費方案（更高額度與併發）籌備中；推出前一律限時免費，正式收費會提前通知。</li>
            </ul>
            <h3 id="stats">公開統計的計算方式</h3>
            <p>首頁與 <code>GET /api/stats</code> 的數字 = 資料庫即時統計 + 固定的公開基線（開發者 +120、查詢 +5,000、token +7,500,000）。基線是常數、不會隨時間變動，也公開在此；token 數為依查詢量的估計值。</p>
          </section>

          <section id="errors" className="prose-kaiwu">
            <h2>錯誤格式</h2>
            <p>所有錯誤都是 JSON，含人類可讀的 <code>error</code> 與機器可讀的 <code>code</code>（<code>missing_api_key</code>、<code>invalid_api_key</code>、<code>invalid_json</code>、<code>missing_query</code>、<code>insufficient_credits</code>、<code>upstream_unavailable</code>、<code>not_found</code>…）。未知路徑回真正的 <code>404</code> JSON，401 附 <code>WWW-Authenticate</code>。</p>
            <pre><code>{ERROR}</code></pre>
          </section>

          <section id="mcp" className="prose-kaiwu">
            <h2>MCP Server</h2>
            <p>遠端端點 <code>https://kaiwu.dev/mcp</code>（Streamable HTTP），提供 <code>kaiwu_search</code> 與 <code>kaiwu_extract</code> 兩個工具，額度計算與 REST 相同。Claude Code 一行加入：</p>
            <pre><code>{MCP_CLAUDE}</code></pre>
            <p>Claude Desktop / Cursor / OpenClaw 的設定檔：</p>
            <pre><code>{MCP_JSON}</code></pre>
            <p>也可以用 <code>?apiKey=kw_…</code> 放在網址上，但金鑰會出現在日誌與 referrer 中，建議只在無法設定 header 的客戶端使用。</p>
          </section>

          <section id="versioning" className="prose-kaiwu">
            <h2>版本與相容性</h2>
            <p>路徑以 <code>/v1</code> 為版本；新增欄位不視為破壞性變更。破壞性變更會以 <code>/v2</code> 推出，舊版至少保留 90 天並在 <a href="#changelog">變更紀錄</a> 公告。</p>
            <h3 id="changelog">變更紀錄</h3>
            <ul>
              <li><strong>2026-08.</strong> 開發者文件、OpenAPI 規格、llms.txt、Markdown 內容協商、機器可讀的錯誤 <code>code</code>、MCP header 認證。所有方案限時免費。</li>
              <li><strong>2026-05.</strong> <code>/v1/extract</code>、CLI <code>kw</code>、Claude Code / Cursor Skills、MCP <code>kaiwu_extract</code>、公開統計 <code>/api/stats</code>。</li>
              <li><strong>2026-04.</strong> LLM 層升級：語意切段與綜合答案；Ollama 備援。</li>
              <li><strong>2026-02.</strong> 首版上線：<code>/v1/search</code>、儀表板、API 金鑰、遠端 MCP。</li>
            </ul>
          </section>

          <section id="sandbox" className="prose-kaiwu">
            <h2>測試環境</h2>
            <p>沒有獨立的 staging；帳號免費，直接註冊一把測試金鑰即可。儀表板的<a href="/dashboard/playground">測試場</a>可以在瀏覽器裡送請求、看完整回應，不消耗你程式端的額度以外的東西（同一個帳號共用額度）。</p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
          <nav aria-label="本頁目錄" className="card py-4">
            <p className="eyebrow mb-2">本頁</p>
            <ul className="text-sm space-y-1.5">
              {[['#agent-prompt', '給 agent 的 prompt'], ['#quickstart', '快速開始'], ['#authentication', '認證'], ['#search', '/v1/search'], ['#extract', '/v1/extract'], ['#credits', '額度與速率'], ['#errors', '錯誤格式'], ['#mcp', 'MCP Server'], ['#versioning', '版本與變更'], ['#sandbox', '測試環境']].map(([href, label]) => (
                <li key={href}><a href={href} className="text-fg-muted hover:text-fg transition-colors">{label}</a></li>
              ))}
            </ul>
          </nav>
          <div className="card p-0 sm:p-0 overflow-hidden">
            <p className="eyebrow px-5 pt-4 pb-2">資源</p>
            <ul className="divide-y divide-line">
              {resources.map((c) => (
                <li key={c.href}>
                  <a href={c.href} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2 transition-colors" {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                    <span className="mt-0.5 w-7 h-7 shrink-0 rounded-md bg-accent-soft text-accent flex items-center justify-center">{c.icon}</span>
                    <span className="min-w-0">
                      <span className="font-medium text-fg text-sm flex items-center gap-1.5">{c.t}{c.external && <Icon.ExternalLink size={12} className="text-fg-subtle" />}</span>
                      <span className="block text-xs text-fg-muted leading-relaxed">{c.d}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

/* ───────────────────────────── 404 ───────────────────────────── */

export const NOTFOUND_META: PageMeta = { path: '/404', title: '找不到頁面 — 開物 Kaiwu', description: '這個網址不存在。從首頁、開發者文件、llms.txt 或 sitemap 重新開始。' }

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="container-x py-20 sm:py-32">
        <p className="eyebrow mb-3">404 · NOT FOUND</p>
        <h1 className="text-h1 font-semibold">找不到這個頁面。</h1>
        <p className="mt-4 text-lg text-fg-muted max-w-xl">網址可能打錯了，或這頁已經搬家。下面是所有的入口——給人看的和給 agent 看的都在。</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 max-w-2xl text-sm">
          {[['/', '首頁'], ['/developers', '開發者文件'], ['/cli', 'CLI & Skills'], ['/dashboard', '儀表板'], ['/llms.txt', 'llms.txt（給 agent）'], ['/openapi.json', 'OpenAPI 規格'], ['/sitemap.xml', 'Sitemap'], ['/contact', '聯絡我們']].map(([href, label]) => (
            <li key={href}><a href={href} className="card card-hover flex items-center justify-between py-3 px-4"><span>{label}</span><Icon.ArrowRight size={16} className="text-fg-subtle" /></a></li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  )
}
