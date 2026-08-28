#!/usr/bin/env node
// ---------------------------------------------------------------------------
// 開物 Kaiwu CLI (kw) — Chinese-world AI search from your terminal.
// Zero dependencies. Requires Node 18+ (global fetch, AbortSignal.timeout).
//
// Exit codes:
//   0  success
//   1  usage error / bad input / other 4xx / unexpected error
//   2  authentication (no key, 401, 403)
//   3  insufficient credits (429)
//   4  network failure, timeout, or server error (5xx)
//   130 cancelled with Ctrl-C
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

const PKG = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
const VERSION = PKG.version
const DEFAULT_BASE_URL = 'https://kaiwu.dev'
const CONFIG_DIR = join(homedir(), '.kaiwu')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')
const TIMEOUT_MS = Math.max(1, Number(process.env.KAIWU_TIMEOUT) || 120) * 1000
const KEY_RE = /^kw_[A-Za-z0-9_-]{16,}$/

const EXIT = { OK: 0, ERROR: 1, AUTH: 2, CREDITS: 3, NETWORK: 4, CANCEL: 130 }

// --- tiny ANSI helpers (auto-disabled when not a TTY or NO_COLOR set) -------
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const c = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`)
const amber = c('38;5;214')
const bold = c('1')
const dim = c('2')
const red = c('31')
const green = c('32')
const cyan = c('36')

// Don't crash with a stack trace when piped into `head` etc.
process.stdout.on('error', (e) => { if (e?.code === 'EPIPE') process.exit(0); throw e })

class CliError extends Error {
  constructor(message, code = EXIT.ERROR, { hint, ...extra } = {}) {
    super(message)
    this.code = code
    this.hint = hint
    this.extra = extra
  }
}
const die = (msg, code, opts) => { throw new CliError(msg, code, opts) }

let jsonMode = false

// --- config ----------------------------------------------------------------
function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) || {}
  } catch {}
  return {}
}

function saveConfig(cfg) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  try { chmodSync(CONFIG_PATH, 0o600) } catch {}
}

function getApiKey(cfg) {
  return process.env.KAIWU_API_KEY || cfg.api_key || null
}

function getBaseUrl(cfg) {
  return (process.env.KAIWU_API_URL || cfg.base_url || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function maskKey(key) {
  return key.length > 12 ? key.slice(0, 8) + '…' + key.slice(-4) : 'kw_…'
}

// --- arg parsing ------------------------------------------------------------
// Returns { _: [positional], flag: value | true }. Supports --flag val,
// --flag=val, short -o val, `--` terminator and `-` (stdin marker).
// Boolean flags never consume the next token, so `kw search --answer "查詢"` works.
const BOOL_FLAGS = new Set(['json', 'answer', 'a', 'advanced', 'help', 'h', 'version', 'v'])
const GLOBAL_FLAGS = new Set(['json', 'o', 'output', 'help', 'h', 'version', 'v'])
const COMMAND_FLAGS = {
  search: ['depth', 'd', 'max-results', 'n', 'time-range', 't', 'category', 'lang', 'l', 'answer', 'a', 'advanced'],
  extract: ['format', 'f', 'query', 'q'],
  login: [], logout: [], credits: [], config: [], help: [], version: [],
}

function parseArgs(argv) {
  const out = { _: [] }
  const isFlagToken = (t) => typeof t === 'string' && t.startsWith('-') && t.length > 1
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { out._.push(...argv.slice(i + 1)); break }
    if (isFlagToken(a)) {
      const long = a.startsWith('--')
      let key = a.slice(long ? 2 : 1)
      let val
      const eq = long ? key.indexOf('=') : -1
      if (eq !== -1) { val = key.slice(eq + 1); key = key.slice(0, eq) }
      else if (BOOL_FLAGS.has(key)) val = true
      else {
        const next = argv[i + 1]
        if (next === undefined || isFlagToken(next)) val = true
        else { val = next; i++ }
      }
      out[key] = val
    } else {
      out._.push(a)
    }
  }
  return out
}

function checkFlags(cmd, args) {
  const allowed = new Set([...GLOBAL_FLAGS, ...(COMMAND_FLAGS[cmd] || [])])
  const unknown = Object.keys(args).filter((k) => k !== '_' && !allowed.has(k))
  if (unknown.length) {
    die(`未知選項：${unknown.map((k) => (k.length === 1 ? '-' : '--') + k).join(', ')}`, EXIT.ERROR, { hint: `執行 kw help 查看 ${cmd} 的可用選項。` })
  }
}

function flag(args, long, short) {
  const v = args[long] !== undefined ? args[long] : args[short]
  return v === undefined ? undefined : v
}

function requireValue(name, v, choices) {
  if (v === undefined) return undefined
  if (v === true) die(`選項 ${name} 需要一個值。`)
  if (choices && !choices.includes(String(v))) die(`選項 ${name} 的值必須是 ${choices.join(' | ')}（收到 "${v}"）。`)
  return String(v)
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').trim()
}

// Secret prompt: input is not echoed. Only used when stdin is a TTY.
function promptSecret(question) {
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    rl._writeToOutput = (s) => { if (!muted) rl.output.write(s) }
    let done = false
    const finish = (fn) => { if (!done) { done = true; rl.close(); fn() } }
    rl.question(question, (ans) => { muted = false; process.stdout.write('\n'); finish(() => resolve(ans.trim())) })
    muted = true
    rl.on('close', () => finish(() => resolve('')))
    rl.on('SIGINT', () => { muted = false; process.stdout.write('\n'); finish(() => reject(new CliError('已取消。', EXIT.CANCEL))) })
  })
}

// --- API call ---------------------------------------------------------------
async function apiCall(cfg, method, path, body, { apiKey } = {}) {
  apiKey = apiKey || getApiKey(cfg)
  if (!apiKey) {
    die('尚未登入。執行 ' + bold('kw login') + ' 或設定環境變數 ' + bold('KAIWU_API_KEY') + '。', EXIT.AUTH,
      { hint: '到 https://kaiwu.dev/dashboard 取得 API 金鑰。' })
  }
  const url = getBaseUrl(cfg) + path
  let res
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': `kaiwu-cli/${VERSION} node/${process.versions.node}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const cause = e?.cause?.code || e?.cause?.message || e?.message || String(e)
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      die(`請求逾時（${TIMEOUT_MS / 1000} 秒）：${url}`, EXIT.NETWORK, { hint: '可用環境變數 KAIWU_TIMEOUT（秒）調整。' })
    }
    die(`無法連線到 ${url}：${cause}`, EXIT.NETWORK, { hint: '請確認網路連線，或用 kw config 檢查 base_url。' })
  }

  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch {}

  if (!res.ok) {
    const apiMsg = data && typeof data.error === 'string' ? data.error : null
    const extra = { status: res.status }
    if (data && typeof data === 'object') {
      if (data.credits_needed !== undefined) extra.credits_needed = data.credits_needed
      if (data.credits_remaining !== undefined) extra.credits_remaining = data.credits_remaining
    }
    if (res.status === 401 || res.status === 403) {
      die(`${apiMsg || '無效的 API 金鑰'} (HTTP ${res.status})`, EXIT.AUTH,
        { ...extra, hint: '執行 kw login 重新登入，或檢查 KAIWU_API_KEY 是否正確。' })
    }
    if (res.status === 429) {
      const detail = extra.credits_needed !== undefined ? `需要 ${extra.credits_needed}，剩餘 ${extra.credits_remaining ?? '?'}` : ''
      die(`${apiMsg || '額度不足'}${detail ? `（${detail}）` : ''} (HTTP 429)`, EXIT.CREDITS,
        { ...extra, hint: '執行 kw credits 查看重置時間；或改用 --depth basic、減少 --max-results。' })
    }
    if (res.status >= 500) {
      die(`伺服器錯誤 (HTTP ${res.status})：${apiMsg || res.statusText || '無回應內容'}`, EXIT.NETWORK,
        { ...extra, hint: '通常是暫時性問題，請稍後重試。' })
    }
    const snippet = apiMsg || (text ? text.replace(/\s+/g, ' ').slice(0, 200) : res.statusText)
    die(`HTTP ${res.status}：${snippet}`, EXIT.ERROR, extra)
  }

  if (data === null || typeof data !== 'object') {
    die(`API 回應不是 JSON（HTTP ${res.status}，${url}）`, EXIT.NETWORK,
      { hint: 'base_url 可能指向了網頁而非 API；用 kw config 檢查。' })
  }
  return data
}

