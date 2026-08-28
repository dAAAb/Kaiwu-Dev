import { useState } from 'react'
import type { ApiKey } from '../pages/Dashboard'
import { Icon } from './Icons'
import { copyText } from './Sidebar'

const MCP_URL = 'https://kaiwu.dev/mcp'
const PLACEHOLDER_KEY = 'kw_你的金鑰'

const TOOLS = [
  { name: 'kaiwu_search', desc: '搜尋中文網頁：繁簡自動擴展、多引擎聚合、可選語意摘要與綜合答案。' },
  { name: 'kaiwu_extract', desc: '把一或多個 URL 抓成乾淨的 markdown / 純文字，自動去除導覽、廣告。' },
]

function CodeBlock({
  label,
  code,
  copyId,
  copiedId,
  onCopy,
  wrap = false,
  disabled = false,
}: {
  label: string
  code: string
  copyId: string
  copiedId: string | null
  onCopy: (text: string, id: string) => void
  wrap?: boolean
  /** True when the selected key has no full_key — the snippet cannot authenticate. */
  disabled?: boolean
}) {
  const copied = copiedId === copyId
  return (
    <div className="code-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
        <span className="text-xs text-fg-subtle">{label}</span>
        <button
          type="button"
          onClick={() => onCopy(code, copyId)}
          disabled={disabled}
          className="btn btn-ghost btn-sm"
          aria-label={disabled ? `此金鑰無法顯示完整內容，無法複製 ${label}` : `複製 ${label}`}
          title={disabled ? '此金鑰無法顯示完整內容' : undefined}
        >
          {copied ? <Icon.Check size={14} className="text-success" /> : <Icon.Copy size={14} />}
          {copied ? '已複製' : '複製'}
        </button>
      </div>
      <pre className={wrap ? 'whitespace-pre-wrap break-all' : ''} tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function McpSection({ apiKeys }: { apiKeys: ApiKey[] }) {
  const activeKeys = apiKeys.filter((k) => !k.revoked)
  const [selectedKeyId, setSelectedKeyId] = useState(activeKeys[0]?.id || '')
  const [reveal, setReveal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const selectedKey = activeKeys.find((k) => k.id === selectedKeyId)
  // The API authenticates on the full key (`key_prefix = ? AND key_hash = ?`);
  // a prefix-only snippet can never authenticate, so never emit one. With no
  // key selected we show a template placeholder; with a key that lacks
  // full_key the snippets are disabled.
  const keyUnavailable = !!selectedKey && !selectedKey.full_key
  const realKey = selectedKey?.full_key || PLACEHOLDER_KEY
  // What is rendered on screen — copy always uses the real key.
  const shownKey = reveal || !selectedKey ? realKey : `${selectedKey.key_prefix}••••••••••••`

  const build = (key: string) => ({
    claudeCode: `claude mcp add --transport http kaiwu ${MCP_URL} --header "Authorization: Bearer ${key}"`,
    json: JSON.stringify(
      { mcpServers: { kaiwu: { url: MCP_URL, headers: { Authorization: `Bearer ${key}` } } } },
      null,
      2,
    ),
    url: `${MCP_URL}?apiKey=${key}`,
  })
  const real = build(realKey)
  const shown = build(shownKey)

  const copy = async (text: string, id: string) => {
    if (await copyText(text)) {
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow mb-1">MCP · 模型上下文協定</div>
        <h1 className="text-2xl font-bold text-fg">開物 MCP</h1>
      </div>

      {/* What is MCP */}
      <section className="card mb-6" aria-labelledby="mcp-what">
        <h2 id="mcp-what" className="mb-2 flex items-center gap-2 text-lg font-semibold text-fg">
          <Icon.Plug size={18} className="text-fg-muted" />
          什麼是 MCP？
        </h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          Model Context Protocol 是讓 AI 助手（Claude、Cursor、OpenClaw…）直接連接外部工具的開放標準。
          開物提供的是<strong className="text-fg">遠端 MCP 伺服器</strong>（Streamable HTTP），不需要安裝任何套件——
          把下面的設定貼進你的 AI 工具，就能直接使用開物搜尋。
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.name} className="card-inset">
              <code className="text-sm font-semibold text-accent">{t.name}</code>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">{t.desc}</p>
            </li>
          ))}
        </ul>
        <a
          href="https://modelcontextprotocol.io/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
        >
          了解 MCP
          <Icon.ExternalLink size={14} />
        </a>
      </section>

      {/* Key picker */}
      <section className="card mb-6" aria-labelledby="mcp-setup">
        <h2 id="mcp-setup" className="mb-1 text-lg font-semibold text-fg">
          連接設定
        </h2>
        <p className="mb-4 text-sm text-fg-muted">
          伺服器位址 <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg">{MCP_URL}</code>
          ，用 API 金鑰驗證（<code className="font-mono text-xs">Authorization: Bearer</code> header）。
        </p>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="mcp-key" className="field-label">
              使用的 API 金鑰
            </label>
            <select
              id="mcp-key"
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="select"
              disabled={activeKeys.length === 0}
            >
              {activeKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.key_prefix}…)
                </option>
              ))}
              {activeKeys.length === 0 && <option value="">尚無金鑰 — 請先到「總覽」建立</option>}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="btn btn-secondary"
            aria-pressed={reveal}
            disabled={!selectedKey}
          >
            {reveal ? <Icon.EyeOff size={16} /> : <Icon.Eye size={16} />}
            {reveal ? '隱藏金鑰' : '顯示金鑰'}
          </button>
        </div>

        {keyUnavailable && (
          <p className="mb-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-fg">
            <Icon.Warning size={15} className="mt-0.5 shrink-0 text-warning" />
            <span>此金鑰無法顯示完整內容，下方設定無法使用；請到「總覽」建立新金鑰後再回來。</span>
          </p>
        )}

        <div className="space-y-5">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon.Terminal size={16} className="text-fg-muted" />
              Claude Code
            </h3>
            <CodeBlock
              label="終端機執行一次"
              code={shown.claudeCode}
              copyId="cc"
              copiedId={copiedId}
              onCopy={() => copy(real.claudeCode, 'cc')}
              wrap
              disabled={keyUnavailable}
            />
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon.Settings size={16} className="text-fg-muted" />
              Cursor / 其他支援 Streamable HTTP 的客戶端
            </h3>
            <p className="mb-2 text-xs text-fg-muted">
              加到 <code className="font-mono">.cursor/mcp.json</code>（或該工具的 MCP 設定檔）：
            </p>
            <CodeBlock
              label="mcp.json"
              code={shown.json}
              copyId="json"
              copiedId={copiedId}
              onCopy={() => copy(real.json, 'json')}
              disabled={keyUnavailable}
            />
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon.Globe size={16} className="text-fg-muted" />
              Claude Desktop / 只能填網址的客戶端
            </h3>
            <p className="mb-2 text-xs text-fg-muted">
              Claude Desktop 的「自訂連接器」只能填一個 URL、無法加 header，請改用含金鑰的網址：
            </p>
            <CodeBlock
              label="MCP 網址（含 apiKey）"
              code={shown.url}
              copyId="url"
              copiedId={copiedId}
              onCopy={() => copy(real.url, 'url')}
              wrap
              disabled={keyUnavailable}
            />
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-fg">
              <Icon.Warning size={15} className="mt-0.5 shrink-0 text-warning" />
              <span>
                金鑰放在網址裡會被寫進代理、伺服器與客戶端的日誌。能用 header 的工具請優先用上面的方式；
                若這把金鑰外流，到「總覽」刪除並建立新的即可。
              </span>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
