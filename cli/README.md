# @kaiwu/cli — 開物 Kaiwu CLI

中文世界的 AI 搜尋，就在你的終端機。零依賴、Node 18+。

```bash
npm install -g @kaiwu/cli
# 或
curl -fsSL https://kaiwu.dev/install.sh | bash
```

## 登入

到 [kaiwu.dev/dashboard](https://kaiwu.dev/dashboard) 取得金鑰（`kw_...`），然後：

```bash
kw login
```

或用環境變數：`export KAIWU_API_KEY="kw_xxxxx"`

## 指令

```bash
kw search "台灣 AI 基本法草案重點" --depth advanced --answer
kw extract https://example.com/article --query "重點"
kw credits
kw config
```

| 指令 | 說明 |
|------|------|
| `kw login [key]` | 儲存 API 金鑰 |
| `kw logout` | 移除金鑰 |
| `kw search <query>` | 搜尋中文網路 |
| `kw extract <url...>` | 抓取網頁轉 markdown |
| `kw credits` | 查詢額度 |
| `kw config [set k v]` | 顯示 / 修改設定 |

### search 選項

| 選項 | 說明 |
|------|------|
| `--depth, -d` | `basic`（預設）/ `advanced` |
| `--max-results, -n` | 0–20（預設 5） |
| `--time-range, -t` | `day` / `week` / `month` / `year` |
| `--lang, -l` | `zh-TW`（預設）/ `zh-CN` / `en` |
| `--answer, -a` | 生成 AI 答案 |
| `--json` | JSON 輸出 |
| `-o, --output` | 存檔 |

### extract 選項

| 選項 | 說明 |
|------|------|
| `--format, -f` | `markdown`（預設）/ `text` |
| `--query, -q` | LLM 過濾相關內容 |
| `--json` | JSON 輸出 |
| `-o, --output` | 存檔 |

## 環境變數

| 變數 | 說明 |
|------|------|
| `KAIWU_API_KEY` | 覆蓋已儲存金鑰 |
| `KAIWU_API_URL` | 自訂端點（預設 `https://kaiwu.dev`） |
| `NO_COLOR` | 關閉彩色 |

## AI Agent 整合

本 CLI 同時提供 [Claude Code Agent Skills](https://github.com/dAAAb/Kaiwu-Dev/tree/main/skills)：

```bash
npx skills add dAAAb/Kaiwu-Dev --all
```

---

MIT · Built in Taiwan 🇹🇼 · [kaiwu.dev](https://kaiwu.dev)
