import { useId, useRef, useState } from 'react'
import { Icon } from './Icons'
import { track } from '../lib/track'

/**
 * The shortest possible "get started" surface for 開物：a prompt to hand to any
 * agent, the one API call, and the install one-liners.
 */
export const AGENT_PROMPT =
  '請幫我接上開物 Kaiwu（中文世界的 AI 搜尋 API）：讀 https://kaiwu.dev/llms.txt，用 KAIWU_API_KEY 環境變數呼叫 POST https://kaiwu.dev/v1/search（Authorization: Bearer），之後遇到需要查中文資料時就用它，並回報你查到的第一筆結果。'

const CALL = `curl -s https://kaiwu.dev/v1/search \\
  -H "Authorization: Bearer $KAIWU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"台灣 AI 基本法 草案 重點","search_depth":"advanced","include_answer":true}'`

const INSTALL = `npx skills add dAAAb/Kaiwu-Dev --all        # Claude Code / Cursor skills
npm i -g @kaiwu/cli && kw login                 # CLI：kw search "…" --answer
claude mcp add --transport http kaiwu https://kaiwu.dev/mcp \\
  --header "Authorization: Bearer $KAIWU_API_KEY"   # MCP`

type TabKey = 'prompt' | 'call' | 'install'
const TABS: { k: TabKey; label: string; text: string; copyLabel: string }[] = [
  { k: 'prompt', label: '給 agent 的 prompt', text: AGENT_PROMPT, copyLabel: '複製 prompt' },
  { k: 'call', label: '一個 API call', text: CALL, copyLabel: '複製' },
  { k: 'install', label: '安裝', text: INSTALL, copyLabel: '複製' },
]

export default function AgentQuickstart({ compact = false, defaultTab = 'prompt' }: { compact?: boolean; defaultTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(defaultTab)
  const [copied, setCopied] = useState(false)
  const id = useId()
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const current = TABS.find((t) => t.k === tab)!

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.k === tab)
    let next = i
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    setTab(TABS[next].k)
    refs.current[TABS[next].k]?.focus()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.text)
      setCopied(true)
      track('code_copy', { lang: tab })
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="code-panel">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-line bg-surface-2/60">
        <div role="tablist" aria-label="開始使用的方式" className="flex items-center gap-1 flex-wrap" onKeyDown={onKeyDown}>
          {TABS.filter((t) => !compact || t.k === 'prompt').map((t) => (
            <button
              key={t.k}
              type="button"
              role="tab"
              id={`${id}-tab-${t.k}`}
              aria-selected={tab === t.k}
              aria-controls={`${id}-panel`}
              tabIndex={tab === t.k ? 0 : -1}
              ref={(el) => { refs.current[t.k] = el }}
              onClick={() => setTab(t.k)}
              className={`btn btn-sm ${tab === t.k ? 'bg-surface text-fg border border-line' : 'btn-ghost'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={copy}>
          {copied ? <Icon.Check size={14} /> : <Icon.Copy size={14} />}
          {copied ? '已複製' : current.copyLabel}
        </button>
        <span role="status" aria-live="polite" className="sr-only">{copied ? '已複製到剪貼簿' : ''}</span>
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'prompt' ? (
          <div className="p-5">
            <p className="font-mono text-[14px] leading-7 text-fg whitespace-pre-wrap">{AGENT_PROMPT}</p>
            <p className="mt-4 text-xs text-fg-subtle">
              貼給 Claude Code、Cursor、OpenClaw 或任何會讀網址的 agent。金鑰在 <a href="/dashboard" className="link">儀表板</a> 免費取得（限時免費，每月 1,000 額度）。
            </p>
          </div>
        ) : tab === 'call' ? (
          <div className="p-5">
            <pre tabIndex={0} className="!p-0 !text-[13px]"><code className="font-mono whitespace-pre">{CALL}</code></pre>
            <p className="mt-4 text-xs text-fg-subtle">
              回傳 <span className="font-mono text-fg">results[]</span>（title / url / snippet / content）與可選的 <span className="font-mono text-fg">answer</span>。basic 1 額度、advanced 2、+answer 再 +1。完整規格見 <a href="/developers" className="link">開發者文件</a>。
            </p>
          </div>
        ) : (
          <div className="p-5">
            <pre tabIndex={0} className="!p-0 !text-[12.5px]"><code className="font-mono whitespace-pre">{INSTALL}</code></pre>
            <p className="mt-4 text-xs text-fg-subtle">
              <a href="/cli" className="link">CLI & Skills 說明</a> · <a href="/developers#mcp" className="link">MCP 設定</a> · <a href="https://www.npmjs.com/package/@kaiwu/cli" target="_blank" rel="noopener noreferrer" className="link">@kaiwu/cli on npm</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
