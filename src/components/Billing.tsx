import type { UserInfo } from '../pages/Dashboard'

export default function Billing({ userInfo }: { userInfo: UserInfo | null }) {
  const used = userInfo?.credits_used ?? 0
  const total = userInfo?.monthly_credits ?? 1000

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">帳單</h1>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">目前方案</h2>
        <div className="flex items-center justify-between p-4 bg-bg rounded-xl">
          <div>
            <div className="text-accent font-bold text-xl">免費方案</div>
            <div className="text-muted text-sm mt-1">每月 {total.toLocaleString()} 點搜尋額度</div>
          </div>
          <div className="text-3xl font-bold text-white">$0</div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">本月使用量</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-bg rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{used}</div>
            <div className="text-muted text-xs mt-1">已使用</div>
          </div>
          <div className="bg-bg rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{total - used}</div>
            <div className="text-muted text-xs mt-1">剩餘</div>
          </div>
          <div className="bg-bg rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-accent">{total}</div>
            <div className="text-muted text-xs mt-1">總額度</div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">升級方案</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-accent/30 rounded-xl p-6 hover:border-accent transition-colors">
            <div className="text-lg font-bold mb-1">開發者方案</div>
            <div className="text-accent text-2xl font-bold mb-2">$5<span className="text-sm text-muted font-normal">/月</span></div>
            <ul className="text-sm text-muted space-y-1">
              <li>✓ 1,000 searches / 月</li>
              <li>✓ 500 extracts / 月</li>
              <li>✓ 5 req/s</li>
            </ul>
            <button className="mt-4 w-full py-2 bg-accent/10 text-accent rounded-lg text-sm font-semibold hover:bg-accent/20 transition-colors">
              即將推出
            </button>
          </div>
          <div className="border border-border rounded-xl p-6 hover:border-accent/30 transition-colors">
            <div className="text-lg font-bold mb-1">專業方案</div>
            <div className="text-accent text-2xl font-bold mb-2">$29<span className="text-sm text-muted font-normal">/月</span></div>
            <ul className="text-sm text-muted space-y-1">
              <li>✓ 10,000 searches / 月</li>
              <li>✓ 5,000 extracts / 月</li>
              <li>✓ 深度研究報告</li>
            </ul>
            <button className="mt-4 w-full py-2 bg-accent/10 text-accent rounded-lg text-sm font-semibold hover:bg-accent/20 transition-colors">
              即將推出
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
