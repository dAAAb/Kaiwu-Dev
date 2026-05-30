#!/usr/bin/env node
// ---------------------------------------------------------------------------
// 開物 Kaiwu CLI (kw) — Chinese-world AI search from your terminal.
// Zero dependencies. Requires Node 18+ (global fetch).
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const VERSION = '0.1.0'
const DEFAULT_BASE_URL = 'https://kaiwu.dev'
const CONFIG_DIR = join(homedir(), '.kaiwu')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

// --- tiny ANSI helpers (auto-disabled when not a TTY or NO_COLOR set) -------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`)
const amber = c('38;5;214')
const bold = c('1')
const dim = c('2')
const red = c('31')
const green = c('32')
const cyan = c('36')

function die(msg, code = 1) {
  process.stderr.write(red('✗ ') + msg + '\n')
  process.exit(code)
}

// --- config ----------------------------------------------------------------
function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch {}
  return {}
}

function saveConfig(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2))
  try { chmodSync(CONFIG_PATH, 0o600) } catch {}
}

function getApiKey(cfg) {
  return process.env.KAIWU_API_KEY || cfg.api_key || null
}

function getBaseUrl(cfg) {
  return (process.env.KAIWU_API_URL || cfg.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

// --- arg parsing ------------------------------------------------------------
// Returns { _: [positional], flag: value | true }. Supports --flag val,
// --flag=val, and short -o val. Unknown flags are kept as-is.
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { out._.push(...argv.slice(i + 1)); break }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('-')) out[key] = true
      else { out[key] = next; i++ }
    } else if (a.startsWith('-') && a.length > 1 && a !== '-') {
      const key = a.slice(1)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('-')) out[key] = true
      else { out[key] = next; i++ }
    } else {
      out._.push(a)
    }
  }
  return out
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    if (hidden) {
      const onData = (char) => {
        char = char.toString()
        if (char === '\n' || char === '\r' || char === '') process.stdout.write('\n')
        else process.stdout.write('\x1b[2K\x1b[200D' + question + '*'.repeat(rl.line.length))
      }
      process.stdin.on('data', onData)
      rl.question(question, (ans) => { process.stdin.removeListener('data', onData); rl.close(); resolve(ans.trim()) })
    } else {
      rl.question(question, (ans) => { rl.close(); resolve(ans.trim()) })
    }
  })
}

// --- API call ---------------------------------------------------------------
async function apiCall(cfg, method, path, body) {
  const apiKey = getApiKey(cfg)
  if (!apiKey) {
    die('尚未登入。執行 ' + bold('kw login') + ' 或設定環境變數 ' + bold('KAIWU_API_KEY') + '。')
  }
  const url = getBaseUrl(cfg) + path
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `kaiwu-cli/${VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    die(`無法連線到 ${url}：${e.message}`)
  }
  let data
  try { data = await res.json() } catch { data = null }
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`
    die(`${msg}${data?.credits_remaining !== undefined ? dim(` (剩餘額度 ${data.credits_remaining})`) : ''}`, res.status === 401 ? 2 : 1)
  }
  return data
}

function output(data, args) {
  const json = JSON.stringify(data, null, 2)
  if (args.o || args.output) {
    const file = args.o || args.output
    writeFileSync(file, json)
    process.stderr.write(green('✓ ') + `已儲存至 ${file}\n`)
    return
  }
  process.stdout.write(json + '\n')
}

// --- commands ---------------------------------------------------------------
async function cmdLogin(args) {
  const cfg = loadConfig()
  let key = args._[0]
  if (!key) {
    process.stdout.write(dim('在 https://kaiwu.dev/dashboard 取得 API 金鑰（kw_...）\n'))
    key = await prompt('API 金鑰: ', { hidden: true })
  }
  if (!key || !key.startsWith('kw_')) {
    die('金鑰格式不正確，應以 kw_ 開頭。')
  }
  cfg.api_key = key
  saveConfig(cfg)
  // Verify by checking credits
  try {
    const data = await apiCall(cfg, 'GET', '/v1/credits')
    process.stdout.write(green('✓ ') + `登入成功！剩餘額度 ${bold(data.credits_remaining)} / ${data.monthly_credits}\n`)
    process.stdout.write(dim(`金鑰已儲存至 ${CONFIG_PATH}\n`))
  } catch {
    process.stdout.write(green('✓ ') + `金鑰已儲存至 ${CONFIG_PATH}\n`)
  }
}

