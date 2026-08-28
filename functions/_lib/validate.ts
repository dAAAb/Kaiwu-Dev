// Small request-shape helpers shared by the JSON routes.
// Not a route: wrangler ignores `_`-prefixed directories under functions/.

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const TIME_RANGES = ['day', 'week', 'month', 'year', 'all'] as const
export type TimeRange = (typeof TIME_RANGES)[number]

export const SEARCH_CATEGORIES = ['general', 'news'] as const
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number]

export const CATEGORY_INPUTS = ['general', 'news', 'auto'] as const
export type CategoryInput = (typeof CATEGORY_INPUTS)[number]

export const MAX_RESULTS_DEFAULT = 5
export const MAX_RESULTS_CAP = 20

/**
 * Normalise `max_results`: omitted / null / 0 → default 5; a positive integer
 * (number or numeric string) → clamped to 20; anything else → null (invalid).
 */
export function parseMaxResults(raw: unknown): number | null {
  if (raw === undefined || raw === null) return MAX_RESULTS_DEFAULT
  if (typeof raw !== 'number' && typeof raw !== 'string') return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n === 0 ? MAX_RESULTS_DEFAULT : Math.min(n, MAX_RESULTS_CAP)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}

export function isSearchCategory(v: unknown): v is SearchCategory {
  return typeof v === 'string' && (SEARCH_CATEGORIES as readonly string[]).includes(v)
}

export function isCategoryInput(v: unknown): v is CategoryInput {
  return typeof v === 'string' && (CATEGORY_INPUTS as readonly string[]).includes(v)
}
