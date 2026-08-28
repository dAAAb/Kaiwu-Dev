---
name: kaiwu-extract
description: 用開物 Kaiwu 從一個或多個 URL 抓取乾淨的 markdown/純文字內容，去除導覽列、廣告等雜訊。已經有特定網址、想讀全文時使用。Extract clean markdown/text from URLs, with optional query-based filtering.
---

# kaiwu extract

從特定 URL 抓取內容，轉成乾淨的 markdown 或純文字 — 自動移除導覽列、頁尾、廣告、script 等雜訊，回傳 LLM-ready 的正文。

## 執行任何指令前

如果 PATH 上找不到 `kw`，先安裝：

```bash
curl -fsSL https://kaiwu.dev/install.sh | bash && kw login
```

安裝與認證的其他方式見 [kaiwu-cli](../kaiwu-cli/SKILL.md)。

## 什麼時候用

- 你已經有一個或多個 URL，需要讀它的正文
- 想把網頁餵進 LLM，但不要雜訊
- [kaiwu-search](../kaiwu-search/SKILL.md) 之後的第二步：拿到結果 URL 再深入抓全文

## 快速開始

```bash
# 抓單一網頁（預設輸出 markdown）
kw extract "https://example.com/article" --json

# 一次抓多個
kw extract "https://example.com/a" "https://example.com/b" --json

# 只保留與查詢相關的內容（用 LLM 過濾）
kw extract "https://example.com/docs" --query "API 認證" --json

# 純文字輸出
kw extract "https://example.com/page" --format text --json

# 從 stdin 餵入網址（每行或逗號分隔）
echo "https://a.com https://b.com" | kw extract - --json
```

## 選項

| 選項 | 說明 |
|--------|------|
| `--format, -f` | `markdown`（預設）或 `text` |
| `--query, -q` | 只保留與此查詢相關的段落（LLM 過濾，+1 額度） |
| `--json` | 結構化 JSON 輸出（失敗時 stdout 也是單行 JSON `{"error","exit_code","status"}`） |
| `-o, --output` | 存到檔案 |

## 額度

- 每個成功抓取的 URL = 1 額度（失敗的 URL 不計費）。
- 加上 `--query` 語意過濾再 +1 額度。
- 一次最多 20 個 URL；URL 必須以 `http://` 或 `https://` 開頭。
- 結束碼：0 成功、1 用法錯誤、2 認證失敗、3 額度不足、4 網路/伺服器錯誤。

## 回傳格式

```json
{
  "results": [
    { "url": "...", "title": "...", "content": "# 標題\n\n正文...", "format": "markdown", "length": 1234, "status": "success" },
    { "url": "...", "status": "failed", "error": "逾時" }
  ],
  "success_count": 1,
  "failed_count": 1,
  "credits_remaining": 998
}
```

## 技巧

- 先用 [kaiwu-search](../kaiwu-search/SKILL.md) 找 URL，再用 extract 抓全文 — 比 `search --depth advanced` 更可控。
- 需要從一堆來源裡只挑相關段落時，用 `--query`，省下後續自己過濾的 token。
- 抓不到（403/逾時）很常見於有反爬蟲的站；改用 `search --depth advanced` 取得摘要當備案。

## 參見

- [kaiwu-search](../kaiwu-search/SKILL.md) — 還沒有 URL 時先搜尋
- [kaiwu-cli](../kaiwu-cli/SKILL.md) — 安裝、認證、API 對照