async function cmdLogout() {
  const cfg = loadConfig()
  delete cfg.api_key
  saveConfig(cfg)
  process.stdout.write(green('✓ ') + '已登出（金鑰已從設定移除）。\n')
}

async function cmdSearch(args) {
  const cfg = loadConfig()
  let query = args._.join(' ').trim()
  if (query === '-' || (!query && !process.stdin.isTTY)) query = await readStdin()
  if (!query) die('缺少搜尋查詢。用法：kw search "你的查詢"')
  if (query.length > 400) process.stderr.write(dim('⚠ 查詢偏長（>400 字），建議拆成關鍵詞。\n'))

  const depth = args.depth || args.d
  const body = { query }
  if (depth === 'advanced' || args.advanced) body.search_depth = 'advanced'
  else body.search_depth = 'basic'
  if (args['max-results'] || args.n) body.max_results = Number(args['max-results'] || args.n)
  if (args['time-range'] || args.t) body.time_range = args['time-range'] || args.t
  if (args.lang || args.l) body.lang = args.lang || args.l
  if (args.answer || args.a) body.include_answer = true

  const data = await apiCall(cfg, 'POST', '/v1/search', body)

  if (args.json) return output(data, args)
  // Pretty (human) output
  if (data.answer) {
    process.stdout.write('\n' + amber('▌ 答案') + '\n' + data.answer + '\n')
  }
  process.stdout.write('\n' + amber(`▌ ${data.results.length} 筆結果`) + dim(` · ${data.search_depth} · 剩餘 ${data.credits_remaining} 額度`) + '\n\n')
  data.results.forEach((r, i) => {
    process.stdout.write(bold(`${i + 1}. ${r.title}`) + '\n')
    process.stdout.write(cyan(r.url) + '\n')
    const text = r.content || r.snippet || ''
    if (text) process.stdout.write(dim(text.slice(0, 300)) + '\n')
    process.stdout.write('\n')
  })
}

async function cmdExtract(args) {
  const cfg = loadConfig()
  let urls = args._.filter(Boolean)
  if ((urls.length === 1 && urls[0] === '-') || (urls.length === 0 && !process.stdin.isTTY)) {
    const stdin = await readStdin()
    urls = stdin.split(/[\s,]+/).filter(Boolean)
  }
  if (urls.length === 0) die('缺少 URL。用法：kw extract <url> [url2 ...]')

  const body = { urls }
  if (args.format || args.f) body.format = args.format || args.f
  if (args.query || args.q) body.query = args.query || args.q

  const data = await apiCall(cfg, 'POST', '/v1/extract', body)

  if (args.json) return output(data, args)
  process.stdout.write('\n' + amber(`▌ ${data.success_count} 成功 / ${data.failed_count} 失敗`) + dim(` · 剩餘 ${data.credits_remaining} 額度`) + '\n\n')
  data.results.forEach((r) => {
    if (r.status === 'success') {
      process.stdout.write(bold(r.title || r.url) + '\n' + cyan(r.url) + dim(` · ${r.length} 字`) + '\n\n')
      process.stdout.write(r.content + '\n\n' + dim('─'.repeat(60)) + '\n\n')
    } else {
      process.stdout.write(red(`✗ ${r.url}`) + dim(` — ${r.error}`) + '\n\n')
    }
  })
}

async function cmdCredits(args) {
  const cfg = loadConfig()
  const data = await apiCall(cfg, 'GET', '/v1/credits')
  if (args.json) return output(data, args)
  process.stdout.write('\n' + amber('▌ 開物額度') + '\n')
  process.stdout.write(`  已用     ${bold(data.credits_used)}\n`)
  process.stdout.write(`  剩餘     ${bold(green(data.credits_remaining))}\n`)
  process.stdout.write(`  每月額度 ${data.monthly_credits}\n`)
  if (data.resets_at) process.stdout.write(dim(`  重置時間 ${data.resets_at}\n`))
  process.stdout.write('\n')
}