function outputTarget(args) {
  const file = flag(args, 'output', 'o')
  if (file === undefined) return null
  if (file === true || !String(file).trim()) die('選項 -o/--output 需要檔案路徑。')
  return String(file)
}

function output(data, args) {
  const json = JSON.stringify(data, null, 2)
  const file = outputTarget(args)
  if (file) {
    writeFileSync(file, json + '\n')
    process.stderr.write(green('✓ ') + `已儲存至 ${file}\n`)
    return
  }
  process.stdout.write(json + '\n')
}

// --- commands ---------------------------------------------------------------
async function cmdLogin(args) {
  const cfg = loadConfig()
  let key = args._[0]
  let source = 'argument'
  if (!key) {
    if (process.stdin.isTTY) {
      process.stdout.write(dim('在 https://kaiwu.dev/dashboard 取得 API 金鑰（kw_...）\n'))
      key = await promptSecret('API 金鑰（輸入時不會顯示）: ')
      source = 'prompt'
    } else {
      key = (await readStdin()).split(/\r?\n/)[0]?.trim()
      source = 'stdin'
      if (!key && process.env.KAIWU_API_KEY) { key = process.env.KAIWU_API_KEY; source = 'env' }
    }
  }
  if (!key) {
    die('未提供金鑰。', EXIT.ERROR,
      { hint: '非互動環境請用 kw login <key>、echo "$KEY" | kw login，或設定 KAIWU_API_KEY。' })
  }
  if (!KEY_RE.test(key)) die('金鑰格式不正確，應為 kw_ 開頭的 API 金鑰。', EXIT.AUTH)

  // Verify before saving so an invalid key never lands in the config file.
  let verified = null
  try {
    verified = await apiCall(cfg, 'GET', '/v1/credits', undefined, { apiKey: key })
  } catch (e) {
    if (e instanceof CliError && e.code === EXIT.AUTH) {
      throw new CliError('金鑰驗證失敗，未儲存：' + e.message, EXIT.AUTH, { ...e.extra, hint: '請到 https://kaiwu.dev/dashboard 確認金鑰是否有效或已撤銷。' })
    }
    process.stderr.write(dim(`⚠ 無法驗證金鑰（${e.message}），仍會儲存。\n`))
  }
  cfg.api_key = key
  saveConfig(cfg)
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ ok: true, config_path: CONFIG_PATH, source, verified: Boolean(verified), ...(verified || {}) }) + '\n')
  } else if (verified) {
    process.stdout.write(green('✓ ') + `登入成功！剩餘額度 ${bold(verified.credits_remaining)} / ${verified.monthly_credits}\n`)
    process.stdout.write(dim(`金鑰已儲存至 ${CONFIG_PATH}\n`))
  } else {
    process.stdout.write(green('✓ ') + `金鑰已儲存至 ${CONFIG_PATH}\n`)
  }
  if (process.env.KAIWU_API_KEY && process.env.KAIWU_API_KEY !== key) {
    process.stderr.write(dim('⚠ 環境變數 KAIWU_API_KEY 已設定且與此金鑰不同，會優先於設定檔。\n'))
  }
}

