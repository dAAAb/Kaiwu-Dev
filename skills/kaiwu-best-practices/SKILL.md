---
name: kaiwu-best-practices
description: 用開物 Kaiwu 建構正式整合的最佳實踐 — 額度管理、查詢技巧、繁簡策略、錯誤處理、何時用 search vs extract。要把開物接進 agent / 應用前先讀這個。Reference for production-ready Kaiwu integrations.
---

# kaiwu best practices

把開物 Kaiwu 接進正式 agent / 應用的最佳實踐。要做整合，這是最快的入門。

## 1. 選對工具

| 你要做的事 | 用 |
|-----------|----|
| 找資訊、還沒有 URL | `kw search` |
| 快速一般查詢 | `kw search --depth basic`（預設，1 額度） |
| 需要精確事實 / 原文摘要 | `kw search --depth advanced`（2 額度） |
| 要一段可引用的綜合答案 | `kw search --answer` |
| 已有 URL、要讀全文 | `kw extract` |
| 從多源只挑相關段落 | `kw extract --query "..."` |

**省額度原則**：先 `basic` 搜尋拿到候選 URL，真正需要全文時才對少數 URL 用 `extract`，比每次都 `advanced` 划算。

## 2. 查詢撰寫

- 用「搜尋關鍵詞」思維，不要寫一整段 prompt。控制在 400 字內。
- 複雜問題拆成子查詢，分別搜尋再彙整。
- 善用繁簡：開物會自動互查，但若目標是中國來源，明確 `--lang zh-CN` 效果更好；台灣在地議題用 `--lang zh-TW`。
- 時效性問題加 `--time-range week`（或 day/month/year），避免拿到過期資訊。

## 3. 額度管理

- 程式流程開始前先 `kw credits --json` 確認餘額。
- 預期成本：search basic=1、advanced=2、+answer=+1；extract=每成功 URL 1、+query=+1。
- 遇到 HTTP 429（額度不足），回應 body 會帶 `credits_needed` 與 `credits_remaining`，據此降級（例如改 basic、減少 max-results）。

## 4. 錯誤處理

| 狀態 | 意義 | 建議 |
|------|------|------|
| 401 | 金鑰無效 / 缺失 | 檢查 `KAIWU_API_KEY` |
| 429 | 額度不足 | 降級或等重置 |
| 502 | 搜尋引擎暫時無法使用 | 退避重試 |
| extract `status: failed` | 該 URL 抓取失敗（反爬蟲 / 逾時） | 該 URL 不計費；改用 `search --depth advanced` 取摘要 |

extract 是逐 URL 回報成功/失敗的，永遠檢查每筆 `status`，別假設全部成功。

## 5. agent 整合建議

- 解析輸出一律加 `--json`，不要 parse 人類可讀格式。
- 大量任務用環境變數 `KAIWU_API_KEY`，不要把金鑰寫進程式碼或 commit。
- 需要可重現時用 `-o file.json` 落地結果。
- 串接管線：`search --json` → 取 `results[].url` → `extract --json --query`。

## 6. 中文世界的特性

- 開物聚合 Google / DuckDuckGo / Brave，**不經百度/搜狗**，因此沒有來源端審查。
- 繁簡雙語原生，適合台灣、香港、星馬華語圈與兩岸議題。
- 資料路徑在台灣，對東亞/東南亞低延遲、對數據主權敏感的團隊友善。

## 參見

- [kaiwu-cli](../kaiwu-cli/SKILL.md) — 安裝與認證
- [kaiwu-search](../kaiwu-search/SKILL.md) · [kaiwu-extract](../kaiwu-extract/SKILL.md) · [kaiwu-credits](../kaiwu-credits/SKILL.md)