function cmdConfig(args) {
  const cfg = loadConfig()
  // kw config set base_url https://...
  if (args._[0] === 'set' && args._[1]) {
    const k = args._[1]
    const v = args._[2]
    if (!['base_url', 'api_key'].includes(k)) die(`未知設定鍵：${k}（可用：base_url, api_key）`)
    cfg[k] = v
    saveConfig(cfg)
    process.stdout.write(green('✓ ') + `已設定 ${k}\n`)
    return
  }
  process.stdout.write('\n' + amber('▌ 開物設定') + dim(` (${CONFIG_PATH})`) + '\n')
  const key = getApiKey(cfg)
  process.stdout.write(`  api_key   ${key ? dim(key.slice(0, 8) + '…' + key.slice(-4)) : red('（未設定）')}\n`)
  process.stdout.write(`  base_url  ${getBaseUrl(cfg)}\n`)
  if (process.env.KAIWU_API_KEY) process.stdout.write(dim('  ⚠ KAIWU_API_KEY 環境變數會覆蓋設定檔\n'))
  process.stdout.write('\n')
}

const HELP = `
${amber('開物 Kaiwu CLI')} ${dim('v' + VERSION)} — 中文世界的 AI 搜尋，就在你的終端機

${bold('用法')}
  kw <command> [options]

${bold('指令')}
  ${cyan('login')} [key]            儲存 API 金鑰（互動式或直接給）
  ${cyan('logout')}                 移除已儲存的金鑰
  ${cyan('search')} <query>         搜尋中文網路
  ${cyan('extract')} <url...>       抓取網頁並轉成乾淨 markdown
  ${cyan('credits')}                查詢剩餘額度
  ${cyan('config')} [set k v]       顯示 / 修改設定

${bold('search 選項')}
  --depth, -d <basic|advanced>   搜尋深度（advanced 會抓網頁 + 語意摘要）
  --max-results, -n <0-20>       結果數量（預設 5）
  --time-range, -t <day|week|month|year>
  --lang, -l <zh-TW|zh-CN|en>    語言（預設 zh-TW）
  --answer, -a                   生成 AI 綜合答案（+1 額度）
  --json                         輸出 JSON
  -o, --output <file>            存到檔案

${bold('extract 選項')}
  --format, -f <markdown|text>   輸出格式（預設 markdown）
  --query, -q <text>             只保留與查詢相關的內容（+1 額度）
  --json                         輸出 JSON
  -o, --output <file>            存到檔案

${bold('環境變數')}
  KAIWU_API_KEY    覆蓋已儲存的金鑰
  KAIWU_API_URL    自訂 API 端點（預設 ${DEFAULT_BASE_URL}）
  NO_COLOR         關閉彩色輸出

${bold('範例')}
  kw login
  kw search "台灣 AI 基本法草案重點" --depth advanced --answer
  echo "量子電腦" | kw search - --json
  kw extract https://example.com/article -q "API 認證"
  kw credits

${dim('文件：https://kaiwu.dev/cli  ·  GitHub：github.com/dAAAb/Kaiwu-Dev')}
`

// --- main -------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const cmd = args._.shift()

  if (args.version || args.v || cmd === 'version') { process.stdout.write(VERSION + '\n'); return }
  if (!cmd || cmd === 'help' || args.help || args.h) { process.stdout.write(HELP); return }

  switch (cmd) {
    case 'login': return cmdLogin(args)
    case 'logout': return cmdLogout(args)
    case 'search': case 's': return cmdSearch(args)
    case 'extract': case 'e': return cmdExtract(args)
    case 'credits': case 'c': return cmdCredits(args)
    case 'config': return cmdConfig(args)
    default:
      die(`未知指令：${cmd}\n執行 ${bold('kw help')} 查看用法。`)
  }
}

main().catch((e) => die(e?.message || String(e)))
