# 開物 Kaiwu — Product Plan

> **kaiwu.dev** — 中文世界的 AI 搜尋 API
> 「天工開物」— AI 幫你開啟萬物的知識

---

## 📌 一句話

Kaiwu 是專為中文 AI Agent 打造的搜尋引擎 API — 無審查、繁簡雙語、LLM-ready。

---

## 🎯 定位

| | 博查 AI（中國） | Tavily（美國） | **開物 Kaiwu（台灣）** |
|---|---|---|---|
| 語言 | 簡中 | 英文為主 | **繁中 + 簡中 + 英文** |
| 審查 | 雙重過濾 | 無 | **無** |
| 搜尋品質 | 百度/搜狗（已審查源） | Google（英文強） | **Google/Brave/DuckDuckGo 聚合** |
| 中文語意 | 簡中 OK | 差 | **繁簡都懂，台灣用語/文化脈絡** |
| 數據主權 | 中國境內 | 美國 | **台灣（對東亞/東南亞友好）** |
| 定價 | ¥0.03/query | $5/1K | **$3-5/1K（搶市場）** |
| MCP | ❌ | ✅ | **✅ Day 1** |

---

## 🏗️ 技術架構

```
                    kaiwu.dev
                       │
              ┌────────┴────────┐
              │   API Gateway   │  ← Cloudflare Workers
              │  (rate limit,   │     kaiwu.dev/v1/*
              │   auth, billing)│
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────┴────┐  ┌─────┴─────┐ ┌────┴────┐
    │ Search  │  │  Extract  │ │Research │
    │  Layer  │  │   Layer   │ │  Layer  │
    └────┬────┘  └─────┬─────┘ └────┬────┘
         │             │             │
    SearXNG       Crawl4AI     GPT Researcher
   (self-host)   (self-host)    (self-host)
```

### Layer 1：Search（搜尋）
- **SearXNG** 自架 instance（Zeabur 或 GCP 台灣）
- 聚合 Google、DuckDuckGo、Brave、Wikipedia
- **不用百度** — 避免審查源頭污染
- 中文分詞優化（jieba / ckip-transformers）
- 繁簡自動偵測 + 雙向搜尋（搜繁體也查簡體結果，反之亦然）

### Layer 2：Extract（內容提取）
- **Crawl4AI** 自架（Python, headless browser）
- 網頁 → clean markdown（LLM-ready）
- 自動去廣告、導航列、footer
- 支援 JS-rendered 頁面（SPA）
- 輸出：title, content, images, metadata

### Layer 3：Research（深度研究）— Phase 2
- 基於 **GPT Researcher** 架構
- 自動拆解問題 → 多輪搜尋 → 交叉比對 → 生成報告
- 支援使用者自選 LLM（OpenAI / Anthropic / Ollama）
- 這是高價值 tier，按報告收費

---

## 📡 API 設計

### v1 Endpoints

```
POST /v1/search
  → 搜尋 + 可選摘要（對標 Tavily /search）
  
POST /v1/extract  
  → 抓取指定 URL 內容（對標 Tavily /extract）

POST /v1/research  (Phase 2)
  → 深度研究報告（對標 GPT Researcher）

GET  /v1/credits
  → 查詢剩餘額度

GET  /health
  → 服務狀態
```

### Search Request

```json
{
  "query": "台灣 AI 產業政策 2026",
  "lang": "zh-TW",           // zh-TW | zh-CN | en | auto
  "search_depth": "basic",   // basic | advanced
  "max_results": 5,
  "include_content": true,   // 是否同時抓全文（search+extract 一步到位）
  "include_summary": false,  // 是否用 LLM 摘要
  "time_range": "month"      // day | week | month | year | all
}
```

### Search Response

```json
{
  "query": "台灣 AI 產業政策 2026",
  "results": [
    {
      "title": "行政院通過 AI 基本法草案",
      "url": "https://...",
      "snippet": "行政院今日通過...",
      "content": "（完整 markdown 全文，如 include_content=true）",
      "published": "2026-03-15",
      "score": 0.95,
      "language": "zh-TW"
    }
  ],
  "summary": "（LLM 摘要，如 include_summary=true）",
  "credits_used": 1,
  "credits_remaining": 999
}
```

### Extract Request

```json
{
  "urls": ["https://example.com/article"],
  "format": "markdown",      // markdown | text | html
  "include_images": false,
  "max_length": 10000
}
```

---

## 💰 定價

### Free Tier
- 100 searches/月
- 50 extracts/月
- Rate limit: 1 req/s
- 無 research
- 適合：試用、個人 side project

### Developer — $5/月
- 1,000 searches/月
- 500 extracts/月
- Rate limit: 5 req/s
- 無 research
- 適合：獨立開發者

### Pro — $29/月
- 10,000 searches/月
- 5,000 extracts/月
- 10 research reports/月
- Rate limit: 20 req/s
- 優先支援
- 適合：產品團隊、AI 公司

### Enterprise — 聯繫
- 無限量 + 自訂 rate limit
- SLA 保證
- 私有部署選項
- 自訂搜尋源

### Credit 加購
- Search: $3/1K credits（比 Tavily $5/1K 便宜）
- Extract: $2/1K credits
- Research: $5/report

---

## 🔌 整合生態 — Day 1

