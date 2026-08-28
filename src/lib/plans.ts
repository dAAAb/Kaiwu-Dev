/**
 * Single source of truth for Kaiwu pricing plans.
 *
 * Used by the dashboard (Billing), the landing page pricing grid and the
 * SoftwareApplication JSON-LD offers so the numbers can never drift apart.
 *
 * Model: ONE credit pool per month (search / extract / MCP / CLI all draw from
 * the same pool). There is no separate extract quota and no hard req/s limit.
 */
export interface Plan {
  id: 'free' | 'developer' | 'pro'
  /** Latin name shown as the badge / eyebrow (Free, Developer, Pro). */
  name: string
  /** Chinese display name (免費方案 …). */
  label: string
  /** Display price, e.g. "$0", "$5", "$29". */
  price: string
  /** Billing period / qualifier shown next to the price, e.g. "限時免費", "/ 月". */
  period: string
  /** Monthly credit pool (one pool for search + extract + MCP + CLI). */
  credits: number
  features: string[]
  /** Call-to-action label. */
  cta: string
  /** false = 即將推出 (coming soon, not purchasable yet). */
  available: boolean
}

export const PLAN_CONTACT_EMAIL = 'hello@kaiwu.dev'

/** mailto link for "notify me when paid plans launch". */
export const PLAN_NOTIFY_MAILTO = `mailto:${PLAN_CONTACT_EMAIL}?subject=${encodeURIComponent('Kaiwu 方案推出通知')}`

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Free',
    label: '免費方案',
    price: '$0',
    period: '限時免費',
    credits: 1000,
    features: ['每月 1,000 額度', 'search / extract / MCP / CLI 全功能', '建議 ≈1 req/s', '社群支援'],
    cta: '登入取得金鑰',
    available: true,
  },
  {
    id: 'developer',
    name: 'Developer',
    label: '開發者方案',
    price: '$5',
    period: '/ 月',
    credits: 5000,
    features: ['每月 5,000 額度', '更高併發', 'Email 支援'],
    cta: '即將推出',
    available: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    label: '專業方案',
    price: '$29',
    period: '/ 月',
    credits: 10000,
    features: ['每月 10,000 額度', '最高併發', '深度研究報告（規劃中）'],
    cta: '即將推出',
    available: false,
  },
]

export const FREE_PLAN: Plan = PLANS[0]
