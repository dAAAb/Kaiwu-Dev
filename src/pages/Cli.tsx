import { Link } from 'react-router-dom'

export default function Cli() {
  return (
    <>
      <style>{cliStyles}</style>

      {/* Nav */}
      <nav className="cli-nav">
        <div className="cli-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: 20, color: '#f59e0b', textDecoration: 'none' }}>開物 Kaiwu</Link>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <Link to="/dashboard" className="cli-navlink">儀表板</Link>
            <a href="https://github.com/dAAAb/Kaiwu-Dev" className="cli-navlink" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="cli-hero">
        <div className="cli-container">
          <div className="cli-badge">⌨️ CLI & Agent Skills</div>
          <h1>開物 CLI &amp; Skills</h1>
          <p className="cli-tagline">
            把中文世界的 AI 搜尋接進你的終端機與 coding agent。<br />
            一行安裝、Day-1 支援 <em>Claude Code</em> 與 <em>Cursor</em>。
          </p>
          <div className="cli-install">
            <code>curl -fsSL https://kaiwu.dev/install.sh | bash</code>
            <CopyHint text="curl -fsSL https://kaiwu.dev/install.sh | bash" />
          </div>
        </div>
      </header>

      <main className="cli-container cli-main">

        {/* Quick start */}
        <Section id="start" title="快速開始">
          <Steps items={[
            { n: 1, title: '安裝 CLI', body: <Code>{`curl -fsSL https://kaiwu.dev/install.sh | bash
# 或用 npm
npm install -g @kaiwu/cli`}</Code> },
            { n: 2, title: '取得金鑰並登入', body: <><p>到 <Link to="/dashboard" className="cli-a">儀表板</Link> 取得 API 金鑰（<code>kw_...</code>），然後：</p><Code>{`kw login`}</Code></> },
            { n: 3, title: '開始搜尋', body: <Code>{`kw search "台灣 AI 基本法草案重點" --depth advanced --answer`}</Code> },
          ]} />
        </Section>

        {/* Agent Skills */}
        <Section id="skills" title="Agent Skills（Claude Code / Cursor）">
          <p className="cli-lead">
            開物提供一組 Agent Skills，讓你的 coding agent 自動具備中文搜尋與網頁抓取能力 —— 就像 Tavily 的 skills，但專為中文世界打造。
          </p>

          <h3>安裝</h3>
          <Code>{`# 1. 先裝 CLI
curl -fsSL https://kaiwu.dev/install.sh | bash && kw login

# 2. 安裝全部 skills
npx skills add dAAAb/Kaiwu-Dev --all

# 或單獨安裝
npx skills add dAAAb/Kaiwu-Dev --skill kaiwu-search`}</Code>
          <p className="cli-note">安裝後重啟你的 agent。也可用 Claude Code plugin marketplace：<code>/plugin marketplace add dAAAb/Kaiwu-Dev</code></p>

          <h3>可用 Skills</h3>
          <Table
            head={['Skill', '用途']}
            rows={[
              ['kaiwu-search', '中文網路搜尋，回傳 agent 最佳化結果'],
              ['kaiwu-extract', '從 URL 抓取乾淨 markdown / 文字'],
              ['kaiwu-credits', '查詢剩餘額度'],
              ['kaiwu-cli', '安裝、認證、API 對照參考'],
              ['kaiwu-best-practices', '正式整合的最佳實踐'],
            ]}
          />

          <h3>用法</h3>
          <p>Skills 會依情境<strong>自動觸發</strong>；也可以用 slash command 明確呼叫：</p>
          <Code>{`/kaiwu-search 台灣 AI 基本法草案重點
/kaiwu-extract https://example.com/article
/kaiwu-credits
/kaiwu-best-practices`}</Code>
          <p className="cli-note">整合前建議先讀 <code>/kaiwu-best-practices</code> —— 上線最快的捷徑。</p>
        </Section>

        {/* CLI commands */}
        <Section id="commands" title="CLI 指令">
          <h3>kw search</h3>
          <Code>{`kw search "你的查詢" --json
kw search "量子電腦" --depth advanced --max-results 10 --json
kw search "輝達 GTC 發表" --time-range week --json
echo "查詢" | kw search - --json   # 從 stdin`}</Code>
          <Table
            head={['選項', '說明']}
            rows={[
              ['--depth, -d', 'basic（預設）/ advanced（抓網頁 + 語意摘要）'],
              ['--max-results, -n', '結果數量，0–20（預設 5）'],
              ['--time-range, -t', 'day / week / month / year'],
              ['--lang, -l', 'zh-TW（預設）/ zh-CN / en'],
              ['--answer, -a', '生成 AI 綜合答案（+1 額度）'],
              ['--json', '結構化 JSON 輸出'],
              ['-o, --output', '存到檔案'],
            ]}
          />

          <h3>kw extract</h3>
          <Code>{`kw extract "https://example.com/article" --json
kw extract "https://a.com" "https://b.com" --json
kw extract "https://example.com/docs" --query "API 認證" --json`}</Code>
          <Table
            head={['選項', '說明']}
            rows={[
              ['--format, -f', 'markdown（預設）/ text'],
              ['--query, -q', '只保留與查詢相關的內容（+1 額度）'],
              ['--json', '結構化 JSON 輸出'],
              ['-o, --output', '存到檔案'],
            ]}
          />

          <h3>kw credits</h3>
          <Code>{`kw credits          # 人類可讀
kw credits --json   # 給程式解析`}</Code>
        </Section>

        {/* API reference */}
        <Section id="api" title="直接打 API">
          <p className="cli-lead">CLI 是 <code>https://kaiwu.dev</code> REST API 的薄封裝，你也可以直接呼叫。</p>
          <Code>{`# search
curl -s https://kaiwu.dev/v1/search \\
  -H "Authorization: Bearer $KAIWU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"台灣 AI 政策","search_depth":"advanced","include_answer":true}'

# extract
curl -s https://kaiwu.dev/v1/extract \\
  -H "Authorization: Bearer $KAIWU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"urls":["https://example.com/article"],"format":"markdown"}'

# credits
curl -s https://kaiwu.dev/v1/credits \\
  -H "Authorization: Bearer $KAIWU_API_KEY"`}</Code>
          <p className="cli-note">也支援 MCP server（Streamable HTTP）：<code>https://kaiwu.dev/mcp</code></p>
        </Section>

        {/* Credits */}
        <Section id="pricing" title="額度計費">
          <Table
            head={['動作', '額度']}
            rows={[
              ['search（basic）', '1'],
              ['search（advanced）', '2'],
              ['search --answer', '+1'],
              ['extract（每個成功 URL）', '1'],
              ['extract --query', '+1'],
            ]}
          />
          <p className="cli-note">Free 方案每月 1,000 額度。方案詳情見 <Link to="/" className="cli-a">首頁</Link>。</p>
        </Section>

      </main>

      <footer className="cli-footer">
        <div className="cli-container">
          <p style={{ marginBottom: 8 }}><strong>開物 Kaiwu</strong> — 天工開物，AI 開啟萬物知識</p>
          <p>
            <a href="https://github.com/dAAAb/Kaiwu-Dev">GitHub</a> · <Link to="/">首頁</Link> · Built in Taiwan 🇹🇼
          </p>
        </div>
      </footer>
    </>
  )
}