### MCP Server
```json
{
  "mcpServers": {
    "kaiwu": {
      "command": "npx",
      "args": ["kaiwu-mcp"],
      "env": { "KAIWU_API_KEY": "kw_..." }
    }
  }
}
```

### OpenClaw Skill
```yaml
# clawhub install kaiwu-search
name: kaiwu-search
description: AI-native Chinese search API
secrets:
  - KAIWU_API_KEY
```

### SDK
```python
# pip install kaiwu
from kaiwu import Kaiwu
kw = Kaiwu(api_key="kw_...")
results = kw.search("台灣 AI 政策", lang="zh-TW")
```

```typescript
// npm install kaiwu
import { Kaiwu } from 'kaiwu'
const kw = new Kaiwu({ apiKey: 'kw_...' })
const results = await kw.search('台灣 AI 政策', { lang: 'zh-TW' })
```

### LangChain / LlamaIndex
- `KaiwuSearchTool` — drop-in replacement for `TavilySearchTool`
- `KaiwuRetriever` — RAG 直接用

### CanFly.ai
- 產品頁：canfly.ai/apps/kaiwu
- 安裝教學 + HeyGen 介紹影片
- CanFly 蝦蝦一鍵安裝 Skill

---

## 🚀 Phase 計劃

### Phase 1：MVP（4-6 週）
- [ ] kaiwu.dev Landing Page（Cloudflare Pages）
- [ ] API Gateway（Cloudflare Workers）
- [ ] SearXNG instance（Zeabur / GCP 台灣）
- [ ] `/v1/search` endpoint（basic search）
- [ ] `/v1/extract` endpoint（URL → markdown）
- [ ] API key 管理 + credit 系統（D1 database）
- [ ] MCP Server（npm package）
- [ ] OpenClaw Skill
- [ ] Free tier 開放

### Phase 2：Growth（2-3 月）
- [ ] `/v1/research` endpoint（GPT Researcher 整合）
- [ ] Python SDK + TypeScript SDK
- [ ] LangChain / LlamaIndex integration
- [ ] 付費 tier 上線（Stripe）
- [ ] Dashboard（API key 管理、用量統計）
- [ ] CanFly.ai 產品頁上架
- [ ] ClawHub Skill 上架

### Phase 3：Moat（3-6 月）
- [ ] 中文語意 reranker（fine-tune embedding model）
- [ ] 台灣特有資料源整合（立法院公報、政府公開資料、PTT、Dcard）
- [ ] 繁簡自動擴展搜尋（查「人工智慧」也搜「人工智能」）
- [ ] 即時新聞 feed（台灣媒體 RSS 聚合）
- [ ] 多語言擴展（日文、韓文、泰文、越南文）

---

## 🎯 目標客群

### Primary：中文 AI 開發者
- 用 LangChain/LlamaIndex 的開發者
- OpenClaw agent 養蝦族
- 需要中文 RAG 的產品團隊

### Secondary：海外華人開發者
- 矽谷/歐洲/東南亞的華人工程師
- 做中文 AI 產品但不想用中國服務
- 需要「無審查」中文搜尋

### Tertiary：東亞市場
- 日本/韓國的 AI 團隊（CJK 語系共通痛點）
- 東南亞中文社群（馬來西亞/新加坡/印尼）

---

## 🏢 部署架構

```
Cloudflare (全球 CDN + Edge)
├── Pages: kaiwu.dev Landing + Dashboard
├── Workers: API Gateway + Auth + Billing
├── D1: Users, API Keys, Credits, Usage Logs
├── R2: Cache (搜尋結果快取，降低 SearXNG 負載)
└── KV: Rate limiting

Zeabur / GCP Taiwan
├── SearXNG instance (Docker)
├── Crawl4AI instance (Docker + headless Chrome)
└── (Phase 2) GPT Researcher instance
```

### 為什麼 Cloudflare + Zeabur？
- **Cloudflare Workers**: 全球邊緣，延遲低，免費額度大
- **Zeabur**: 台灣節點，跑 Docker 容器（SearXNG/Crawl4AI 需要）
- **成本**: 初期 ~$10-20/月（Zeabur），Cloudflare 幾乎免費

---

## 📊 競爭優勢總結

1. **唯一無審查的中文搜尋 API** — 博查做不到，Tavily 不懂中文
2. **繁簡雙語原生** — 不是翻譯，是真的懂
3. **台灣部署** — 數據不進中國，東亞延遲低
4. **開源核心** — SearXNG + Crawl4AI + GPT Researcher，不被鎖定
5. **生態整合** — MCP, OpenClaw, LangChain, CanFly 一條龍
6. **價格競爭力** — $3/1K vs Tavily $5/1K vs 博查 ¥0.03/query

---

## 📝 品牌

- **中文名**: 開物
- **英文名**: Kaiwu
- **全稱**: 開物 Kaiwu — AI Search for the Chinese World
- **出處**: 《天工開物》— 明朝宋應星，中國第一部工藝百科全書
- **寓意**: 天工（AI）開物（打開萬物知識）
- **Domain**: kaiwu.dev
- **Tagline 候選**:
  - 「開物致知」（開啟萬物，致其知識）
  - 「Search without walls」（無牆搜尋）
  - 「中文 AI 的眼睛」
  - 「The uncensored Chinese search API for AI」