async function cmdLogout() {
  const cfg = loadConfig()
  const had = Boolean(cfg.api_key)
  delete cfg.api_key
  saveConfig(cfg)
  if (jsonMode) return process.stdout.write(JSON.stringify({ ok: true, removed: had }) + '\n')
  process.stdout.write(green('✓ ') + (had ? '已登出（金鑰已從設定移除）。\n' : '設定檔中沒有金鑰。\n'))
  if (process.env.KAIWU_API_KEY) process.stderr.write(dim('⚠ 環境變數 KAIWU_API_KEY 仍然存在。\n'))
}

async function cmdSearch(args) {
  const cfg = loadConfig()
  let query = args._.join(' ').trim()
  if (query === '-' || (!query && !process.stdin.isTTY)) query = await readStdin()
  if (!query) die('缺少搜尋查詢。用法：kw search "你的查詢"')
  if (query.length > 400) process.stderr.write(dim('⚠ 查詢偏長（>400 字），建議拆成關鍵詞。\n'))

  const body = { query }
  const depth = requireValue('--depth', flag(args, 'depth', 'd'), ['basic', 'advanced'])
  body.search_depth = depth === 'advanced' || args.advanced ? 'advanced' : 'basic'

  const n = requireValue('--max-results', flag(args, 'max-results', 'n'))
  if (n !== undefined) {
    const num = Number(n)
    if (!Number.isInteger(num) || num < 1 || num > 20) die(`--max-results 必須是 1–20 的整數（收到 "${n}"）。`)
    body.max_results = num
  }
  const tr = requireValue('--time-range', flag(args, 'time-range', 't'), ['day', 'week', 'month', 'year', 'all'])
  if (tr) body.time_range = tr
  const cat = requireValue('--category', flag(args, 'category'), ['general', 'news', 'auto'])
  if (cat) body.category = cat
  const lang = requireValue('--lang', flag(args, 'lang', 'l'))
  if (lang) body.lang = lang
  if (args.answer || args.a) body.include_answer = true

  const data = await apiCall(cfg, 'POST', '/v1/search', body)

  if (jsonMode || outputTarget(args)) return output(data, args)
  // Pretty (human) output
  if (data.answer) {
    process.stdout.write('\n' + amber('▌ 答案') + '\n' + data.answer + '\n')
  }
  if (data.warning) {
    process.stdout.write('\n' + dim(data.warning) + '\n')
  }
  const results = Array.isArray(data.results) ? data.results : []
  process.stdout.write('\n' + amber(`▌ ${results.length} 筆結果`) + dim(` · ${data.search_depth} · 剩餘 ${data.credits_remaining} 額度`) + '\n\n')
  if (!results.length) process.stdout.write(dim('（沒有結果，試試更短的關鍵詞、指定 --category news，或放寬 --time-range）\n\n'))
  results.forEach((r, i) => {
    process.stdout.write(bold(`${i + 1}. ${r.title || '(無標題)'}`) + (r.published ? dim(`  ${r.published}`) : '') + '\n')
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
  if (urls.length > 20) die(`一次最多 20 個 URL（收到 ${urls.length} 個）。`)
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) die(`URL 必須以 http:// 或 https:// 開頭：${u}`)
  }

  const body = { urls }
  const format = requireValue('--format', flag(args, 'format', 'f'), ['markdown', 'text'])
  if (format) body.format = format
  const q = requireValue('--query', flag(args, 'query', 'q'))
  if (q) body.query = q

  const data = await apiCall(cfg, 'POST', '/v1/extract', body)

  if (jsonMode || outputTarget(args)) return output(data, args)
  const results = Array.isArray(data.results) ? data.results : []
  process.stdout.write('\n' + amber(`▌ ${data.success_count} 成功 / ${data.failed_count} 失敗`) + dim(` · 剩餘 ${data.credits_remaining} 額度`) + '\n\n')
  results.forEach((r) => {
    if (r.status === 'success') {
      process.stdout.write(bold(r.title || r.url) + '\n' + cyan(r.url) + dim(` · ${r.length} 字`) + '\n\n')
      process.stdout.write(r.content + '\n\n' + dim('─'.repeat(60)) + '\n\n')
    } else {
      process.stdout.write(red(`✗ ${r.url}`) + dim(` — ${r.error || 'failed'}`) + '\n\n')
    }
  })
}

