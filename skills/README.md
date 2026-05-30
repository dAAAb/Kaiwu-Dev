# 開物 Kaiwu — Agent Skills

把中文世界的 AI 搜尋接進你的 coding agent（Claude Code、Cursor…）。對標 Tavily 的 Agent Skills，繁簡雙語、無審查、台灣部署。

## 安裝

### 1. 安裝 Kaiwu CLI

```bash
curl -fsSL https://kaiwu.dev/install.sh | bash
kw login
```

### 2. 安裝 Skills

```bash
# 全部安裝
npx skills add dAAAb/Kaiwu-Dev --all

# 或單獨安裝
npx skills add dAAAb/Kaiwu-Dev --skill kaiwu-search
```

安裝後重啟你的 agent。

### Claude Code plugin marketplace（替代方式）

```
/plugin marketplace add dAAAb/Kaiwu-Dev
/plugin install kaiwu@kaiwu
```

## 可用 Skills

| Skill | 用途 |
|-------|------|
| `kaiwu-search` | 中文網路搜尋，回傳 agent 最佳化結果 |
| `kaiwu-extract` | 從 URL 抓取乾淨 markdown/文字 |
| `kaiwu-credits` | 查詢剩餘額度 |
| `kaiwu-cli` | 安裝、認證、API 對照參考 |
| `kaiwu-best-practices` | 正式整合的最佳實踐 |

## 用法

**自動**：agent 會依你的需求情境自動觸發對應 skill。

**手動（slash command）**：

```
/kaiwu-search 台灣 AI 基本法草案重點
/kaiwu-extract https://example.com/article
/kaiwu-credits
/kaiwu-best-practices
```

整合前建議先讀 `/kaiwu-best-practices` —— 上線最快的捷徑。

## 額度計費

| 動作 | 額度 |
|------|------|
| search（basic） | 1 |
| search（advanced） | 2 |
| search `--answer` | +1 |
| extract（每成功 URL） | 1 |
| extract `--query` | +1 |

Free 方案每月 1,000 額度。詳情見 https://kaiwu.dev

---

Built in Taiwan 🇹🇼 · [kaiwu.dev](https://kaiwu.dev) · [GitHub](https://github.com/dAAAb/Kaiwu-Dev)
