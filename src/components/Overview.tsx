import { useState } from 'react'
import type { ApiKey, UserInfo } from '../pages/Dashboard'

interface OverviewProps {
  userInfo: UserInfo | null
  apiKeys: ApiKey[]
  onCreateKey: (name: string) => Promise<(ApiKey & { full_key: string }) | null>
  onDeleteKey: (keyId: string) => Promise<void>
}

export default function Overview({ userInfo, apiKeys, onCreateKey, onDeleteKey }: OverviewProps) {
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [mcpCopied, setMcpCopied] = useState(false)

  const used = userInfo?.credits_used ?? 0
  const total = userInfo?.monthly_credits ?? 1000
  const pct = Math.min((used / total) * 100, 100)

  const activeKeys = apiKeys.filter(k => !k.revoked)
  const defaultKey = activeKeys[0]

  const handleCreate = async () => {
    setCreating(true)
    const result = await onCreateKey(newKeyName || 'default')
    if (result?.full_key) {
      setCreatedKey(result.full_key)
    }
    setNewKeyName('')
    setShowNewKey(false)
    setCreating(false)
  }

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text)
    if (id) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const mcpUrl = defaultKey ? `https://kaiwu.dev/mcp?apiKey=${defaultKey.full_key || defaultKey.key_prefix}` : ''

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">總覽</h1>

      {/* Plan Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-accent font-semibold text-lg">免費方案</span>
            <span className="ml-3 text-muted text-sm">Free Plan</span>
          </div>
          <span className="text-sm text-muted">
            {used.toLocaleString()} / {total.toLocaleString()} 點
          </span>
        </div>
        <div className="w-full bg-border rounded-full h-3">
          <div
            className="bg-accent rounded-full h-3 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-muted">
          API 使用量：已使用 {used.toLocaleString()} 點，共 {total.toLocaleString()} 點
        </div>
      </div>

      {/* Created key banner */}
      {createdKey && (
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 mb-6">
          <div className="text-green-400 text-sm font-semibold mb-1">✅ 金鑰已建立！請立即複製，此金鑰不會再次顯示。</div>
          <div className="flex items-center gap-2">
            <code className="bg-bg px-3 py-1.5 rounded text-sm font-mono text-green-300 flex-1 break-all">
              {createdKey}
            </code>
            <button
              onClick={() => { copyToClipboard(createdKey); setCreatedKey(null) }}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-sm transition-colors"
            >
              複製
            </button>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">API 金鑰</h2>
          <button
            onClick={() => setShowNewKey(true)}
            className="px-3 py-1.5 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors"
          >
            + 建立金鑰
          </button>
        </div>

        {showNewKey && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-bg rounded-xl">
            <input
              type="text"
              placeholder="金鑰名稱（選填）"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors"
            >
              {creating ? '建立中...' : '建立'}
            </button>
            <button
              onClick={() => setShowNewKey(false)}
              className="px-3 py-2 text-muted hover:text-white text-sm transition-colors"
            >
              取消
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-2 font-semibold">名稱</th>
                <th className="text-left py-3 px-2 font-semibold">類型</th>
                <th className="text-left py-3 px-2 font-semibold">用量</th>
                <th className="text-left py-3 px-2 font-semibold">金鑰</th>
                <th className="text-right py-3 px-2 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {activeKeys.map((key) => (
                <tr key={key.id} className="border-t border-border">
                  <td className="py-3 px-2 font-medium">{key.name}</td>
                  <td className="py-3 px-2">
                    <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">
                      {key.type === 'dev' ? '開發' : key.type}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted">{key.usage_count}</td>
                  <td className="py-3 px-2 font-mono text-xs">
                    {visibleKeys.has(key.id)
                      ? (key.full_key || key.key_prefix + '••••••••••••')
                      : key.key_prefix + '••••••••'}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="text-muted hover:text-white transition-colors text-xs"
                        title={visibleKeys.has(key.id) ? '隱藏' : '顯示'}
                      >
                        {visibleKeys.has(key.id) ? '🙈' : '👁'}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.full_key || key.key_prefix, key.id)}
                        className="text-muted hover:text-white transition-colors text-xs"
                        title="複製"
                      >
                        {copiedId === key.id ? '✅' : '📋'}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('確定要刪除此金鑰？')) onDeleteKey(key.id)
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors text-xs"
                        title="刪除"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeKeys.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    尚無 API 金鑰。點擊「+ 建立金鑰」來建立你的第一把金鑰。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MCP Quick Access */}
      {defaultKey && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔌</span>
            <h2 className="text-lg font-semibold">遠端 MCP</h2>
          </div>
          <p className="text-muted text-sm mb-4">
            將此連結貼到 Claude Desktop、Cursor 或 OpenClaw 的 MCP 設定中，即可讓 AI 使用開物搜尋。
          </p>
          <div className="bg-bg rounded-xl p-4 border border-accent/30">
            <div className="text-xs text-muted mb-2">MCP 連結（使用 {defaultKey.name} 金鑰）</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-accent break-all">{mcpUrl}</code>
              <button
                onClick={() => { copyToClipboard(mcpUrl); setMcpCopied(true); setTimeout(() => setMcpCopied(false), 2000) }}
                className="px-4 py-2 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                {mcpCopied ? '✅ 已複製' : '複製連結'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
