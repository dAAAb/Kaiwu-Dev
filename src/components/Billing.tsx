import type { UserInfo } from '../pages/Dashboard'
import { Icon } from './Icons'
import { FREE_PLAN, PLANS, PLAN_CONTACT_EMAIL, PLAN_NOTIFY_MAILTO } from '../lib/plans'

export default function Billing({ userInfo }: { userInfo: UserInfo | null }) {
  const used = userInfo?.credits_used ?? 0
  const total = userInfo?.monthly_credits ?? FREE_PLAN.credits
  const remaining = Math.max(total - used, 0)

  const stats = [
    { label: '已使用', value: used, cls: 'text-fg' },
    { label: '剩餘', value: remaining, cls: 'text-[#4ade80]' },
    { label: '總額度', value: total, cls: 'text-accent' },
  ]

  return (
    <div className="max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="eyebrow mb-1">BILLING · 帳單</div>
        <h1 className="text-2xl font-bold text-fg">帳單</h1>
      </div>

      {/* Current plan */}
      <section className="card mb-6" aria-labelledby="current-plan">
        <h2 id="current-plan" className="mb-4 text-lg font-semibold text-fg">
          目前方案
        </h2>
        <div className="card-inset flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-bold text-accent">
                {FREE_PLAN.label} · {FREE_PLAN.period}
              </span>
              <span className="badge badge-accent">{FREE_PLAN.name}</span>
            </div>
            <p className="mt-1 text-sm text-fg-muted">每月 {total.toLocaleString()} 額度 · 不用信用卡</p>
          </div>
          <div className="text-3xl font-bold text-fg tabular-nums">
            {FREE_PLAN.price}
            <span className="ml-1 text-sm font-normal text-fg-muted">/月</span>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-filament/30 bg-filament-soft px-3 py-2.5 text-sm text-fg">
          <Icon.Info size={16} className="mt-0.5 shrink-0 text-filament" />
          <span>
            付費方案籌備中，目前所有功能限時免費使用（每月 {FREE_PLAN.credits.toLocaleString()} 額度）。
            search、extract、MCP、CLI 共用同一個額度池。
          </span>
        </p>
      </section>

      {/* Usage */}
      <section className="card mb-6" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="mb-4 text-lg font-semibold text-fg">
          本月使用量
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="card-inset flex items-baseline justify-between sm:block sm:text-center">
              <dt className="text-xs text-fg-muted sm:order-2 sm:mt-1">{s.label}</dt>
              <dd className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Plans */}
      <section className="card" aria-labelledby="plans-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="plans-heading" className="text-lg font-semibold text-fg">
            方案
          </h2>
          <span className="badge badge-neutral">付費方案籌備中</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === FREE_PLAN.id
            return (
              <div
                key={plan.id}
                className={`card-inset flex flex-col ${isCurrent ? 'border-accent/40' : ''}`}
                aria-label={`${plan.label}（${plan.name}）`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-lg font-bold text-fg">{plan.label}</span>
                  {plan.available ? (
                    <span className="badge badge-success">{isCurrent ? '目前方案' : '可用'}</span>
                  ) : (
                    <span className="badge badge-neutral">即將推出</span>
                  )}
                </div>
                <div className="mb-1 eyebrow">{plan.name}</div>
                <div className="mb-3 text-2xl font-bold text-accent tabular-nums">
                  {plan.price}
                  <span className="ml-1 text-sm font-normal text-fg-muted">{plan.period}</span>
                </div>
                <ul className="mb-4 space-y-1.5 text-sm text-fg-muted">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Icon.Check size={15} className="shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.available ? (
                  <button type="button" disabled className="btn btn-secondary mt-auto w-full" aria-disabled="true">
                    {isCurrent ? '使用中' : plan.cta}
                  </button>
                ) : (
                  <div className="mt-auto flex flex-col gap-2">
                    <button type="button" disabled className="btn btn-primary w-full opacity-60" aria-disabled="true">
                      {plan.cta}
                    </button>
                    <a href={PLAN_NOTIFY_MAILTO} className="link inline-flex items-center justify-center gap-1 text-xs">
                      <Icon.Mail size={14} />
                      推出時通知我
                    </a>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-fg-subtle">
          額度計算：basic 搜尋 1、advanced 2、include_answer +1；extract 每個成功網址 1。所有方案共用同一個額度池，沒有硬性的每秒請求上限。
        </p>
        <p className="mt-2 text-sm text-fg-muted">
          需要更高額度或併發？寫信到{' '}
          <a href={PLAN_NOTIFY_MAILTO} className="link inline-flex items-center gap-1">
            <Icon.Mail size={15} />
            {PLAN_CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </div>
  )
}
