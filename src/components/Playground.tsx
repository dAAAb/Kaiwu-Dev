import { useState } from 'react'
import type { ApiKey } from '../pages/Dashboard'

export default function Playground({ apiKeys }: { apiKeys: ApiKey[] }) {
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState('zh-TW')
  const [maxResults, setMaxResults] = useState(5)
  const [selectedKey, setSelectedKey] = useState(apiKeys[0]?.key_prefix || '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${selectedKey}`,
        },
        body: JSON.stringify({ query, lang, max_results: maxResults }),
      })
      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (e: any) {
      setResult(JSON.stringify({ error: e.message }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">API 測試場</h1>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1">搜尋查詢</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：台灣 AI 基本法"
              className="w-full bg-bg border border-border rounded-lg px-4 py-3 text-white outline-none focus:border-accent"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted block mb-1">語言</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-accent"
              >
                <option value="zh-TW">繁體中文</option>
                <option value="zh-CN">簡體中文</option>
                <option value="en">English</option>
                <option value="auto">自動偵測</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">最大結果數</label>
              <input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                min={1}
                max={20}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1">API 金鑰</label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white outline-none focus:border-accent"
              >
                {apiKeys.filter(k => !k.revoked).map((k) => (
                  <option key={k.id} value={k.key_prefix}>{k.name} ({k.key_prefix}...)</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-accent text-bg px-6 py-3 rounded-lg font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {loading ? '搜尋中...' : '🔍 搜尋'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-muted mb-3">回應結果</h3>
          <pre className="bg-bg rounded-xl p-4 text-sm font-mono text-green-400 overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