// --- small presentational helpers ------------------------------------------
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="cli-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Code({ children }: { children: string }) {
  return <pre className="cli-code"><code>{children}</code></pre>
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="cli-table-wrap">
      <table className="cli-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{j === 0 ? <code>{cell}</code> : cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ items }: { items: { n: number; title: string; body: React.ReactNode }[] }) {
  return (
    <div className="cli-steps">
      {items.map((s) => (
        <div className="cli-step" key={s.n}>
          <div className="cli-step-num">{s.n}</div>
          <div className="cli-step-body">
            <h3>{s.title}</h3>
            {s.body}
          </div>
        </div>
      ))}
    </div>
  )
}

function CopyHint({ text }: { text: string }) {
  const onClick = () => { navigator.clipboard?.writeText(text) }
  return <button className="cli-copy" onClick={onClick} title="複製">複製</button>
}

const cliStyles = `
  .cli-nav {
    position: sticky; top: 0; z-index: 100;
    background: rgba(10,14,26,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border); padding: 12px 0;
  }
  .cli-navlink { color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; }
  .cli-navlink:hover { color: var(--accent); }
  .cli-container { max-width: 880px; margin: 0 auto; padding: 0 24px; }
  .cli-hero { text-align: center; padding: 80px 24px 48px; position: relative; }
  .cli-hero::before {
    content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .cli-badge {
    display: inline-block; background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.3); color: var(--accent);
    font-size: 13px; font-weight: 600; padding: 6px 16px;
    border-radius: 999px; margin-bottom: 24px;
  }
  .cli-hero h1 {
    font-size: clamp(34px, 6vw, 56px); font-weight: 800; line-height: 1.1; margin-bottom: 16px;
    background: linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .cli-tagline { font-size: 18px; color: var(--muted); max-width: 560px; margin: 0 auto 32px; line-height: 1.6; }
  .cli-tagline em { color: var(--accent); font-style: normal; font-weight: 600; }
  .cli-install {
    display: flex; align-items: center; gap: 8px; justify-content: center;
    max-width: 560px; margin: 0 auto;
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 14px 16px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 14px;
  }
  .cli-install code { color: var(--green); overflow-x: auto; white-space: nowrap; }
  .cli-copy {
    margin-left: auto; flex-shrink: 0; background: var(--accent); color: #0a0e1a;
    border: none; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
  }
  .cli-copy:hover { background: #fbbf24; }
  .cli-main { padding: 24px 24px 40px; }
  .cli-section { padding: 36px 0; border-top: 1px solid var(--border); }
  .cli-section:first-child { border-top: none; }
  .cli-section h2 {
    font-size: 26px; margin-bottom: 20px; scroll-margin-top: 80px;
    display: flex; align-items: center; gap: 10px;
  }
  .cli-section h2::before { content: ''; width: 4px; height: 24px; background: var(--accent); border-radius: 2px; }
  .cli-section h3 { font-size: 17px; margin: 28px 0 12px; color: var(--text); }
  .cli-lead { color: var(--muted); margin-bottom: 16px; line-height: 1.7; }
  .cli-note { color: var(--muted); font-size: 14px; margin-top: 12px; }
  .cli-section p { color: var(--text); margin: 8px 0; }
  .cli-a { color: var(--accent); text-decoration: none; }
  .cli-a:hover { text-decoration: underline; }
  .cli-code {
    background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; overflow-x: auto; margin: 12px 0;
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13.5px; line-height: 1.7;
    color: #cbd5e1; white-space: pre;
  }
  code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.92em; color: var(--accent); }
  .cli-table-wrap { overflow-x: auto; margin: 12px 0; }
  .cli-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .cli-table th, .cli-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
  .cli-table th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .cli-table td code { color: var(--accent); }
  .cli-steps { display: flex; flex-direction: column; gap: 16px; }
  .cli-step { display: flex; gap: 16px; align-items: flex-start; }
  .cli-step-num {
    flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
    background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.4);
    color: var(--accent); font-weight: 800; display: flex; align-items: center; justify-content: center;
  }
  .cli-step-body { flex: 1; min-width: 0; }
  .cli-step-body h3 { margin: 4px 0 8px; font-size: 16px; }
  .cli-footer {
    text-align: center; padding: 48px 24px; color: var(--muted); font-size: 14px;
    border-top: 1px solid var(--border);
  }
  .cli-footer a { color: var(--accent); text-decoration: none; }
  .cli-footer a:hover { text-decoration: underline; }
`
