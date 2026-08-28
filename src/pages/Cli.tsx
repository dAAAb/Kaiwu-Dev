import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { Icon } from '../components/Icons'

export const CLI_META = {
  path: '/cli',
  title: '開物 CLI & Agent Skills — kw 指令與 Claude Code / Cursor 整合',
  description: '安裝 @kaiwu/cli、kw login / search / extract / credits 指令說明，以及 kaiwu-search、kaiwu-extract 等 Claude Code / Cursor Agent Skills 的安裝與用法。',
}

function Code({ children }: { children: string }) {
  return <div className="code-panel my-3"><pre tabIndex={0}><code className="font-mono whitespace-pre">{children}</code></pre></div>
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap my-3">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr>{head.map((h) => <th key={h} className="text-left py-2 pr-4 text-fg-subtle font-medium border-b border-line">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, j) => <td key={j} className="py-2 pr-4 border-b border-line align-top text-fg-muted">{j === 0 ? <code className="font-mono text-fg">{c}</code> : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function Cli() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />
      <main id="main" className="container-x py-12 sm:py-20">
        <header className="max-w-2xl mb-10 sm:mb-14">
          <p className="eyebrow mb-3">CLI & AGENT SKILLS · 命令列與技能</p>
          <h1 className="text-h1 font-semibold">把中文搜尋接進終端機與 coding agent。</h1>
          <p className="mt-4 text-lg text-fg-muted leading-relaxed">一行安裝，Day-1 支援 Claude Code 與 Cursor。CLI 與 Skills 共用你在儀表板建立的同一把金鑰。</p>
          <div className="mt-6 code-panel max-w-xl"><pre tabIndex={0} className="!py-3"><code className="font-mono">npm install -g @kaiwu/cli && kw login</code></pre></div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
          <div className="space-y-12 min-w-0 prose-kaiwu">
            <section id="start">
              <h2>快速開始</h2>
              <ol>
                <li><strong>安裝 CLI</strong><Code>{`npm install -g @kaiwu/cli\n# 或免安裝\nnpx @kaiwu/cli search "台灣 AI 基本法"\n# 或一鍵安裝器（需要 Node 18+）\ncurl -fsSL https://kaiwu.dev/install.sh | bash`}</Code></li>
                <li><strong>登入</strong>：到 <a href="/dashboard">儀表板</a> 建立金鑰（<code>kw_…</code>），然後 <code>kw login</code>；非互動環境用 <code>KAIWU_API_KEY</code> 環境變數。</li>
                <li><strong>搜尋</strong><Code>{`kw search "台灣 AI 基本法草案重點" --depth advanced --answer`}</Code></li>
              </ol>
            </section>

            <section id="skills">
              <h2>Agent Skills（Claude Code / Cursor）</h2>
              <p>開物提供一組 Agent Skills，讓 coding agent 在需要中文資料時自動用開物搜尋與抓取——就像 Tavily 的 skills，但為中文世界打造。</p>
              <Code>{`# 先裝 CLI 並登入\nnpm install -g @kaiwu/cli && kw login\n\n# 安裝全部 skills\nnpx skills add dAAAb/Kaiwu-Dev --all\n# 或單獨安裝\nnpx skills add dAAAb/Kaiwu-Dev --skill kaiwu-search\n\n# Claude Code plugin marketplace（兩步：登錄 marketplace → 安裝）\n/plugin marketplace add dAAAb/Kaiwu-Dev\n/plugin install kaiwu@kaiwu`}</Code>
              <Table head={['Skill', '用途']} rows={[
                ['kaiwu-search', '中文網路搜尋，回傳 agent 最佳化結果'],
                ['kaiwu-extract', '從 URL 抓取乾淨 markdown / 文字'],
                ['kaiwu-credits', '查詢剩餘額度'],
                ['kaiwu-cli', '安裝、認證、API 對照參考'],
                ['kaiwu-best-practices', '正式整合的最佳實踐'],
              ]} />
              <p>Skills 會依情境自動觸發，也可以用 slash command 明確呼叫：</p>
              <Code>{`/kaiwu-search 台灣 AI 基本法草案重點\n/kaiwu-extract https://example.com/article\n/kaiwu-credits\n/kaiwu-best-practices`}</Code>
            </section>

            <section id="commands">
              <h2>CLI 指令</h2>
              <h3>kw search</h3>
              <Code>{`kw search "你的查詢" --json\nkw search "量子電腦" --depth advanced --max-results 10 --json\nkw search "輝達 GTC 發表" --time-range week --json\necho "查詢" | kw search - --json   # 從 stdin`}</Code>
              <Table head={['選項', '說明']} rows={[
                ['--depth, -d', 'basic（預設）/ advanced（抓網頁 + 語意摘要）'],
                ['--max-results, -n', '結果數量，1–20（預設 5）'],
                ['--time-range, -t', 'day / week / month / year'],
                ['--lang, -l', 'zh-TW（預設）/ zh-CN / en'],
                ['--answer, -a', '生成 AI 綜合答案（+1 額度）'],
                ['--json', '結構化 JSON 輸出'],
                ['-o, --output', '存到檔案'],
              ]} />
              <h3>kw extract</h3>
              <Code>{`kw extract "https://example.com/article" --json\nkw extract "https://a.com" "https://b.com" --json\nkw extract "https://example.com/docs" --query "API 認證" --json`}</Code>
              <Table head={['選項', '說明']} rows={[
                ['--format, -f', 'markdown（預設）/ text'],
                ['--query, -q', '只保留與查詢相關的內容（+1 額度）'],
                ['--json', '結構化 JSON 輸出'],
                ['-o, --output', '存到檔案'],
              ]} />
              <h3>kw credits</h3>
              <Code>{`kw credits          # 人類可讀\nkw credits --json   # 給程式解析`}</Code>
              <h3>設定與環境變數</h3>
              <Table head={['項目', '說明']} rows={[
                ['~/.kaiwu/config.json', 'kw login 寫入的金鑰（權限 600）'],
                ['KAIWU_API_KEY', '覆蓋設定檔的金鑰；CI / agent 建議使用'],
                ['KAIWU_API_URL', '自訂 API 位址（預設 https://kaiwu.dev）'],
              ]} />
            </section>

            <section id="api">
              <h2>直接打 API</h2>
              <p>CLI 是 REST API 的薄封裝。完整參數、回應與錯誤格式見 <a href="/developers">開發者文件</a>，機器可讀版本在 <a href="/openapi.json">/openapi.json</a>。</p>
              <Code>{`curl -s https://kaiwu.dev/v1/search \\\n  -H "Authorization: Bearer $KAIWU_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"query":"台灣 AI 政策","search_depth":"advanced","include_answer":true}'`}</Code>
            </section>

            <section id="pricing">
              <h2>額度計費</h2>
              <Table head={['動作', '額度']} rows={[
                ['search（basic）', '1'],
                ['search（advanced）', '2'],
                ['search --answer', '+1'],
                ['extract（每個成功 URL）', '1'],
                ['extract --query', '+1'],
              ]} />
              <p>目前限時免費：每月 1,000 額度。付費方案籌備中，詳見<a href="/#pricing">定價</a>。</p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
            <nav aria-label="本頁目錄" className="card py-4">
              <p className="eyebrow mb-2">本頁</p>
              <ul className="text-sm space-y-1.5">
                {[['#start', '快速開始'], ['#skills', 'Agent Skills'], ['#commands', 'CLI 指令'], ['#api', '直接打 API'], ['#pricing', '額度計費']].map(([h, l]) => <li key={h}><a href={h} className="text-fg-muted hover:text-fg transition-colors">{l}</a></li>)}
              </ul>
            </nav>
            <div className="card">
              <p className="eyebrow mb-2">相關</p>
              <ul className="text-sm space-y-2">
                <li><a className="link inline-flex items-center gap-1" href="/developers">開發者文件 <Icon.ArrowRight size={14} /></a></li>
                <li><a className="link inline-flex items-center gap-1" href="https://www.npmjs.com/package/@kaiwu/cli" target="_blank" rel="noopener noreferrer">@kaiwu/cli on npm <Icon.ExternalLink size={14} /></a></li>
                <li><a className="link inline-flex items-center gap-1" href="https://github.com/dAAAb/Kaiwu-Dev/tree/main/skills" target="_blank" rel="noopener noreferrer">skills/ 原始碼 <Icon.ExternalLink size={14} /></a></li>
                <li><a className="link inline-flex items-center gap-1" href="/dashboard">儀表板 <Icon.ArrowRight size={14} /></a></li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
