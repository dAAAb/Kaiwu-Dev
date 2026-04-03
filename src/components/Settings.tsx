import type { UserInfo } from '../pages/Dashboard'

export default function Settings({ userInfo }: { userInfo: UserInfo | null }) {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">設定</h1>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">帳號資訊</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">電子郵件</span>
            <span className="font-mono">{userInfo?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-muted">帳號 ID</span>
            <span className="font-mono text-xs">{userInfo?.id || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted">方案</span>
            <span className="text-accent font-semibold">免費方案</span>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">危險區域</h2>
        <div className="flex items-center justify-between p-4 bg-red-900/10 border border-red-900/30 rounded-xl">
          <div>
            <div className="font-semibold text-red-400">刪除帳號</div>
            <div className="text-muted text-xs">刪除帳號及所有相關資料，此操作無法復原。</div>
          </div>
          <button className="px-4 py-2 bg-red-900/30 text-red-400 rounded-lg text-sm hover:bg-red-900/50 transition-colors">
            刪除帳號
          </button>
        </div>
      </div>
    </div>
  )
}
