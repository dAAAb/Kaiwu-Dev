<div align="center">

# 開物 Kaiwu

**中文世界的 AI 搜尋 API** · Web search built for AI agents, in Chinese

[![Live](https://img.shields.io/badge/status-live-10b981)](https://kaiwu.dev)
[![CLI](https://img.shields.io/badge/CLI-%40kaiwu%2Fcli-f59e0b)](https://kaiwu.dev/cli)
[![MCP](https://img.shields.io/badge/MCP-ready-3b82f6)](https://kaiwu.dev/mcp)
[![License](https://img.shields.io/badge/license-MIT-blue)](#-授權)

「天工開物」— AI 幫你開啟萬物的知識。<br/>
*無審查、繁簡雙語、LLM-ready。Built in Taiwan 🇹🇼*

[官網](https://kaiwu.dev) · [CLI & Skills](https://kaiwu.dev/cli) · [儀表板](https://kaiwu.dev/dashboard)

</div>

---

## 📌 一句話

開物是專為中文 AI Agent 打造的搜尋引擎 API —— 聚合 Google / DuckDuckGo / Brave，回傳給 LLM 最佳化的乾淨結果。把它想成**中文世界的 Tavily**。

## ✨ 特色

- 🔓 **無審查搜尋** —— 不經百度/搜狗等已審查來源，聚合國際搜尋引擎，完整世界觀。
- 🌏 **繁簡雙語原生** —— 搜「人工智慧」也涵蓋「人工智能」，台灣與中國用語自動互查。
- ⚡ **一步到位** —— 搜尋 + 網頁抓取 + 語意摘要，一個 API call 回傳 LLM-ready markdown。
- 🔌 **即插即用** —— CLI、Claude Code / Cursor Agent Skills、MCP Server、REST API，Day-1 支援。
- 🏝️ **台灣部署** —— 資料不進中國、不經美國，對東亞/東南亞低延遲。

## 🆚 比較

| | 開物 Kaiwu 🇹🇼 | Tavily 🇺🇸 | 博查 AI 🇨🇳 |
|---|---|---|---|
| 中文搜尋品質 | **繁中 + 簡中** | 一般 | 簡中 OK |
| 政治審查 | ✅ 無 | ✅ 無 | ❌ 雙重過濾 |
| 搜尋來源 | **Google / DuckDuckGo / Brave** | 自有索引 | 百度 / 搜狗（已審查） |
| 繁簡互查 | ✅ 自動 | ❌ | ❌ |
| MCP / CLI / Skills | ✅ Day 1 | ✅ | ❌ |
| 數據主權 | **台灣** | 美國 | 中國 |
| 定價 | **限時免費**（付費方案籌備中） | $5 / 1K | ~$4 / 1K |

## 🚀 快速開始

### 方式一：CLI

```bash
curl -fsSL https://kaiwu.dev/install.sh | bash
kw login
kw search "台灣 AI 基本法草案重點" --depth advanced --answer
```

詳見 [CLI & Skills 文件](https://kaiwu.dev/cli) 或 [`cli/README.md`](./cli/README.md)。

### 方式二：Agent Skills（Claude Code / Cursor）

```bash
npx skills add dAAAb/Kaiwu-Dev --all
# 或 Claude Code plugin marketplace：
#   /plugin marketplace add dAAAb/Kaiwu-Dev
```

提供 `kaiwu-search`、`kaiwu-extract`、`kaiwu-credits`、`kaiwu-cli`、`kaiwu-best-practices`。詳見 [`skills/`](./skills/)。

### 方式三：REST API

```bash
curl -s https://kaiwu.dev/v1/search \
  -H "Authorization: Bearer $KAIWU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"台灣 AI 政策","search_depth":"advanced","include_answer":true}'
```

### 方式四：MCP Server

Streamable HTTP 端點：`https://kaiwu.dev/mcp`，內建 `kaiwu_search` 與 `kaiwu_extract` 工具，可直接接進支援 MCP 的客戶端。

## 📡 API 端點

| 端點 | 方法 | 說明 | 額度 |
|------|------|------|------|
| `/v1/search` | POST | 搜尋（basic / advanced，可選 `include_answer`） | 1–3 |
| `/v1/extract` | POST | 抓取 URL → 乾淨 markdown / text，可選 `query` 語意過濾 | 每 URL 1（+1） |
| `/v1/credits` | GET | 查詢剩餘額度 | 0 |
| `/api/stats` | GET | 公開使用統計（用戶數、查詢數） | 0 |
| `/api/keys` | GET/POST/DELETE | API key 管理（需登入） | 0 |
| `/mcp` | GET/POST | MCP Server（Streamable HTTP） | 同 search |

**認證**：`Authorization: Bearer kw_...`（API key 格式為 `kw_` + 32 hex）。

### `/v1/search` 參數

| 參數 | 型別 | 說明 |
|------|------|------|
| `query` | string | 搜尋關鍵字（必填，建議 <400 字） |
| `search_depth` | `basic`\|`advanced` | advanced 會抓網頁 + LLM 語意摘要 |
| `max_results` | integer | 1–20（預設 5；省略或 0 視同預設） |
| `time_range` | `day`\|`week`\|`month`\|`year`\|`all` | 時間範圍；省略則依查詢推斷 |
| `category` | `general`\|`news`\|`auto` | 搜尋分類；`auto` 或省略則時事走新聞 |
| `lang` | string | `zh-TW`（預設）/ `zh-CN` / `en` |
| `include_answer` | boolean | 有結果時生成 AI 綜合答案 |

### `/v1/extract` 參數

| 參數 | 型別 | 說明 |
|------|------|------|
| `urls` | string \| string[] | 一或多個 URL（最多 20） |
| `format` | `markdown`\|`text` | 輸出格式（預設 markdown） |
| `query` | string | 只保留與查詢相關的內容（LLM 過濾，+1 額度） |

## 💰 定價

目前**限時免費**：付費方案推出前，所有功能（search / extract / MCP / CLI）都在 Free 額度內免費使用，正式收費會提前通知。

| 方案 | 價格 | 額度（單一額度池） | 狀態 |
|------|------|------|------|
| Free | $0 | 每月 1,000 額度 | 可用 |
| Developer | $5 / 月 | 每月 5,000 額度 | 即將推出 |
| Pro | $29 / 月 | 每月 10,000 額度 | 即將推出 |

額度計費：search basic = 1，advanced = 2，`+answer` +1；extract 每成功 URL = 1，`+query` +1。

## 🏗️ 技術架構

```
Client / Agent
      │
      ▼
Cloudflare Pages + Functions   ← kaiwu.dev/v1/*
  ├── Auth (Privy JWT + API key kw_xxx)
  ├── Credit management (D1)
  └── 三層搜尋：
        Search (SearXNG) → Extract (fetch + htmlToMarkdown) → Summarize (Gemini / Ollama)
```

- **前端**：React 18 + TypeScript + Vite + Tailwind（深色主題，amber accent）
- **後端**：Cloudflare Pages Functions
- **資料庫**：Cloudflare D1（SQLite）—— users / api_keys / usage_logs
- **搜尋引擎**：SearXNG（自架）
- **LLM**：Gemini 2.5 Flash（primary）+ Ollama（fallback）
- **認證**：Privy（email / wallet / Google / GitHub）→ JWT

## 📁 專案結構

```
Kaiwu-Dev/
├── functions/              # Cloudflare Pages Functions（API）
│   ├── v1/search.ts        #   POST /v1/search
│   ├── v1/extract.ts       #   POST /v1/extract
│   ├── v1/credits.ts       #   GET  /v1/credits
│   ├── api/stats.ts        #   GET  /api/stats（公開統計）
│   ├── api/keys.ts         #   API key CRUD
│   ├── api/auth/callback.ts
│   └── mcp.ts              #   MCP Server
├── src/                    # React 前端
│   ├── pages/Landing.tsx   #   首頁
│   ├── pages/Cli.tsx       #   /cli 說明頁
│   └── pages/Dashboard.tsx #   儀表板
├── cli/                    # @kaiwu/cli —— kw CLI
├── skills/                 # Claude Code / Cursor Agent Skills
├── .claude-plugin/         # plugin marketplace 清單
├── public/install.sh       # CLI 一鍵安裝器
└── schema.sql              # D1 schema
```

## 🛠️ 本地開發

```bash
npm install
npm run dev            # Vite 前端（http://localhost:5173）

# 連同 Functions 一起跑（需 wrangler + 本地 D1）
npx wrangler pages dev -- npm run dev
```

機密設定（本地放 `.dev.vars`，正式環境用 secret）：

```bash
npx wrangler pages secret put GEMINI_API_KEY
npx wrangler pages secret put OLLAMA_URL      # 選用
```

D1 初始化：

```bash
npx wrangler d1 execute kaiwu-db --file=schema.sql
```

## 🚢 部署

Cloudflare Pages，git-based 自動部署。`wrangler.toml` 已綁定 D1（`kaiwu-db`）與環境變數。

```bash
npm run build         # tsc + vite build → dist/
# push 到 main 即自動部署，或：
npx wrangler pages deploy dist
```

## 📄 授權

MIT © [Kaiwu 開物](https://kaiwu.dev)

---

<div align="center">

天工開物，AI 開啟萬物知識 · Built in Taiwan 🇹🇼

[kaiwu.dev](https://kaiwu.dev) · [CanFly.ai](https://canfly.ai)

</div>
