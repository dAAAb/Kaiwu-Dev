import { useEffect, useId, useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import Topology from '../components/Topology'
import Reveal from '../components/Reveal'
import MobileCta from '../components/MobileCta'
import AgentQuickstart from '../components/AgentQuickstart'
import { Icon } from '../components/Icons'
import { track } from '../lib/track'
import { PLANS } from '../lib/plans'

/* ─────────────────────────────────────────────────────────────
 * Content data — exported so the prerender step can emit JSON-LD
 * ──────────────────────────────────────────────────────────── */

export const LANDING_META = {
  title: '開物 Kaiwu — 中文世界的 AI 搜尋 API',
  description: '專為 AI agent 打造的中文搜尋 API：無審查、繁簡雙語自動互查、回傳 LLM-ready 的乾淨結果。一個 API call，支援 MCP、CLI、Claude Code / Cursor Skills。限時免費。',
  canonical: 'https://kaiwu.dev/',
}

export const FAQ: { q: string; a: string }[] = [
  { q: '開物和 Tavily、Exa 這類搜尋 API 差在哪？', a: '它們的索引與排序以英文網路為主，中文常只有簡體來源且不做繁簡互查。開物聚合 Google、DuckDuckGo、Brave 等國際引擎，把繁體與簡體用語同時展開查詢（例如「人工智慧」也會找「人工智能」），再把結果整理成 LLM 可直接使用的格式。' },
  { q: '「無審查」是什麼意思？', a: '開物不使用百度、搜狗等會過濾政治內容的來源，也不經過任何「合規引擎」。你搜什麼就回傳什麼，結果反映國際引擎看到的完整網路。' },
  { q: '現在真的免費嗎？', a: '是。目前所有功能限時免費：登入即得每月 1,000 額度（basic 搜尋 1 額度、advanced 2、加 answer 再 +1、extract 每個網址 1）。付費方案籌備中，推出前會提前通知，免費額度不會突然消失。' },
  { q: '資料會經過哪裡？', a: '服務部署在台灣節點，搜尋請求不進入中國、也不經美國資料路徑。查詢內容只用於計費紀錄與除錯，不會拿去訓練模型，詳見隱私權政策。' },
  { q: '怎麼接進我的 agent？', a: '四種方式：REST API（POST /v1/search）、遠端 MCP Server（https://kaiwu.dev/mcp）、CLI（kw search）、Claude Code / Cursor 的 Agent Skills（npx skills add dAAAb/Kaiwu-Dev --all）。也可以直接把首頁的 prompt 貼給你的 agent，它會自己讀 llms.txt 完成串接。' },
  { q: 'advanced 模式做了什麼？', a: 'basic 回傳搜尋引擎的標題與摘要；advanced 會實際抓取前幾個網頁、去除導覽與廣告、用 LLM 做語意切段，只保留和查詢相關的段落，適合需要引用原文的 agent。' },
  { q: '有速率限制嗎？', a: '目前沒有硬性的每秒請求上限，請以約 1 req/s 的節奏呼叫；每月額度用完會回 429（insufficient_credits）。需要更高的併發或額度，請寫信到 hello@kaiwu.dev。' },
]

const SAMPLE_RESPONSE = `{
  "query": "台灣 AI 基本法 草案 重點",
  "results": [
    {
      "title": "人工智慧基本法草案：立法重點與爭議整理",
      "url": "https://example.tw/ai-basic-act",
      "snippet": "草案明定七大基本原則：永續發展、人類自主、隱私保護、資安與安全、透明可解釋…",
      "published": "2026-05-12",
      "engine": "google",
      "language": "zh-TW"
    }
  ],
  "answer": "台灣《人工智慧基本法》草案以七項原則為核心…[1][2]",
  "credits_used": 3
}`

/* ─────────────────────────────────────────────────────────────
 * Building blocks
 * ──────────────────────────────────────────────────────────── */

function SectionHeading({ eyebrow, title, lede, id }: { eyebrow?: string; title: string; lede?: string; id?: string }) {
  return (
    <div className="max-w-2xl mb-10 sm:mb-14" id={id}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-h2 font-semibold text-fg">{title}</h2>
      {lede && <p className="mt-4 text-base sm:text-lg text-fg-muted leading-relaxed">{lede}</p>}
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  // Answers ship visible in the prerendered HTML (no-JS / crawlers / AT) and collapse once hydrated.
  const [hidden, setHidden] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const id = useId()
  useEffect(() => { setHydrated(true) }, [])
  useEffect(() => {
    if (!hydrated) return
    if (open) { setHidden(false); return }
    const t = setTimeout(() => setHidden(true), 220)
    return () => clearTimeout(t)
  }, [open, hydrated])
  return (
    <div className="border-b border-line last:border-0">
      <h3 className="m-0 text-base">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-button`}
          className="w-full flex items-start justify-between gap-4 py-5 text-left font-medium text-fg">
          <span>{q}</span>
          <Icon.ChevronDown className={`mt-1 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} hidden={hidden && !open}
        className={`grid transition-[grid-template-rows] duration-200 ${open || !hydrated ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden"><p className="pb-5 text-sm sm:text-[15px] text-fg-muted leading-relaxed">{a}</p></div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="py-4 sm:py-5">
      <div className="text-2xl sm:text-3xl font-semibold text-fg tabular-nums">{value.toLocaleString('en-US')}+</div>
      <div className="mt-1 text-xs sm:text-sm text-fg-muted">{label}</div>
    </div>
  )
}

function Feature({ icon, title, children, link }: { icon: React.ReactNode; title: string; children: React.ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="card card-hover h-full flex flex-col">
      <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-fg mb-2">{title}</h3>
      <p className="text-sm text-fg-muted leading-relaxed">{children}</p>
      {link && <a href={link.href} className="link inline-flex items-center gap-1 text-sm mt-4 self-start">{link.label} <Icon.ArrowRight size={14} /></a>}
    </div>
  )
}

function CtaBand({ title, body, primary, secondary, placement }: { title: string; body: string; primary: { href: string; label: string }; secondary?: { href: string; label: string }; placement: string }) {
  return (
    <div className="mt-12 card-inset flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-fg">{title}</p>
        <p className="mt-1 text-sm text-fg-muted">{body}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
        <a href={primary.href} className="btn btn-primary" onClick={() => track('cta_click', { placement })}>{primary.label} <Icon.ArrowRight size={16} /></a>
        {secondary && <a href={secondary.href} className="btn btn-secondary" onClick={() => track('cta_click', { placement: `${placement}_secondary` })}>{secondary.label}</a>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────── */

type Stats = { users: number; queries: number; tokens_estimated: number }

export default function Landing() {
  const [stats, setStats] = useState<Stats | 'error' | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/stats').then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => { if (alive) setStats(typeof d?.users === 'number' ? d : 'error') }).catch(() => { if (alive) setStats('error') })
    return () => { alive = false }
  }, [])
  const live = stats && stats !== 'error' ? stats : null

  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString('en-US'))

  return (
    <div className="min-h-screen bg-bg text-fg">
      <SiteHeader />

      <main id="main">
        {/* ═══ Hero ═══ */}
        <section className="hero-glow relative overflow-hidden">
          <Topology />
          <div className="container-x relative pt-14 pb-12 sm:pt-24 sm:pb-20">
            <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 items-center">
              <div className="max-w-xl">
                <p className="flex flex-wrap items-center gap-2 mb-6">
                  <span className="badge badge-accent">限時免費</span>
                  <span className="badge badge-neutral">繁 · 簡</span>
                  <span className="badge badge-neutral">MCP</span>
                  <span className="badge badge-neutral">CLI</span>
                  <span className="badge badge-filament">台灣部署</span>
                </p>
                <h1 className="text-display font-semibold text-fg">
                  中文世界的<br className="hidden sm:block" /> AI 搜尋 API
                </h1>
                <p className="mt-6 text-lg sm:text-xl text-fg-muted leading-relaxed">
                  開物讓你的 agent 搜得到<span className="text-fg font-medium">完整的中文網路</span>：不經審查來源、繁簡用語自動互查、回傳可直接餵給 LLM 的乾淨結果。一個 API call 就好。
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <a href="/dashboard" className="btn btn-primary btn-lg" onClick={() => track('cta_click', { placement: 'hero_primary' })}>
                    <Icon.Key size={18} /> 免費取得 API 金鑰
                  </a>
                  <a href="/developers#quickstart" className="btn btn-secondary btn-lg" onClick={() => track('cta_click', { placement: 'hero_developers' })}>
                    <Icon.Terminal size={18} /> 看文件
                  </a>
                </div>
                <p className="mt-3 text-xs text-fg-subtle">
                  限時免費 · 每月 1,000 額度 · 不用信用卡 · Email / Google / GitHub 登入
                </p>
              </div>

              <div className="min-w-0">
                <p className="eyebrow mb-3">有 agent？直接交給它</p>
                <AgentQuickstart />
                <p className="mt-3 text-xs text-fg-subtle">
                  完整規格在 <a href="/developers" className="link">開發者文件</a> · OpenAPI <a href="/openapi.json" className="link font-mono">kaiwu.dev/openapi.json</a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Live stats — space reserved at SSR ═══ */}
        <section aria-label="使用統計" aria-busy={stats === null} className="border-y border-line bg-surface/40 min-h-[104px] sm:min-h-[120px]">
          <div className="container-x grid grid-cols-3 divide-x divide-line text-center">
            {[
              { v: live?.users, l: '註冊開發者' },
              { v: live?.queries, l: '已處理查詢' },
              { v: live?.tokens_estimated, l: '處理 token（估計）' },
            ].map((x) => (
              x.v === undefined
                ? <div key={x.l} className="py-4 sm:py-5">{stats === 'error' ? <div className="text-2xl sm:text-3xl font-semibold text-fg-subtle" aria-label="暫時無法取得">—</div> : <div className="skeleton h-8 sm:h-9 w-16 sm:w-24 mx-auto" />}<div className="mt-2 text-xs sm:text-sm text-fg-muted">{x.l}</div></div>
                : <div key={x.l} className="py-4 sm:py-5"><div className="text-2xl sm:text-3xl font-semibold text-fg tabular-nums">{fmt(x.v)}<span className="text-accent">+</span></div><div className="mt-1 text-xs sm:text-sm text-fg-muted">{x.l}</div></div>
            ))}
          </div>
          <p className="container-x pb-3 -mt-1 text-[11px] sm:text-xs text-fg-subtle text-center">數字來自資料庫即時統計，加上固定的公開基線偏移（<a className="link" href="/developers#stats">計算方式</a>）。</p>
        </section>

        {/* ═══ Problem ═══ */}
        <section className="section">
          <Reveal className="container-x">
            <SectionHeading
              eyebrow="THE PROBLEM · 為什麼需要開物"
              title="英文搜尋 API 看不見的中文世界"
              lede="你的 agent 需要查中文資料時，多半會撞上三堵牆。"
            />
            <ul className="grid gap-6 md:grid-cols-3">
              {[
                { icon: <Icon.Lock />, t: '來源被審查', d: '簡中搜尋引擎在索引與排序兩層都會過濾政治敏感內容，agent 拿到的是被修剪過的世界。' },
                { icon: <Icon.Layers />, t: '繁簡是兩個網路', d: '「軟體」與「软件」、「晶片」與「芯片」——同一件事有兩套詞彙，英文優先的搜尋 API 只會命中其中一半。' },
                { icon: <Icon.Warning />, t: '結果不夠 LLM-ready', d: '網頁塞滿導覽、廣告與彈窗；agent 得自己抓頁面、清雜訊、切段，token 燒掉一半在垃圾上。' },
              ].map((p) => (
                <li key={p.t} className="flex gap-4">
                  <span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-fg-muted">{p.icon}</span>
                  <div>
                    <h3 className="font-semibold text-fg text-base">{p.t}</h3>
                    <p className="mt-1 text-sm text-fg-muted leading-relaxed">{p.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* ═══ How it works ═══ */}
        <section className="section border-t border-line" id="how">
          <Reveal className="container-x">
            <SectionHeading
              eyebrow="HOW IT WORKS · 運作方式"
              title="一次查詢，三層處理"
              lede="搜尋、抓取、整理，在一個請求裡完成。你只拿到 agent 需要的部分。"
            />
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] items-start">
              <ol className="space-y-6">
                {[
                  { n: '1', t: '搜尋（Search）', d: '把查詢同時展開成繁體與簡體用語，聚合 Google、DuckDuckGo、Brave 等國際引擎，去重後依相關性排序。', code: 'search_depth: "basic"  → 1 額度' },
                  { n: '2', t: '抓取（Extract）', d: 'advanced 模式會抓取前幾個網頁，移除導覽、廣告與樣板，只留正文；也可用 /v1/extract 單獨抓任意網址。', code: 'search_depth: "advanced"  → 2 額度' },
                  { n: '3', t: '整理（Summarize）', d: 'LLM 依你的查詢語意切段、保留相關段落，並可生成附來源標注的綜合答案。', code: 'include_answer: true  → +1 額度' },
                ].map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-accent text-bg text-sm font-semibold flex items-center justify-center">{s.n}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-fg text-base">{s.t}</h3>
                      <p className="mt-1 text-sm text-fg-muted leading-relaxed">{s.d}</p>
                      <code className="mt-2 inline-block text-xs font-mono text-fg-muted bg-surface-2 border border-line rounded-md px-2 py-1">{s.code}</code>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="code-panel">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-surface-2/60 text-xs text-fg-subtle font-mono">
                  <span className="badge badge-success" data-md-skip="">200</span> POST /v1/search · 回應範例
                </div>
                <pre tabIndex={0}><code className="font-mono whitespace-pre">{SAMPLE_RESPONSE}</code></pre>
              </div>
            </div>
            <CtaBand
              placement="how_it_works"
              title="先在儀表板的測試場試一次。"
              body="登入即得金鑰與 1,000 額度，測試場可以直接下查詢看回應。"
              primary={{ href: '/dashboard/playground', label: '開啟測試場' }}
              secondary={{ href: '/developers#quickstart', label: '讀快速開始' }}
            />
          </Reveal>
        </section>

        {/* ═══ Features ═══ */}
        <section className="section border-t border-line" id="features">
          <Reveal className="container-x">
            <SectionHeading eyebrow="WHAT YOU GET · 你得到什麼" title="為 agent 設計的搜尋，不是把人類搜尋引擎包一層" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Feature icon={<Icon.Shield />} title="無審查來源">聚合 Google、DuckDuckGo、Brave，不用百度與搜狗，不經任何合規過濾。你搜什麼就回什麼。</Feature>
              <Feature icon={<Icon.Layers />} title="繁簡雙語原生">不是翻譯，是同時查。「人工智慧」也找「人工智能」，台灣與中國用語一次覆蓋。</Feature>
              <Feature icon={<Icon.Spark />} title="LLM-ready 結果">乾淨的 markdown 正文、依查詢切段、附來源的綜合答案。少花一半 token 在雜訊上。</Feature>
              <Feature icon={<Icon.Plug />} title="四種接法" link={{ href: '/developers', label: '看整合方式' }}>REST API、遠端 MCP Server、CLI（kw）、Claude Code / Cursor Skills。Tavily 能用的地方，開物都能用。</Feature>
              <Feature icon={<Icon.Globe />} title="台灣部署、資料主權">節點在台灣，請求不進中國、不經美國。東亞低延遲，適合在意資料路徑的團隊。</Feature>
              <Feature icon={<Icon.Book />} title="給機器看的文件" link={{ href: '/llms.txt', label: 'llms.txt' }}>OpenAPI 3.1、llms.txt、每頁支援 Accept: text/markdown。agent 自己讀得懂，不用人翻譯。</Feature>
            </div>
          </Reveal>
        </section>

        {/* ═══ Comparison ═══ */}
        <section className="section border-t border-line" id="compare">
          <Reveal className="container-x">
            <SectionHeading eyebrow="COMPARISON · 比較" title="和其他搜尋 API 相比" lede="做得到的事很多家都能做；差別在中文世界的覆蓋與資料路徑。" />
            <div className="table-wrap">
              <table className="w-full min-w-[640px] text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="py-3 pr-4 font-medium text-fg-subtle border-b border-line">項目</th>
                    <th scope="col" className="py-3 px-4 font-semibold text-accent border-b border-line">開物 Kaiwu</th>
                    <th scope="col" className="py-3 px-4 font-medium text-fg-muted border-b border-line">Tavily</th>
                    <th scope="col" className="py-3 px-4 font-medium text-fg-muted border-b border-line">博查 AI</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['中文搜尋品質', '繁中 + 簡中', '一般', '簡中'],
                    ['政治審查', '無', '無', '雙重過濾'],
                    ['搜尋來源', 'Google / DuckDuckGo / Brave', '自有索引', '百度 / 搜狗'],
                    ['繁簡互查', '自動展開', '—', '—'],
                    ['MCP / CLI / Skills', 'Day 1', '有', '—'],
                    ['資料主權', '台灣', '美國', '中國'],
                    ['目前價格', '限時免費', '$5 / 1K', '約 $4 / 1K'],
                  ].map(([f, a, b, c]) => (
                    <tr key={f}>
                      <th scope="row" className="py-3 pr-4 text-fg font-medium border-b border-line text-left">{f}</th>
                      <td className="py-3 px-4 text-fg border-b border-line">{a}</td>
                      <td className="py-3 px-4 text-fg-muted border-b border-line">{b}</td>
                      <td className="py-3 px-4 text-fg-muted border-b border-line">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </section>

        {/* ═══ Integrations ═══ */}
        <section className="section border-t border-line" id="integrations">
          <Reveal className="container-x">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] items-start">
              <div>
                <SectionHeading eyebrow="INTEGRATIONS · 整合" title="接進你已經在用的工具" lede="不用改架構。挑一種方式，五分鐘內你的 agent 就會查中文。" />
                <div className="flex flex-wrap gap-2 -mt-6">
                  <a href="/developers" className="btn btn-primary">開發者文件</a>
                  <a href="/cli" className="btn btn-secondary">CLI & Skills</a>
                  <a href="/openapi.json" className="btn btn-secondary">OpenAPI</a>
                </div>
              </div>
              <div className="card p-0 sm:p-0 overflow-hidden">
                <ul className="divide-y divide-line">
                  {[
                    { k: 'REST', t: 'POST /v1/search · /v1/extract · GET /v1/credits', d: 'Bearer 金鑰，JSON in / JSON out', href: '/developers#quickstart' },
                    { k: 'MCP', t: 'https://kaiwu.dev/mcp', d: 'Streamable HTTP，工具 kaiwu_search 與 kaiwu_extract；Claude Code / Desktop、Cursor、OpenClaw', href: '/developers#mcp' },
                    { k: 'CLI', t: 'kw search "查詢" --answer', d: 'npm i -g @kaiwu/cli；--json 輸出給 script 用', href: '/cli' },
                    { k: 'Skills', t: 'npx skills add dAAAb/Kaiwu-Dev --all', d: 'kaiwu-search / extract / credits / best-practices，Claude Code 與 Cursor 自動觸發', href: '/cli#skills' },
                  ].map((e) => (
                    <li key={e.k}>
                      <a href={e.href} className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-1 px-4 sm:px-5 py-3 hover:bg-surface-2 transition-colors">
                        <span className="badge badge-filament font-mono w-16 justify-center shrink-0">{e.k}</span>
                        <span className="min-w-0">
                          <code className="font-mono text-sm text-fg break-all">{e.t}</code>
                          <span className="block text-xs text-fg-subtle mt-0.5">{e.d}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ═══ Pricing ═══ */}
        <section className="section border-t border-line" id="pricing">
          <Reveal className="container-x">
            <SectionHeading eyebrow="PRICING · 定價" title="現在：全部限時免費" lede="付費方案籌備中。推出前所有人都用免費方案的額度，正式收費前會提前通知，不會突然斷。" />
            <div className="card-inset mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="badge badge-accent shrink-0">限時免費</span>
              <p className="text-sm text-fg-muted">登入即得 <span className="text-fg font-medium">每月 1,000 額度</span>（約 1,000 次 basic 搜尋或 300 次 advanced + answer）。不用信用卡。</p>
              <a href="/dashboard" className="btn btn-primary sm:ml-auto shrink-0" onClick={() => track('cta_click', { placement: 'pricing' })}>免費開始</a>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => ({ name: plan.name, price: plan.price, unit: plan.available ? plan.period : `${plan.period} · 即將推出`, live: plan.available, items: plan.features })).map((p) => (
                <div key={p.name} className={`card flex flex-col ${p.live ? 'border-accent/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-fg">{p.name}</h3>
                    {p.live ? <span className="badge badge-success">可用</span> : <span className="badge badge-neutral">即將推出</span>}
                  </div>
                  <p className="mt-3"><span className="text-3xl font-semibold text-fg">{p.price}</span> <span className="text-sm text-fg-subtle">{p.unit}</span></p>
                  <ul className="mt-4 space-y-2 text-sm text-fg-muted">
                    {p.items.map((i) => <li key={i} className="flex gap-2"><Icon.Check size={16} className="mt-1 text-success shrink-0" />{i}</li>)}
                  </ul>
                  {p.live
                    ? <a href="/dashboard" className="btn btn-primary mt-6">免費開始</a>
                    : <a href="mailto:hello@kaiwu.dev?subject=開物付費方案通知" className="btn btn-secondary mt-6">推出時通知我</a>}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-fg-subtle">額度計算：basic 搜尋 1、advanced 2、include_answer +1；extract 每個成功網址 1、加 query 過濾 +1。</p>
          </Reveal>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="section border-t border-line" id="faq">
          <Reveal className="container-x">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              <SectionHeading eyebrow="FAQ · 常見問題" title="開發者常問的事" />
              <div className="card py-0 sm:py-0">{FAQ.map((f) => <FAQItem key={f.q} {...f} />)}</div>
            </div>
          </Reveal>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="section border-t border-line">
          <Reveal className="container-x">
            <div className="card sm:p-10 text-center">
              <h2 className="text-h2 font-semibold">讓你的 agent 看見完整的中文世界</h2>
              <p className="mt-3 text-fg-muted max-w-xl mx-auto">登入取得金鑰，一個 API call 開始搜尋。限時免費，每月 1,000 額度。</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                <a href="/dashboard" className="btn btn-primary btn-lg" onClick={() => track('cta_click', { placement: 'footer_cta' })}>免費取得 API 金鑰</a>
                <a href="/developers" className="btn btn-secondary btn-lg" onClick={() => track('cta_click', { placement: 'footer_docs' })}>開發者文件</a>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <MobileCta />
      <SiteFooter />
    </div>
  )
}
