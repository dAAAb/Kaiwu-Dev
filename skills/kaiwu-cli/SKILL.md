---
name: kaiwu-cli
description: 開物 Kaiwu CLI（kw）的安裝、認證與設定參考，以及 search/extract/credits 的完整工作流程。設定環境、遇到 kw 找不到或認證問題時的參考。Install, auth, and configure the Kaiwu CLI (kw).
---

# kaiwu cli

開物 Kaiwu CLI（`kw`）的安裝、認證與設定總覽。中文世界的 AI 搜尋 API，專為 AI agent 打造 — 對標 Tavily，繁簡雙語、無審查、台灣部署。

## 安裝

### 方式一：一鍵安裝（建議）

```bash
curl -fsSL https://kaiwu.dev/install.sh | bash
```

### 方式二：npm

```bash
npm install -g @kaiwu/cli
```

### 方式三：直接用 npx（不安裝）

```bash
npx @kaiwu/cli search "你的查詢" --json
```

安裝後執行 `kw --version` 確認。

## 認證

1. 到 https://kaiwu.dev/dashboard 註冊並取得 API 金鑰（格式 `kw_` + 32 字元）。
2. 登入：

```bash
kw login            # 互動式輸入金鑰
kw login kw_xxxxx   # 直接給
```

金鑰會存在 `~/.kaiwu/config.json`（權限 600）。

### 用環境變數（CI / 容器）

```bash
export KAIWU_API_KEY="kw_xxxxx"
```

環境變數優先於設定檔。

### 自訂端點（自架 / 測試）

```bash
export KAIWU_API_URL="https://your-kaiwu-instance.dev"
# 或
kw config set base_url https://your-kaiwu-instance.dev
```

## 工作流程

開物的能力呈線性管線，按需要組合：

```
search  →  extract  →  (research)
找 URL     抓全文       多源彙整（規劃中）
```

- 不知道從哪開始 → [kaiwu-search](../kaiwu-search/SKILL.md)
- 已經有 URL → [kaiwu-extract](../kaiwu-extract/SKILL.md)
- 想確認額度 → [kaiwu-credits](../kaiwu-credits/SKILL.md)

## CLI ↔ API 對照

CLI 是 https://kaiwu.dev REST API 的薄封裝。直接打 API：

```bash
# search
curl -s https://kaiwu.dev/v1/search \
  -H "Authorization: Bearer $KAIWU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"台灣 AI 政策","search_depth":"advanced","include_answer":true}'

# extract
curl -s https://kaiwu.dev/v1/extract \
  -H "Authorization: Bearer $KAIWU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://example.com/article"],"format":"markdown"}'

# credits
curl -s https://kaiwu.dev/v1/credits \
  -H "Authorization: Bearer $KAIWU_API_KEY"
```

也可用 MCP server（Streamable HTTP）：`https://kaiwu.dev/mcp`。

## 疑難排解

| 症狀 | 解法 |
|------|------|
| `kw: command not found` | 重新執行安裝指令；npm 全域安裝需確認 PATH 含 npm bin |
| `需要 API 金鑰` / 401 | 執行 `kw login` 或設定 `KAIWU_API_KEY` |
| `額度不足` / 429 | `kw credits` 查餘額；等月初重置或升級方案 |
| 連線失敗 | 確認 `kw config` 的 base_url 正確 |

## 參見

- [kaiwu-best-practices](../kaiwu-best-practices/SKILL.md) — 上線整合的最佳實踐
- [kaiwu-search](../kaiwu-search/SKILL.md) · [kaiwu-extract](../kaiwu-extract/SKILL.md) · [kaiwu-credits](../kaiwu-credits/SKILL.md)
