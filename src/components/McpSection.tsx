import { useState } from 'react'
import type { ApiKey } from '../pages/Dashboard'

export default function McpSection({ apiKeys }: { apiKeys: ApiKey[] }) {
  const activeKeys = apiKeys.filter(k => !k.revoked)
  const [selectedKeyId, setSelectedKeyId] = useState(activeKeys[0]?.id || '')
  const [mcpUrl, setMcpUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedKey = activeKeys.find(k => k.id === selectedKeyId)

  const generateMcpUrl = () => {
    if (!selectedKey) return
    const fullKey = selectedKey.full_key || selectedKey.key_prefix
    const url = `https://kaiwu.dev/mcp?apiKey=${fullKey}`
    setMcpUrl(url)
    setCopied(false)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">開物 MCP</h1>

      {/* What is MCP */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">什麼是 MCP？</h2>
        <p className="text-muted text-sm leading-relaxed mb-4">
          Model Context Protocol (MCP) 是一個開放標準，讓 AI 助手（如 Claude、Cursor、OpenClaw）
          可以直接連接外部工具。產生一個 MCP 連結，貼到你的 AI 工具設定中，就能讓 AI 直接使用開物搜尋。
        </p>
        <div className="flex gap-3">
          <a
            href="https://modelcontextprotocol.io/"
            target="_blank"
            rel="noreferrer"
            className="text-accent text-sm hover:underline"
          >
            了解 MCP →
          </a>
        </div>
      </div>

      {/* Remote MCP */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">遠端 MCP</h2>
        <p className="text-muted text-sm mb-4">
          選擇一把 API 金鑰，產生可分享的 MCP 連結。
        </p>

        <div className="flex gap-3 items-end mb-4">
          <div className="flex-1">
            <label className="text-sm text-muted block mb-1">選擇 API 金鑰</label>
            <select
              value={selectedKeyId}
              onChange={(e) => { setSelectedKeyId(e.target.value); setMcpUrl(null) }}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-accent"
            >
              {activeKeys.map((k) => (
                <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}...)</option>
              ))}
              {activeKeys.length === 0 && <option value="">尚無金鑰</option>}
            </select>
          </div>
          <button
            onClick={generateMcpUrl}
            disabled={!selectedKeyId}
            className="px-6 py-2.5 bg-accent text-bg rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            產生 MCP 連結
          </button>
        </div>

        {mcpUrl && (
          <div className="bg-bg rounded-xl p-4 border border-accent/30">
            <div className="text-xs text-muted mb-2">MCP 連結</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-accent break-all">{mcpUrl}</code>
              <button
                onClick={() => copyToClipboard(mcpUrl)}
                className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm hover:bg-accent/20 transition-colors whitespace-nowrap"
              >
                {copied ? '✅ 已複製' : '複製'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Local MCP (npx) */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">本地 MCP（Claude Desktop / Cursor）</h2>
        <p className="text-muted text-sm mb-4">
          在你的 AI 工具設定檔中加入以下設定：
        </p>
        <pre className="bg-bg rounded-xl p-4 text-sm font-mono text-green-400 overflow-x-auto">
{`{
  "mcpServers": {
    "kaiwu": {
      "command": "npx",
      "args": ["kaiwu-mcp"],
      "env": {
        "KAIWU_API_KEY": "${selectedKey?.full_key || selectedKey?.key_prefix || 'kw_你的金鑰'}"
      }
    }
  }
}`}
        </pre>
        <p className="text-muted text-xs mt-3">
          即將推出 <code className="text-accent">kaiwu-mcp</code> npm 套件。
        </p>
      </div>
    </div>
  )
}
