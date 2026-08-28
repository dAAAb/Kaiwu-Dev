import { useState } from 'react'
import type { ApiKey, UserInfo } from '../pages/Dashboard'
import { Icon } from './Icons'
import { copyText } from './Sidebar'

interface OverviewProps {
  userInfo: UserInfo | null
  apiKeys: ApiKey[]
  onCreateKey: (name: string) => Promise<(ApiKey & { full_key: string }) | null>
  onDeleteKey: (keyId: string) => Promise<void>
  /** SPA navigation to another dashboard section (falls back to a plain link). */
  onNavigate?: (section: string) => void
}

const MASK = '••••••••••••'
const KEY_UNAVAILABLE = '此金鑰無法顯示完整內容'

export default function Overview({ userInfo, apiKeys, onCreateKey, onDeleteKey, onNavigate }: OverviewProps) {
  const [showNewKey, setShowNewKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const used = userInfo?.credits_used ?? 0
  const total = userInfo?.monthly_credits ?? 1000
  const pct = Math.min((used / total) * 100, 100)

  const activeKeys = apiKeys.filter((k) => !k.revoked)
  const defaultKey = activeKeys[0]

  const handleCreate = async () => {
    setCreating(true)
    setCreateError(null)
    try {
      const result = await onCreateKey(newKeyName.trim() || 'default')
      if (!result) {
        // Non-OK response: keep the form open so the user can retry.
        setCreateError('建立金鑰失敗，請稍後再試。')
        return
      }
      if (result.full_key) setCreatedKey(result.full_key)
      setNewKeyName('')
      setShowNewKey(false)
    } catch (e) {
      console.error('Failed to create API key:', e)
      setCreateError('建立金鑰失敗（網路或登入狀態異常），請稍後再試。')
    } finally {
      setCreating(false)
    }
  }

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copy = async (text: string, id: string) => {
    if (await copyText(text)) {
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    }
  }

  // The API authenticates on the full key (`key_prefix = ? AND key_hash = ?`),
  // so a key without `full_key` cannot be shown, copied or used anywhere.
  const keyDisplay = (key: ApiKey) => {
    if (!visibleKeys.has(key.id)) return key.key_prefix + MASK
    return key.full_key || KEY_UNAVAILABLE
  }

  const mcpCommand = defaultKey?.full_key
    ? `claude mcp add --transport http kaiwu https://kaiwu.dev/mcp --header "Authorization: Bearer ${defaultKey.full_key}"`
    : ''

  const renderActions = (key: ApiKey) => {
    const visible = visibleKeys.has(key.id)
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => toggleKeyVisibility(key.id)}
          className="btn btn-ghost btn-icon"
          aria-label={visible ? `隱藏金鑰 ${key.name}` : `顯示金鑰 ${key.name}`}
          aria-pressed={visible}
        >
          {visible ? <Icon.EyeOff size={18} /> : <Icon.Eye size={18} />}
        </button>
        <button
          type="button"
          onClick={() => key.full_key && copy(key.full_key, key.id)}
          disabled={!key.full_key}
          className="btn btn-ghost btn-icon"
          aria-label={key.full_key ? `複製金鑰 ${key.name}` : `${KEY_UNAVAILABLE}，無法複製 ${key.name}`}
          title={key.full_key ? undefined : KEY_UNAVAILABLE}
        >
          {copiedId === key.id ? <Icon.Check size={18} className="text-success" /> : <Icon.Copy size={18} />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`確定要刪除金鑰「${key.name}」？此操作無法復原。`)) onDeleteKey(key.id)
          }}
          className="btn btn-ghost btn-icon text-danger hover:text-danger hover:bg-danger/10"
          aria-label={`刪除金鑰 ${key.name}`}
        >
          <Icon.Trash size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow mb-1">OVERVIEW · 總覽</div>
        <h1 className="text-2xl font-bold text-fg">總覽</h1>
      </div>

      {/* Plan */}
      <section className="card mb-6" aria-labelledby="plan-heading">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="plan-heading" className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
              免費方案 · 限時免費
              <span className="badge badge-accent">Free</span>
            </h2>
            <p className="mt-1 text-sm text-fg-muted">每月 {total.toLocaleString()} 點搜尋額度</p>
          </div>
          <div className="text-sm text-fg-muted tabular-nums">
            <span className="font-semibold text-fg">{used.toLocaleString()}</span> / {total.toLocaleString()} 點
          </div>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={used}
          aria-label="本月已使用額度"
        >
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-fg-muted">
          <Icon.Info size={14} className="mt-0.5 text-filament" />
          <span>付費方案籌備中，目前所有功能限時免費使用（每月 1,000 額度）。</span>
        </p>
      </section>

      {/* Created key banner (live region stays mounted so announcements work) */}
      <div aria-live="polite" role="status">
        {createdKey && (
          <div className="card-inset mb-6 border-success/40 bg-success/10">
            <div className="mb-2 flex items-start gap-2 text-sm font-semibold text-[#4ade80]">
              <Icon.Check size={18} className="mt-0.5" />
              <span>金鑰已建立。請立即複製，此金鑰不會再次完整顯示。</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-bg px-3 py-2 font-mono text-sm text-fg">
                {createdKey}
              </code>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(createdKey, 'created')}
                  className="btn btn-primary btn-sm"
                >
                  {copiedId === 'created' ? <Icon.Check size={16} /> : <Icon.Copy size={16} />}
                  {copiedId === 'created' ? '已複製' : '複製'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedKey(null)}
                  className="btn btn-ghost btn-sm"
                  aria-label="關閉金鑰提示"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API keys */}
      <section className="card mb-6" aria-labelledby="keys-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="keys-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Icon.Key size={18} className="text-fg-muted" />
            API 金鑰
          </h2>
          {!showNewKey && (
            <button type="button" onClick={() => setShowNewKey(true)} className="btn btn-primary btn-sm">
              <Icon.Plus size={16} />
              建立金鑰
            </button>
          )}
        </div>

        {showNewKey && (
          <form
            className="card-inset mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (!creating) handleCreate()
            }}
          >
            <div className="flex-1">
              <label htmlFor="new-key-name" className="field-label">
                金鑰名稱（選填）
              </label>
              <input
                id="new-key-name"
                type="text"
                placeholder="例如：production"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="input"
                autoFocus
                maxLength={64}
                aria-invalid={createError ? true : undefined}
                aria-describedby={createError ? 'new-key-error' : undefined}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="btn btn-primary">
                {creating ? '建立中…' : '建立'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewKey(false)
                  setCreateError(null)
                }}
                className="btn btn-ghost"
              >
                取消
              </button>
            </div>
          </form>
        )}
        {showNewKey && createError && (
          <p id="new-key-error" role="alert" className="mb-4 flex items-start gap-2 text-xs text-danger">
            <Icon.Warning size={15} className="mt-0.5 shrink-0" />
            {createError}
          </p>
        )}

        {activeKeys.length === 0 ? (
          <div className="card-inset flex flex-col items-center py-10 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon.Key size={22} />
            </span>
            <p className="text-sm text-fg-muted">尚無 API 金鑰。</p>
            <p className="text-xs text-fg-subtle">點「建立金鑰」建立你的第一把金鑰。</p>
          </div>
        ) : (
          <>
            {/* ≥ sm: table */}
            <div className="table-wrap hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-fg-subtle">
                    <th className="py-2 pr-3 font-medium">名稱</th>
                    <th className="py-2 pr-3 font-medium">類型</th>
                    <th className="py-2 pr-3 font-medium">用量</th>
                    <th className="py-2 pr-3 font-medium">金鑰</th>
                    <th className="py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((key) => (
                    <tr key={key.id} className="border-t border-line">
                      <td className="py-3 pr-3 font-medium text-fg">{key.name}</td>
                      <td className="py-3 pr-3">
                        <span className="badge badge-filament">{key.type === 'dev' ? '開發' : key.type}</span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-fg-muted">{key.usage_count}</td>
                      <td className="py-3 pr-3 font-mono text-xs text-fg-muted">{keyDisplay(key)}</td>
                      <td className="py-2 text-right">{renderActions(key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* < sm: stacked cards */}
            <ul className="space-y-3 sm:hidden">
              {activeKeys.map((key) => (
                <li key={key.id} className="card-inset">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-fg">{key.name}</span>
                    <span className="badge badge-filament">{key.type === 'dev' ? '開發' : key.type}</span>
                  </div>
                  <code className="block break-all font-mono text-xs text-fg-muted">{keyDisplay(key)}</code>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-fg-subtle tabular-nums">用量 {key.usage_count}</span>
                    {renderActions(key)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* MCP quick start */}
      {defaultKey && (
        <section className="card" aria-labelledby="mcp-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="mcp-heading" className="flex items-center gap-2 text-lg font-semibold text-fg">
              <Icon.Plug size={18} className="text-fg-muted" />
              遠端 MCP
            </h2>
            <a
              href="/dashboard/mcp"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault()
                  onNavigate('mcp')
                }
              }}
              className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
            >
              更多設定方式
              <Icon.ArrowRight size={16} />
            </a>
          </div>
          <p className="mb-4 text-sm text-fg-muted leading-relaxed">
            在 Claude Code 貼上這行，AI 就能直接使用開物搜尋（使用「{defaultKey.name}」金鑰）：
          </p>
          {mcpCommand ? (
            <div className="code-panel">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
                <span className="text-xs text-fg-subtle">Claude Code</span>
                <button
                  type="button"
                  onClick={() => copy(mcpCommand, 'mcp')}
                  className="btn btn-ghost btn-sm"
                  aria-label="複製 Claude Code 指令"
                >
                  {copiedId === 'mcp' ? <Icon.Check size={14} className="text-success" /> : <Icon.Copy size={14} />}
                  {copiedId === 'mcp' ? '已複製' : '複製'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-all">
                <code>{mcpCommand}</code>
              </pre>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-xs text-warning">
              <Icon.Warning size={15} className="mt-0.5 shrink-0" />
              {KEY_UNAVAILABLE}，無法產生設定指令；請建立新金鑰。
            </p>
          )}
        </section>
      )}
    </div>
  )
}
