---
name: kaiwu-credits
description: 查詢開物 Kaiwu API 帳戶的剩餘額度、已用量與重置時間。在大量搜尋/抓取前或遇到額度不足錯誤時使用。Check remaining Kaiwu API credits, usage, and reset time.
---

# kaiwu credits

查詢開物 Kaiwu 帳戶的額度狀態。

## 執行任何指令前

如果 PATH 上找不到 `kw`，先安裝並登入：

```bash
curl -fsSL https://kaiwu.dev/install.sh | bash && kw login
```

## 什麼時候用

- 開始一批大量搜尋/抓取前，先確認額度夠不夠
- 遇到 `額度不足` / HTTP 429 錯誤時
- 想知道額度何時重置

## 快速開始

```bash
kw credits          # 人類可讀
kw credits --json   # 給 agent 解析
```

## 回傳格式

```json
{
  "monthly_credits": 1000,
  "credits_used": 42,
  "credits_remaining": 958,
  "resets_at": "2026-07-01T00:00:00Z"
}
```

## 額度計費

| 動作 | 額度 |
|------|------|
| `kw search`（basic） | 1 |
| `kw search --depth advanced` | 2 |
| `kw search --answer` | +1 |
| `kw extract`（每個成功 URL） | 1 |
| `kw extract --query`（語意過濾） | +1 |

Free 方案每月 1,000 額度。方案詳情見 https://kaiwu.dev

## 參見

- [kaiwu-search](../kaiwu-search/SKILL.md)
- [kaiwu-extract](../kaiwu-extract/SKILL.md)
