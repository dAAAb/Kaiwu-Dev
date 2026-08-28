import { useState } from 'react'
import type { ApiKey } from '../pages/Dashboard'
import { Icon } from './Icons'
import { copyText } from './Sidebar'

type Mode = 'search' | 'extract'

interface RunMeta {
  status: number
  ms: number
  creditsRemaining?: number
}

const MAX_URLS = 20

export default function Playground({ apiKeys }: { apiKeys: ApiKey[] }) {
  const activeKeys = apiKeys.filter((k) => !k.revoked)

  const [mode, setMode] = useState<Mode>('search')
  const [selectedKeyId, setSelectedKeyId] = useState(activeKeys[0]?.id || '')

  // /v1/search
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState('zh-TW')
  // Raw string so the field can be cleared / retyped; clamped on blur + submit.
  const [maxResults, setMaxResults] = useState('5')
  const maxResultsValue = Math.max(1, Math.min(20, Number(maxResults) || 5))
  const [searchDepth, setSearchDepth] = useState<'basic' | 'advanced'>('basic')
  const [includeAnswer, setIncludeAnswer] = useState(false)

  // /v1/extract
  const [urlsText, setUrlsText] = useState('')
  const [format, setFormat] = useState<'markdown' | 'text'>('markdown')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [meta, setMeta] = useState<RunMeta | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedKey = activeKeys.find((k) => k.id === selectedKeyId)
  // The API authenticates on the full key (`key_prefix = ? AND key_hash = ?`);
  // a bare prefix is rejected with 401. /api/auth/callback returns full_key
  // for every active key, but if it is ever missing the key is unusable here.
  const bearer = selectedKey?.full_key || ''
  const keyUnavailable = !!selectedKey && !selectedKey.full_key

  const urls = urlsText
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const searchCredits = 1 + (searchDepth === 'advanced' ? 1 : 0) + (includeAnswer ? 1 : 0)
  const extractCredits = Math.min(urls.length, MAX_URLS)

  const canRun =
    !loading && !!bearer && (mode === 'search' ? query.trim().length > 0 : urls.length > 0 && urls.length <= MAX_URLS)

  const run = async () => {
    if (!canRun) return
    setLoading(true)
    setResult(null)
    setMeta(null)
    setCopied(false)
    const t0 = performance.now()
    try {
      const endpoint = mode === 'search' ? '/v1/search' : '/v1/extract'
      const body =
        mode === 'search'
          ? { query: query.trim(), lang, max_results: maxResultsValue, search_depth: searchDepth, include_answer: includeAnswer }
          : { urls, format }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let data: unknown = text
      try {
        data = JSON.parse(text)
      } catch {
        /* non-JSON body — show raw */
      }
      const creditsRemaining =
        data && typeof data === 'object' && typeof (data as any).credits_remaining === 'number'
          ? ((data as any).credits_remaining as number)
          : undefined
      setResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
      setMeta({ status: res.status, ms: Math.round(performance.now() - t0), creditsRemaining })
    } catch (e: any) {
      setResult(JSON.stringify({ error: e?.message || String(e) }, null, 2))
      setMeta({ status: 0, ms: Math.round(performance.now() - t0) })
    } finally {
      setLoading(false)
    }
  }

  const copyResult = async () => {
    if (result && (await copyText(result))) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const statusBadge = (status: number) => {
    if (status === 0) return 'badge-danger'
    if (status < 300) return 'badge-success'
    if (status < 500) return 'badge-warning'
    return 'badge-danger'
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow mb-1">PLAYGROUND · 測試場</div>
        <h1 className="text-2xl font-bold text-fg">API 測試場</h1>
      </div>

      <form
        className="card mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          setMaxResults(String(maxResultsValue))
          run()
        }}
      >
        {/* Mode toggle */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="測試模式" className="inline-flex rounded-lg border border-line bg-surface-2 p-1">
            {(
              [
                { id: 'search', label: '搜尋 Search', icon: Icon.Search },
                { id: 'extract', label: '抓取 Extract', icon: Icon.Globe },
              ] as { id: Mode; label: string; icon: typeof Icon.Search }[]
            ).map((tab) => {
              const TabIcon = tab.icon
              const active = mode === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setMode(tab.id)
                    setResult(null)
                    setMeta(null)
                  }}
                  className={`btn btn-sm ${active ? 'bg-accent text-bg' : 'text-fg-muted hover:text-fg'}`}
                >
                  <TabIcon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>
          <code className="text-xs text-fg-subtle">POST {mode === 'search' ? '/v1/search' : '/v1/extract'}</code>
        </div>

        {mode === 'search' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="pg-query" className="field-label">
                搜尋查詢
              </label>
              <input
                id="pg-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例如：台灣 AI 基本法"
                className="input input-lg"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="pg-lang" className="field-label">
                  語言
                </label>
                <select id="pg-lang" value={lang} onChange={(e) => setLang(e.target.value)} className="select">
                  <option value="zh-TW">繁體中文</option>
                  <option value="zh-CN">簡體中文</option>
                  <option value="en">English</option>
                  <option value="auto">自動偵測</option>
                </select>
              </div>
              <div>
                <label htmlFor="pg-max" className="field-label">
                  最大結果數
                </label>
                <input
                  id="pg-max"
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  onBlur={() => setMaxResults(String(maxResultsValue))}
                  min={1}
                  max={20}
                  className="input"
                  inputMode="numeric"
                />
              </div>
              <div>
                <label htmlFor="pg-depth" className="field-label">
                  搜尋深度
                </label>
                <select
                  id="pg-depth"
                  value={searchDepth}
                  onChange={(e) => setSearchDepth(e.target.value as 'basic' | 'advanced')}
                  className="select"
                >
                  <option value="basic">basic · 快速摘要</option>
                  <option value="advanced">advanced · 全文＋語意摘要（+1 點）</option>
                </select>
              </div>
              <div>
                <label htmlFor="pg-key" className="field-label">
                  API 金鑰
                </label>
                <select id="pg-key" value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="select">
                  {activeKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.key_prefix}…)
                    </option>
                  ))}
                  {activeKeys.length === 0 && <option value="">尚無金鑰</option>}
                </select>
              </div>
            </div>
            <label htmlFor="pg-answer" className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
              <input
                id="pg-answer"
                type="checkbox"
                checked={includeAnswer}
                onChange={(e) => setIncludeAnswer(e.target.checked)}
                className="h-4 w-4 rounded border-line bg-surface-2 accent-[#f59e0b]"
              />
              根據結果生成綜合答案 <span className="text-fg-subtle">(include_answer，+1 點)</span>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="pg-urls" className="field-label">
                URL（每行一個，最多 {MAX_URLS} 個）
              </label>
              <textarea
                id="pg-urls"
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={'https://example.com/article\nhttps://example.com/another'}
                className="textarea input-mono text-sm"
                rows={5}
                spellCheck={false}
              />
              {urls.length > MAX_URLS && (
                <p className="field-hint text-danger">最多 {MAX_URLS} 個 URL，目前 {urls.length} 個。</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pg-format" className="field-label">
                  輸出格式
                </label>
                <select
                  id="pg-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'markdown' | 'text')}
                  className="select"
                >
                  <option value="markdown">markdown</option>
                  <option value="text">text（純文字）</option>
                </select>
              </div>
              <div>
                <label htmlFor="pg-key-x" className="field-label">
                  API 金鑰
                </label>
                <select id="pg-key-x" value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="select">
                  {activeKeys.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} ({k.key_prefix}…)
                    </option>
                  ))}
                  {activeKeys.length === 0 && <option value="">尚無金鑰</option>}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-xs text-fg-muted">
            <Icon.Credits size={15} className="mt-0.5 shrink-0 text-filament" />
            <span>
              {mode === 'search' ? (
                <>
                  本次預估消耗 <strong className="text-fg">{searchCredits}</strong> 點
                  <span className="text-fg-subtle">（基本 1 點；advanced +1；綜合答案 +1）</span>
                </>
              ) : (
                <>
                  本次預估消耗 <strong className="text-fg">{extractCredits}</strong> 點
                  <span className="text-fg-subtle">（每個 URL 1 點；抓取失敗不扣點）</span>
                </>
              )}
            </span>
          </p>
          <button type="submit" disabled={!canRun} className="btn btn-primary sm:min-w-[9rem]">
            {loading ? (
              '執行中…'
            ) : (
              <>
                <Icon.Play size={16} />
                {mode === 'search' ? '搜尋' : '抓取'}
              </>
            )}
          </button>
        </div>

        {activeKeys.length === 0 && (
          <p className="mt-3 flex items-start gap-2 text-xs text-warning">
            <Icon.Warning size={15} className="mt-0.5 shrink-0" />
            尚無可用金鑰，請先到「總覽」建立金鑰。
          </p>
        )}
        {keyUnavailable && (
          <p className="mt-3 flex items-start gap-2 text-xs text-warning">
            <Icon.Warning size={15} className="mt-0.5 shrink-0" />
            此金鑰無法顯示完整內容，無法在測試場使用；請到「總覽」建立新金鑰。
          </p>
        )}
      </form>

      {/* Result */}
      {(loading || result !== null) && (
        <section className="code-panel" aria-live="polite" aria-busy={loading}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              <span className="font-medium text-fg-muted">回應</span>
              {meta && (
                <>
                  <span className={`badge ${statusBadge(meta.status)}`}>
                    {meta.status === 0 ? '網路錯誤' : `HTTP ${meta.status}`}
                  </span>
                  <span className="tabular-nums">{meta.ms} ms</span>
                  {meta.creditsRemaining !== undefined && (
                    <span className="tabular-nums">剩餘 {meta.creditsRemaining.toLocaleString()} 點</span>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={copyResult}
              disabled={!result}
              className="btn btn-ghost btn-sm"
              aria-label="複製回應 JSON"
            >
              {copied ? <Icon.Check size={14} className="text-success" /> : <Icon.Copy size={14} />}
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          {loading ? (
            <div className="space-y-2 p-5">
              <div className="skeleton h-3 w-1/3" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ) : (
            <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words text-fg" tabIndex={0}>
              <code>{result}</code>
            </pre>
          )}
        </section>
      )}
    </div>
  )
}
