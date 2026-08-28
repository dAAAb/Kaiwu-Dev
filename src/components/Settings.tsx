import type { UserInfo } from '../pages/Dashboard'
import { Icon } from './Icons'

const CONTACT = 'hello@kaiwu.dev'
const DELETE_MAILTO = `mailto:${CONTACT}?subject=${encodeURIComponent('刪除帳號')}`

export default function Settings({ userInfo }: { userInfo: UserInfo | null }) {
  const rows = [
    { label: '電子郵件', value: userInfo?.email || '—', mono: true },
    { label: '帳號 ID', value: userInfo?.id || '—', mono: true, small: true },
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow mb-1">SETTINGS · 設定</div>
        <h1 className="text-2xl font-bold text-fg">設定</h1>
      </div>

      {/* Account */}
      <section className="card mb-6" aria-labelledby="account-heading">
        <h2 id="account-heading" className="mb-3 text-lg font-semibold text-fg">
          帳號資訊
        </h2>
        <dl className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt className="shrink-0 text-fg-muted">{r.label}</dt>
              <dd className={`min-w-0 break-all text-fg ${r.mono ? 'font-mono' : ''} ${r.small ? 'text-xs' : ''}`}>
                {r.value}
              </dd>
            </div>
          ))}
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <dt className="shrink-0 text-fg-muted">方案</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-accent">免費方案（限時免費）</span>
              <span className="badge badge-accent">每月 1,000 額度</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Danger zone */}
      <section className="card border-danger/30" aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
          <Icon.Warning size={18} className="text-danger" />
          危險區域
        </h2>
        <div className="card-inset flex flex-col gap-4 border-danger/30 bg-danger/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="font-semibold text-[#f87171]">刪除帳號</div>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              刪除帳號及所有金鑰、用量紀錄，此操作無法復原。目前由我們人工處理：請寄信到{' '}
              <span className="font-mono text-fg">{CONTACT}</span>
              （請用註冊時的信箱寄出），我們確認身分後會回信通知完成。
            </p>
          </div>
          <a href={DELETE_MAILTO} className="btn btn-danger shrink-0">
            <Icon.Mail size={16} />
            寄信申請刪除
          </a>
        </div>
      </section>
    </div>
  )
}
