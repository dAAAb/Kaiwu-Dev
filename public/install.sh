#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 開物 Kaiwu CLI installer
#   curl -fsSL https://kaiwu.dev/install.sh | bash
# ---------------------------------------------------------------------------
set -euo pipefail

PKG="@kaiwu/cli"
BIN="kw"

bold() { printf '\033[1m%s\033[0m' "$1"; }
amber() { printf '\033[38;5;214m%s\033[0m' "$1"; }
green() { printf '\033[32m%s\033[0m' "$1"; }
red() { printf '\033[31m%s\033[0m' "$1"; }
info() { printf '%s %s\n' "$(amber '▌')" "$1"; }
ok() { printf '%s %s\n' "$(green '✓')" "$1"; }
err() { printf '%s %s\n' "$(red '✗')" "$1" >&2; }

printf '\n%s\n' "$(amber '開物 Kaiwu CLI') — 中文世界的 AI 搜尋"
printf '%s\n\n' "$(bold 'https://kaiwu.dev')"

# Already installed?
if command -v "$BIN" >/dev/null 2>&1; then
  ok "已安裝：$($BIN --version 2>/dev/null || echo unknown)"
  info "更新請執行：npm install -g $PKG@latest"
  exit 0
fi

# Need npm
if ! command -v npm >/dev/null 2>&1; then
  err "找不到 npm。請先安裝 Node.js 18+（https://nodejs.org），再重跑本指令。"
  err "或用 npx 免安裝執行：npx $PKG search \"查詢\""
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "需要 Node.js 18 以上（目前 $(node -v 2>/dev/null)）。請升級後重跑。"
  exit 1
fi

info "透過 npm 安裝 $PKG …"
if npm install -g "$PKG"; then
  ok "安裝完成！"
else
  err "全域安裝失敗（可能需要 sudo 或調整 npm prefix）。"
  err "替代方案：npx $PKG search \"查詢\""
  exit 1
fi

printf '\n'
ok "$($BIN --version 2>/dev/null || echo installed) 已就緒"
printf '\n下一步：\n'
printf '  1. 到 %s 取得 API 金鑰\n' "$(bold 'https://kaiwu.dev/dashboard')"
printf '  2. %s\n' "$(bold 'kw login')"
printf '  3. %s\n\n' "$(bold 'kw search \"台灣 AI 政策\"')"
