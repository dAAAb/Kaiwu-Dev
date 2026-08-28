import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Sidebar, { LogoutButton, SECTION_TITLES } from '../components/Sidebar'
import { Icon } from '../components/Icons'
import Overview from '../components/Overview'
import Playground from '../components/Playground'
import Billing from '../components/Billing'
import Settings from '../components/Settings'
import McpSection from '../components/McpSection'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  type: string
  usage_count: number
  created_at: string
  revoked: number
  full_key?: string // present on creation + auth callback
}

export interface UserInfo {
  id: string
  email: string | null
  monthly_credits: number
  credits_used: number
}

// ---------------------------------------------------------------------------
// Presentational shell (sidebar + mobile app bar + main). No Privy / router
// inside so it can be rendered in isolation (previews, tests).
// ---------------------------------------------------------------------------
interface ShellProps {
  active: string
  onNavigate: (section: string) => void
  userEmail: string
  logoutSlot?: ReactNode
  children: ReactNode
}

export function DashboardShell({ active, onNavigate, userEmail, logoutSlot, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    // Return focus to the control that opened the drawer.
    toggleRef.current?.focus()
  }, [])

  const handleNavigate = (section: string) => {
    closeDrawer() // close on navigation and return focus to the toggle
    onNavigate(section)
  }

  const title = SECTION_TITLES[active] ?? SECTION_TITLES.overview

  return (
    <div className="min-h-screen bg-bg text-[15px]">
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        userEmail={userEmail}
        open={drawerOpen}
        onClose={closeDrawer}
        logoutSlot={logoutSlot}
      />

      {/* Mobile app bar (48px) */}
      <header className="md:hidden sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-2 backdrop-blur">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn btn-ghost btn-icon"
          aria-label="開啟選單"
          aria-controls="dashboard-drawer"
          aria-expanded={drawerOpen}
        >
          <Icon.Menu />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</h2>
        <span className="flex min-w-0 max-w-[45%] items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-fg-muted">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold uppercase text-accent">
            {(userEmail || 'U').charAt(0)}
          </span>
          <span className="truncate">{userEmail || '使用者'}</span>
        </span>
      </header>

      <main id="dashboard-main" className="md:pl-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="max-w-4xl space-y-6" aria-busy="true" aria-label="載入儀表板">
      <div className="skeleton h-8 w-32" />
      <div className="card space-y-4">
        <div className="skeleton h-5 w-48" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
      </div>
      <div className="card space-y-3">
        <div className="skeleton h-5 w-32" />
        <div className="skeleton h-10 w-full" />
        <div className="skeleton h-10 w-full" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const { authenticated, ready, login, getAccessToken, user } = usePrivy()
  const navigate = useNavigate()
  const { section } = useParams()
  const activeSection = section || 'overview'

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)

  // Privy re-creates `login` and `getAccessToken` on every provider render
  // (they are inline arrows, not memoised). Keeping them in refs lets the
  // effect below depend only on `ready` / `authenticated`, so it cannot
  // re-fire on each render and start a request storm.
  const loginRef = useRef(login)
  loginRef.current = login
  const getAccessTokenRef = useRef(getAccessToken)
  getAccessTokenRef.current = getAccessToken
  const loginRequestedRef = useRef(false)
  // In-flight fetch (if any). Concurrent callers share it instead of starting
  // a second request, which is what keeps the StrictMode double-fire from
  // looping.
  const fetchInFlightRef = useRef<Promise<void> | null>(null)
  // Set when a caller asked for a *fresh* fetch while one was already running
  // (e.g. delete B while the refresh for delete A is still pending). The loop
  // in fetchUserData runs one trailing fetch so the last mutation is never
  // dropped.
  const refetchQueuedRef = useRef(false)
  // Bumped on logout so a fetch started under the previous session cannot
  // write that account's data into state after the reset.
  const sessionGenRef = useRef(0)

  const loadOnce = useCallback(async () => {
    const gen = sessionGenRef.current
    try {
      const token = await getAccessTokenRef.current()
      if (!token) return

      // Auth callback - ensure user exists + get keys
      const authRes = await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      })
      if (gen !== sessionGenRef.current) return // logged out meanwhile
      if (authRes.ok) {
        const data = await authRes.json()
        if (gen !== sessionGenRef.current) return
        setUserInfo(data.user)
        if (data.keys) setApiKeys(data.keys)
      }
    } catch (e) {
      console.error('Failed to fetch user data:', e)
    } finally {
      if (gen === sessionGenRef.current) setLoading(false)
    }
  }, [])

  /**
   * Fetch user + keys. Calls are coalesced:
   * - `'coalesce'` (default, used by the mount effect): if a fetch is already
   *   running, just await it.
   * - `'fresh'` (used after create/delete): if a fetch is already running,
   *   queue exactly one trailing fetch after it so the caller is guaranteed
   *   to observe state from *after* its mutation.
   */
  const fetchUserData = useCallback(
    (mode: 'coalesce' | 'fresh' = 'coalesce'): Promise<void> => {
      if (fetchInFlightRef.current) {
        if (mode === 'fresh') refetchQueuedRef.current = true
        return fetchInFlightRef.current
      }
      const run = (async () => {
        do {
          refetchQueuedRef.current = false
          await loadOnce()
        } while (refetchQueuedRef.current)
      })().finally(() => {
        fetchInFlightRef.current = null
      })
      fetchInFlightRef.current = run
      return run
    },
    [loadOnce],
  )

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      // Logged out (or never logged in): drop the previous account's data so
      // the next login shows the skeleton until its own callback resolves,
      // never the old user's keys.
      sessionGenRef.current += 1
      setUserInfo(null)
      setApiKeys([])
      setLoading(true)
      // Open the Privy modal exactly once per unauthenticated visit.
      if (!loginRequestedRef.current) {
        loginRequestedRef.current = true
        loginRef.current()
      }
      return
    }
    loginRequestedRef.current = false // allow the prompt again after logout
    fetchUserData()
  }, [ready, authenticated, fetchUserData])

  const createApiKey = async (name: string) => {
    const token = await getAccessToken()
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const data = await res.json()
      // Refresh keys list and add the full key to show once
      await fetchUserData('fresh')
      return data.key as ApiKey & { full_key: string }
    }
    return null
  }

  const deleteApiKey = async (keyId: string) => {
    const token = await getAccessToken()
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key_id: keyId }),
    })
    await fetchUserData('fresh')
  }

  const userEmail = user?.email?.address || userInfo?.email || ''
  const handleNavigate = (s: string) => navigate(s === 'overview' ? '/dashboard' : `/dashboard/${s}`)

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="skeleton h-6 w-40" aria-label="載入中" />
      </div>
    )
  }

  if (!authenticated) {
    // Privy modal was opened once by the effect; if the user closed it, let
    // them reopen it instead of staring at a spinner.
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="card w-full max-w-sm text-center">
          <Icon.Logo size={48} className="mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-fg">登入開物 Kaiwu</h1>
          <p className="mt-2 text-sm text-fg-muted leading-relaxed">
            登入後即可取得 API 金鑰。限時免費 · 每月 1,000 額度 · 不用信用卡。
          </p>
          <button type="button" onClick={() => login()} className="btn btn-primary mt-5 w-full">
            登入 / 註冊
          </button>
          <a href="/" className="mt-3 inline-block text-sm text-fg-muted hover:text-fg">
            回到首頁
          </a>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'playground':
        return <Playground apiKeys={apiKeys} />
      case 'billing':
        return <Billing userInfo={userInfo} />
      case 'settings':
        return <Settings userInfo={userInfo} />
      case 'mcp':
        return <McpSection apiKeys={apiKeys} />
      default:
        return (
          <Overview
            userInfo={userInfo}
            apiKeys={apiKeys}
            onCreateKey={createApiKey}
            onDeleteKey={deleteApiKey}
            onNavigate={handleNavigate}
          />
        )
    }
  }

  return (
    <DashboardShell
      active={activeSection}
      onNavigate={handleNavigate}
      userEmail={userEmail}
      logoutSlot={<LogoutButton />}
    >
      {loading ? <DashboardSkeleton /> : renderContent()}
    </DashboardShell>
  )
}
