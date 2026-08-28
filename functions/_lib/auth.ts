// Shared API-key lookup + lazy monthly credit reset.
//
// Used by /v1/search, /v1/extract, /v1/credits and /mcp so the
// `key_prefix = ? AND key_hash = ?` full-key check lives in one place, and by
// /api/auth/callback so the dashboard sees the same reset the API applies.
//
// Not a route: wrangler ignores `_`-prefixed directories under functions/.

export interface DbEnv {
  DB: D1Database
}

export interface ApiKeyRecord {
  id: string
  user_id: string
  credits_used: number
  monthly_credits: number
  credits_reset_at: string | null
}

export interface CreditState {
  credits_used: number
  credits_reset_at: string | null
}

/** ISO timestamp of 00:00:00 UTC on the first day of the month after `now`. */
export function nextMonthlyResetIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
}

function resetIsDue(resetAt: string | null, now: Date): boolean {
  if (!resetAt) return true
  const t = Date.parse(resetAt)
  return !Number.isFinite(t) || t <= now.getTime()
}

/**
 * Lazy monthly reset: if the user's `credits_reset_at` is null or in the past,
 * zero `credits_used` and move the reset date to the first of next month. The
 * UPDATE is guarded on the previously-read value so concurrent requests cannot
 * double-apply it. Returns the credit state to use for the current request.
 */
export async function ensureMonthlyReset(env: DbEnv, userId: string, state: CreditState, now: Date = new Date()): Promise<CreditState> {
  if (!resetIsDue(state.credits_reset_at, now)) return state
  const nextReset = nextMonthlyResetIso(now)
  await env.DB.prepare(
    "UPDATE users SET credits_used = 0, credits_reset_at = ?, updated_at = datetime('now') WHERE id = ? AND (credits_reset_at IS NULL OR credits_reset_at = ?)",
  ).bind(nextReset, userId, state.credits_reset_at).run()
  return { credits_used: 0, credits_reset_at: nextReset }
}

/**
 * Resolve a `kw_…` API key to its key row + owning user's credit state,
 * applying the lazy monthly reset. Returns null for unknown/revoked keys.
 */
export async function lookupApiKey(env: DbEnv, apiKey: string): Promise<ApiKeyRecord | null> {
  const row = await env.DB.prepare(
    'SELECT ak.id, ak.user_id, u.credits_used, u.monthly_credits, u.credits_reset_at FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key_prefix = ? AND ak.key_hash = ? AND ak.revoked = 0',
  ).bind(apiKey.slice(0, 12), apiKey).first<ApiKeyRecord>()
  if (!row) return null
  const state = await ensureMonthlyReset(env, row.user_id, row)
  return { ...row, ...state }
}
