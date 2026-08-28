# @kaiwu/cli — 開物 Kaiwu CLI

中文世界的 AI 搜尋，就在你的終端機。`kw` 是 [kaiwu.dev](https://kaiwu.dev) REST API 的薄封裝：搜尋繁簡中文網路、抓取網頁轉 markdown、查詢額度。零依賴、Node 18+。

[![npm](https://img.shields.io/npm/v/%40kaiwu%2Fcli?color=f59e0b)](https://www.npmjs.com/package/@kaiwu/cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

## 安裝

```bash
# 全域安裝
npm install -g @kaiwu/cli

# 免安裝直接執行
npx @kaiwu/cli search "台灣 AI 政策" --json

# 一鍵安裝腳本（會用 npm 全域安裝）
curl -fsSL https://kaiwu.dev/install.sh | bash
```

確認：`kw --version`

## 登入

到 [kaiwu.dev/dashboard](https://kaiwu.dev/dashboard) 取得金鑰（`kw_...`），然後：

```bash
kw login              # 互動式輸入（不回顯）
kw login kw_xxxxx     # 直接給
echo "$KEY" | kw login   # 從 stdin（CI / 腳本）
```

金鑰會先向 API 驗證，成功才寫入 `~/.kaiwu/config.json`（權限 600）。無效金鑰不會被儲存。

也可以不登入，直接用環境變數：`export KAIWU_API_KEY="kw_xxxxx"`（優先於設定檔）。

## 指令

```bash
kw search "台灣 AI 基本法草案重點" --depth advanced --answer
kw search "輝達 GTC" --time-range week --max-results 10 --json
echo "量子電腦" | kw search - --json
kw extract https://example.com/article --query "重點"
kw extract https://a.com https://b.com --format text --json
kw credits
kw config
```

| 指令 | 說明 |
|------|------|
| `kw login [key]` | 驗證並儲存 API 金鑰（互動 / 參數 / stdin / `KAIWU_API_KEY`） |
| `kw logout` | 移除已儲存金鑰 |
| `kw search <query>` | 搜尋中文網路（`-` 代表從 stdin 讀查詢） |
| `kw extract <url...>` | 抓取網頁轉 markdown / 純文字（`-` 代表從 stdin 讀 URL，最多 20 個） |
| `kw credits` | 查詢額度 |
| `kw config [set k v]` | 顯示 / 修改設定（`base_url`、`api_key`）；`kw config path` 顯示設定檔位置 |

別名：`s` = search、`e` = extract、`c` = credits。

### search 選項

| 選項 | 說明 | 額度 |
|------|------|------|
| `--depth, -d` | `basic`（預設）/ `advanced`（抓網頁 + LLM 語意摘要） | 1 / 2 |
| `--max-results, -n` | 1–20（預設 5） | |
| `--time-range, -t` | `day` / `week` / `month` / `year` | |
| `--lang, -l` | `zh-TW`（預設）/ `zh-CN` / `en` | |
| `--answer, -a` | 生成 AI 綜合答案（含 `[1][2]` 來源標註） | +1 |

### extract 選項

| 選項 | 說明 | 額度 |
|------|------|------|
| `--format, -f` | `markdown`（預設）/ `text` | 每個成功 URL 1 |
| `--query, -q` | 只保留與查詢相關的段落（LLM 過濾） | +1 |

### 通用選項

| 選項 | 說明 |
|------|------|
| `--json` | 輸出 JSON。**錯誤也會以單行 JSON 輸出到 stdout**（`{"error","exit_code","status",...}`），方便 agent 解析 |
| `-o, --output <file>` | 將 JSON 結果存到檔案 |
| `--version, -v` / `--help, -h` | 版本 / 說明 |

未知選項會直接報錯（避免 `--max_results` 之類的打錯字被靜默忽略）。

## 環境變數

| 變數 | 說明 |
|------|------|
| `KAIWU_API_KEY` | API 金鑰，優先於設定檔 |
| `KAIWU_API_URL` | 自訂端點（預設 `https://kaiwu.dev`），自架 / 測試用 |
| `KAIWU_TIMEOUT` | 請求逾時秒數（預設 120；advanced 搜尋較慢） |
| `NO_COLOR` | 關閉彩色輸出（非 TTY 時自動關閉） |
| `KAIWU_DEBUG` | 遇到非預期錯誤時印出 stack trace |

## 結束碼

| 碼 | 意義 | 建議 |
|----|------|------|
| `0` | 成功 | |
| `1` | 用法 / 輸入錯誤、其他 4xx、非預期錯誤 | 檢查參數 |
| `2` | 認證失敗（未登入、401、403） | `kw login` 或檢查 `KAIWU_API_KEY` |
| `3` | 額度不足（429，JSON 內含 `credits_needed` / `credits_remaining`） | 降級為 `--depth basic`、減少 `-n`，或等月初重置 |
| `4` | 網路失敗、逾時、伺服器錯誤（5xx） | 退避重試 |
| `130` | 使用者中斷（Ctrl-C） | |

## API 對照

CLI 直接對應 REST API，欄位名稱一致：

| CLI | API |
|-----|-----|
| `kw search` | `POST /v1/search` — `{query, search_depth, max_results, time_range, lang, include_answer}` |
| `kw extract` | `POST /v1/extract` — `{urls[], format, query}` |
| `kw credits` | `GET /v1/credits` |

完整文件：[kaiwu.dev/developers](https://kaiwu.dev/developers) · OpenAPI：[kaiwu.dev/openapi.json](https://kaiwu.dev/openapi.json) · MCP：`https://kaiwu.dev/mcp`

## AI Agent 整合

同一個 repo 提供 [Claude Code Agent Skills](https://github.com/dAAAb/Kaiwu-Dev/tree/main/skills)（對標 Tavily skills 結構）：

```bash
npx skills add dAAAb/Kaiwu-Dev --all
```

或 Claude Code plugin marketplace：`/plugin marketplace add dAAAb/Kaiwu-Dev` → `/plugin install kaiwu@kaiwu`。

## 開發

```bash
cd cli
npm test                     # syntax check + smoke
node bin/kw.js --help
KAIWU_API_URL=http://localhost:8788 node bin/kw.js credits   # 對本機 wrangler dev
```

---

MIT · Built in Taiwan 🇹🇼 · [kaiwu.dev](https://kaiwu.dev) · [GitHub](https://github.com/dAAAb/Kaiwu-Dev) · [回報問題](https://github.com/dAAAb/Kaiwu-Dev/issues)
