#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# 開物 Kaiwu CLI installer — installs @kaiwu/cli (the `kw` command) via npm.
#   curl -fsSL https://kaiwu.dev/install.sh | bash
# Nothing is downloaded or executed here except `npm install -g @kaiwu/cli`.
# No npm? Run without installing:  npx @kaiwu/cli search "查詢" --json
# ---------------------------------------------------------------------------
set -euo pipefail

PKG="@kaiwu/cli"
BIN="kw"

bold()  { printf '\033[1m%s\033[0m' "$1"; }
amber() { printf '\033[38;5;214m%s\033[0m' "$1"; }
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
info()  { printf '%s %s\n' "$(amber '▌')" "$1"; }
ok()    { printf '%s %s\n' "$(green '✓')" "$1"; }
err()   { printf '%s %s\n' "$(red '✗')" "$1" >&2; }
npx_hint() { err "免安裝替代方案：npx $PKG search \"查詢\" --json"; }

main() {
  printf '\n%s — 中文世界的 AI 搜尋\n' "$(amber '開物 Kaiwu CLI')"
  printf '%s\n\n' "$(bold 'https://kaiwu.dev/cli')"

  if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    err "找不到 npm / node。請先安裝 Node.js 18+（https://nodejs.org），再重跑本指令。"
    exit 1
  fi

  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${node_major:-0}" -lt 18 ]; then
    err "需要 Node.js 18 以上（目前 $(node -v 2>/dev/null || echo unknown)）。請升級後重跑。"
    exit 1
  fi

  if command -v "${BIN}" >/dev/null 2>&1; then
    info "已安裝 ${BIN} $("${BIN}" --version 2>/dev/null || echo '?')，更新至最新版 …"
  else
    info "透過 npm 安裝 $PKG …"
  fi

  if ! npm install -g "$PKG@latest"; then
    err "全域安裝失敗。常見原因：npm 全域目錄需要權限（試試 sudo，或設定 npm prefix 到使用者目錄）。"
    npx_hint
    exit 1
  fi

  printf '\n'
  if command -v "${BIN}" >/dev/null 2>&1; then
    ok "${BIN} $("${BIN}" --version 2>/dev/null || echo '') 已就緒"
  else
    ok "安裝完成，但目前的 shell 找不到 ${BIN}。"
    info "請把 $(npm prefix -g 2>/dev/null || echo '<npm prefix>')/bin 加進 PATH，或重開終端機。"
  fi
  printf '\n下一步：\n'
  printf '  1. 到 %s 取得 API 金鑰\n' "$(bold 'https://kaiwu.dev/dashboard')"
  printf '  2. %s\n' "$(bold 'kw login')"
  printf '  3. %s\n' "$(bold 'kw search "台灣 AI 政策" --json')"
  printf '\n免安裝也可以：%s\n\n' "$(bold "npx $PKG search \"查詢\" --json")"
}

main "$@"
