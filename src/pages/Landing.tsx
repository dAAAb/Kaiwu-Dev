import { useNavigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'

export default function Landing() {
  const navigate = useNavigate()
  const { login, authenticated } = usePrivy()

  const handleGetStarted = () => {
    if (authenticated) {
      navigate('/dashboard')
    } else {
      login()
    }
  }

  return (
    <>
      <style>{landingStyles}</style>

      {/* Nav */}
      <nav className="landing-nav">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#f59e0b' }}>開物 Kaiwu</span>
          <button onClick={handleGetStarted} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 14 }}>
            {authenticated ? '進入儀表板' : '開始使用 →'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="badge">🔥 Now Live — 正式上線</div>
          <h1>開物</h1>
          <div className="subtitle">AI Search for the Chinese World</div>
          <p className="tagline">
            專為中文 AI Agent 打造的搜尋 API —<br/>
            <em>無審查</em>、<em>繁簡雙語</em>、<em>LLM-ready</em>。
          </p>
          <div className="cta-group">
            <button onClick={handleGetStarted} className="btn btn-primary">
              {authenticated ? '進入儀表板 →' : '免費開始 →'}
            </button>
            <a href="https://github.com/dAAAb/Kaiwu-Dev" className="btn btn-secondary" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
      </section>

      {/* Code Preview */}
      <section className="code-section">
        <div className="container">
          <div className="code-block">
            <span className="comment">{'// 一個 API call，搜尋全中文世界'}</span><br/>
            <span className="key">const</span> response = <span className="key">await</span> <span className="func">fetch</span>(<span className="str">'https://kaiwu.dev/v1/search'</span>, {'{'}<br/>
            &nbsp;&nbsp;<span className="key">method</span>: <span className="str">'POST'</span>,<br/>
            &nbsp;&nbsp;<span className="key">headers</span>: {'{'} <span className="str">'Authorization'</span>: <span className="str">'Bearer kw_...'</span> {'}'},<br/>
            &nbsp;&nbsp;<span className="key">body</span>: JSON.stringify({'{'}<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="key">query</span>: <span className="str">'台灣 AI 基本法草案重點'</span>,<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="key">lang</span>: <span className="str">'zh-TW'</span>,<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="key">include_content</span>: <span className="key">true</span><br/>
            &nbsp;&nbsp;{'}'})<br/>
            {'}'})
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <h2>為什麼選開物？</h2>
          <div className="grid">
            {features.map((f, i) => (
              <div className="card" key={i}>
                <div className="icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="comparison">
        <div className="container">
          <h2>比較</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>開物 Kaiwu</th>
                  <th>Tavily</th>
                  <th>博查 AI</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>中文搜尋品質</td><td className="highlight">繁中 + 簡中</td><td>一般</td><td>簡中 OK</td></tr>
                <tr><td>政治審查</td><td><span className="check">✓ 無審查</span></td><td><span className="check">✓ 無審查</span></td><td><span className="cross">✗ 雙重過濾</span></td></tr>
                <tr><td>搜尋來源</td><td className="highlight">Google / DuckDuckGo / Brave</td><td>自有索引</td><td>百度 / 搜狗（已審查）</td></tr>
                <tr><td>繁簡互查</td><td><span className="check">✓ 自動擴展</span></td><td><span className="cross">✗</span></td><td><span className="cross">✗</span></td></tr>
                <tr><td>MCP / LangChain</td><td><span className="check">✓ Day 1</span></td><td><span className="check">✓</span></td><td><span className="cross">✗</span></td></tr>
                <tr><td>數據主權</td><td className="highlight">台灣</td><td>美國</td><td>中國</td></tr>
                <tr><td>定價 (1K searches)</td><td className="highlight">$3</td><td>$5</td><td>~$4 (¥0.03/次)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing">
        <div className="container">
          <h2>定價</h2>
          <div className="pricing-grid">
            {pricingPlans.map((p, i) => (
              <div className={`price-card ${p.featured ? 'featured' : ''}`} key={i}>
                <h3>{p.name}</h3>
                <div className="price">{p.price}</div>
                <div className="price-unit">{p.unit}</div>
                <ul>
                  {p.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="container">
          <p style={{ marginBottom: 8 }}>
            <strong>開物 Kaiwu</strong> — 天工開物，AI 開啟萬物知識
          </p>
          <p>
            <a href="https://github.com/dAAAb/Kaiwu-Dev">GitHub</a> ·
            <a href="https://canfly.ai">CanFly.ai</a> ·
            Built in Taiwan 🇹🇼
          </p>
        </div>
      </footer>
    </>
  )
}

const features = [
  { icon: '🔓', title: '無審查搜尋', desc: '不用百度、不經「合規引擎」。聚合 Google、DuckDuckGo、Brave — 你搜什麼就給什麼，完整的世界觀。' },
  { icon: '🌏', title: '繁簡雙語原生', desc: '不是翻譯，是真的懂。搜「人工智慧」也找「人工智能」，台灣用語和中國用語同時覆蓋。' },
  { icon: '⚡', title: '一步到位', desc: '搜尋 + 內容提取 + 摘要，一個 API call 搞定。回傳 LLM-ready 的乾淨 markdown，直接餵進你的 Agent。' },
  { icon: '🔌', title: '即插即用', desc: 'MCP Server、OpenClaw Skill、LangChain Tool — 現有框架直接接。Tavily 能用的地方，開物都能用。' },
  { icon: '🏝️', title: '台灣部署', desc: '數據不進中國、不經美國。台灣節點，東亞低延遲。適合注重數據主權的團隊。' },
  { icon: '💰', title: '開發者友善定價', desc: 'Free tier 1,000 搜/月免費。付費方案更多額度 — 比 Tavily 便宜。' },
]

const pricingPlans = [
  { name: 'Free', price: '$0', unit: 'forever', featured: false, features: ['1,000 searches / 月', '50 extracts / 月', '1 req/s rate limit', 'Community support'] },
  { name: 'Developer', price: '$5', unit: '/ month', featured: true, features: ['5,000 searches / 月', '500 extracts / 月', '5 req/s rate limit', 'Email support'] },
  { name: 'Pro', price: '$29', unit: '/ month', featured: false, features: ['10,000 searches / 月', '5,000 extracts / 月', 'Deep research reports', '20 req/s rate limit'] },
]

const landingStyles = `
  .landing-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: rgba(10,14,26,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border); padding: 12px 0;
  }
  .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }
  .hero { text-align: center; padding: 140px 24px 80px; position: relative; }
  .hero::before {
    content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .badge {
    display: inline-block; background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.3); color: var(--accent);
    font-size: 13px; font-weight: 600; padding: 6px 16px;
    border-radius: 999px; margin-bottom: 32px; letter-spacing: 0.5px;
  }
  .hero h1 {
    font-size: clamp(40px, 7vw, 72px); font-weight: 800; line-height: 1.1; margin-bottom: 8px;
    background: linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .hero .subtitle { font-size: clamp(18px, 3vw, 28px); color: var(--muted); font-weight: 400; margin-bottom: 24px; }
  .hero .tagline { font-size: 18px; color: var(--muted); max-width: 600px; margin: 0 auto 48px; line-height: 1.6; }
  .hero .tagline em { color: var(--accent); font-style: normal; font-weight: 600; }
  .cta-group { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px;
    border-radius: 12px; font-size: 16px; font-weight: 600; text-decoration: none;
    transition: all 0.2s; border: none; cursor: pointer;
  }
  .btn-primary { background: var(--accent); color: #0a0e1a; }
  .btn-primary:hover { background: #fbbf24; transform: translateY(-1px); }
  .btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: var(--accent); }
  .code-section { padding: 60px 24px; }
  .code-block {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    padding: 32px; overflow-x: auto; font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 14px; line-height: 1.8; color: var(--muted);
  }
  .code-block .comment { color: #4b5563; }
  .code-block .key { color: #60a5fa; }
  .code-block .str { color: #34d399; }
  .code-block .func { color: #fbbf24; }
  .features { padding: 80px 24px; }
  .features h2 { text-align: center; font-size: 32px; margin-bottom: 48px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    padding: 32px; transition: border-color 0.2s;
  }
  .card:hover { border-color: rgba(245,158,11,0.4); }
  .card .icon { font-size: 32px; margin-bottom: 16px; }
  .card h3 { font-size: 18px; margin-bottom: 8px; }
  .card p { color: var(--muted); font-size: 14px; line-height: 1.6; }
  .comparison { padding: 80px 24px; }
  .comparison h2 { text-align: center; font-size: 32px; margin-bottom: 48px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 16px 20px; text-align: left; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
  td:first-child { font-weight: 600; }
  .highlight { color: var(--accent); font-weight: 700; }
  .check { color: var(--green); }
  .cross { color: #ef4444; }
  .pricing { padding: 80px 24px; }
  .pricing h2 { text-align: center; font-size: 32px; margin-bottom: 48px; }
  .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px; }
  .price-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
    padding: 32px; text-align: center;
  }
  .price-card.featured { border-color: var(--accent); position: relative; }
  .price-card.featured::after {
    content: 'Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
    background: var(--accent); color: #0a0e1a; font-size: 12px; font-weight: 700;
    padding: 4px 12px; border-radius: 999px;
  }
  .price-card h3 { font-size: 20px; margin-bottom: 8px; }
  .price-card .price { font-size: 40px; font-weight: 800; margin: 16px 0 4px; }
  .price-card .price-unit { color: var(--muted); font-size: 14px; margin-bottom: 24px; }
  .price-card ul { list-style: none; text-align: left; font-size: 14px; color: var(--muted); }
  .price-card li { padding: 8px 0; border-top: 1px solid var(--border); }
  .price-card li::before { content: '✓ '; color: var(--green); font-weight: 700; }
  footer {
    text-align: center; padding: 60px 24px; color: var(--muted); font-size: 14px;
    border-top: 1px solid var(--border);
  }
  footer a { color: var(--accent); text-decoration: none; }
  footer a:hover { text-decoration: underline; }
`