async function cmdCredits(args) {
  const cfg = loadConfig()
  const data = await apiCall(cfg, 'GET', '/v1/credits')
  if (jsonMode || outputTarget(args)) return output(data, args)
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
  if (args._[0] === 'set') {
    const k = args._[1]
    const v = args._[2]
    if (!k || !['base_url', 'api_key'].includes(k)) die(`未知設定鍵：${k || '(空)'}（可用：base_url, api_key）`)
    if (v === undefined || !String(v).trim()) die(`用法：kw config set ${k} <value>`)
    if (k === 'base_url' && !/^https?:\/\//i.test(v)) die('base_url 必須以 http:// 或 https:// 開頭。')
    if (k === 'api_key' && !KEY_RE.test(v)) die('金鑰格式不正確，應為 kw_ 開頭的 API 金鑰。', EXIT.AUTH)
    cfg[k] = k === 'base_url' ? v.replace(/\/+$/, '') : v
    saveConfig(cfg)
    if (jsonMode) return process.stdout.write(JSON.stringify({ ok: true, key: k }) + '\n')
    process.stdout.write(green('✓ ') + `已設定 ${k}\n`)
    return
  }
  if (args._[0] === 'path') return process.stdout.write(CONFIG_PATH + '\n')
  const key = getApiKey(cfg)
  if (jsonMode) {
    return process.stdout.write(JSON.stringify({
      config_path: CONFIG_PATH,
      api_key: key ? maskKey(key) : null,
      api_key_source: process.env.KAIWU_API_KEY ? 'env' : cfg.api_key ? 'config' : null,
      base_url: getBaseUrl(cfg),
      base_url_source: process.env.KAIWU_API_URL ? 'env' : cfg.base_url ? 'config' : 'default',
    }) + '\n')
  }
  process.stdout.write('\n' + amber('▌ 開物設定') + dim(` (${CONFIG_PATH})`) + '\n')
  process.stdout.write(`  api_key   ${key ? dim(maskKey(key)) : red('（未設定）')}\n`)
  process.stdout.write(`  base_url  ${getBaseUrl(cfg)}\n`)
  if (process.env.KAIWU_API_KEY) process.stdout.write(dim('  ⚠ KAIWU_API_KEY 環境變數會覆蓋設定檔\n'))
  if (process.env.KAIWU_API_URL) process.stdout.write(dim('  ⚠ KAIWU_API_URL 環境變數會覆蓋設定檔\n'))
  process.stdout.write('\n')
}

const HELP = `
${amber('開物 Kaiwu CLI')} ${dim('v' + VERSION)} — 中文世界的 AI 搜尋，就在你的終端機

${bold('用法')}
  kw <command> [options]

${bold('指令')}
  ${cyan('login')} [key]            儲存 API 金鑰（互動式、直接給、或從 stdin / KAIWU_API_KEY）
  ${cyan('logout')}                 移除已儲存的金鑰
  ${cyan('search')} <query>         搜尋中文網路
  ${cyan('extract')} <url...>       抓取網頁並轉成乾淨 markdown
  ${cyan('credits')}                查詢剩餘額度
  ${cyan('config')} [set k v]       顯示 / 修改設定（config path 顯示設定檔位置）

${bold('search 選項')}
  --depth, -d <basic|advanced>   搜尋深度（advanced 會抓網頁 + 語意摘要，2 額度）
  --max-results, -n <1-20>       結果數量（預設 5）
  --time-range, -t <day|week|month|year|all>
                                 時間範圍（省略則依查詢推斷）
  --category <general|news|auto> 分類（預設 auto：時事走新聞）
  --lang, -l <zh-TW|zh-CN|en>    語言（預設 zh-TW）
  --answer, -a                   生成 AI 綜合答案（有結果時 +1 額度）

${bold('extract 選項')}
  --format, -f <markdown|text>   輸出格式（預設 markdown）
  --query, -q <text>             只保留與查詢相關的內容（+1 額度）

${bold('通用選項')}
  --json                         輸出 JSON（錯誤也以 JSON 輸出到 stdout）
  -o, --output <file>            將 JSON 結果存到檔案
  --version, -v                  顯示版本
  --help, -h                     顯示說明

${bold('環境變數')}
  KAIWU_API_KEY    覆蓋已儲存的金鑰
  KAIWU_API_URL    自訂 API 端點（預設 ${DEFAULT_BASE_URL}）
  KAIWU_TIMEOUT    請求逾時秒數（預設 120）
  NO_COLOR         關閉彩色輸出

${bold('結束碼')}
  0 成功 · 1 用法/輸入錯誤 · 2 認證失敗 · 3 額度不足 · 4 網路/伺服器錯誤

${bold('範例')}
  kw login
  kw search "台灣 AI 基本法草案重點" --depth advanced --answer
  echo "量子電腦" | kw search - --json
  kw extract https://example.com/article -q "API 認證"
  kw credits --json

${dim('文件：https://kaiwu.dev/cli  ·  API：https://kaiwu.dev/developers  ·  GitHub：github.com/dAAAb/Kaiwu-Dev')}
`

// --- main -------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const cmd = args._.shift()
  jsonMode = Boolean(args.json)

  if (args.version || args.v || cmd === 'version') { process.stdout.write(VERSION + '\n'); return }
  if (!cmd || cmd === 'help' || args.help || args.h) { process.stdout.write(HELP); return }

  const ALIASES = { s: 'search', e: 'extract', c: 'credits' }
  const name = ALIASES[cmd] || cmd
  if (!(name in COMMAND_FLAGS)) die(`未知指令：${cmd}`, EXIT.ERROR, { hint: '執行 kw help 查看用法。' })
  checkFlags(name, args)

  switch (name) {
    case 'login': return cmdLogin(args)
    case 'logout': return cmdLogout(args)
    case 'search': return cmdSearch(args)
    case 'extract': return cmdExtract(args)
    case 'credits': return cmdCredits(args)
    case 'config': return cmdConfig(args)
  }
}

main().catch((e) => {
  const code = e instanceof CliError ? e.code : EXIT.ERROR
  const message = e?.message || String(e)
  if (jsonMode) {
    process.stdout.write(JSON.stringify({ error: message, exit_code: code, ...(e?.extra || {}) }) + '\n')
  } else {
    process.stderr.write(red('✗ ') + message + '\n')
    if (e?.hint) process.stderr.write(dim('  ' + e.hint) + '\n')
    if (!(e instanceof CliError) && process.env.KAIWU_DEBUG) process.stderr.write(dim(String(e?.stack || '')) + '\n')
  }
  process.exitCode = code
})
