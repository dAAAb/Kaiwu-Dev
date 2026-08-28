import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Icon } from './Icons'

// ---------------------------------------------------------------------------
// Shared dashboard bits (kept here so every dashboard file can import them
// without touching files owned by other engineers).
// ---------------------------------------------------------------------------

export const SECTION_TITLES: Record<string, string> = {
  overview: '總覽',
  playground: 'API 測試場',
  mcp: '開物 MCP',
  billing: '帳單',
  settings: '設定',
}

/** Clipboard helper that never throws (insecure contexts / denied permission). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** The only piece of the sidebar that touches Privy — injected via `logoutSlot`. */
export function LogoutButton() {
  const { logout } = usePrivy()
  return (
    <button type="button" onClick={logout} className="btn btn-ghost btn-sm -mx-2 text-fg-muted">
      登出
    </button>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const menuItems = [
  { id: 'overview', label: '總覽', icon: Icon.ChartBar },
  { id: 'playground', label: 'API 測試場', icon: Icon.Play },
  { id: 'mcp', label: '開物 MCP', icon: Icon.Plug },
  { id: 'billing', label: '帳單', icon: Icon.Credits },
  { id: 'settings', label: '設定', icon: Icon.Settings },
]

const DOCS_URL = 'https://github.com/dAAAb/Kaiwu-Dev'

interface SidebarProps {
  active: string
  onNavigate: (section: string) => void
  userEmail: string
  /** Mobile drawer state (ignored on md+). */
  open?: boolean
  onClose?: () => void
  /** Rendered at the bottom of the sidebar; pass `<LogoutButton />` in the real app. */
  logoutSlot?: ReactNode
}

interface ContentProps extends Omit<SidebarProps, 'open'> {
  variant: 'desktop' | 'drawer'
  closeBtnRef?: RefObject<HTMLButtonElement>
}

function SidebarContent({ active, onNavigate, userEmail, onClose, logoutSlot, variant, closeBtnRef }: ContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-line">
        <a href="/" className="flex items-center gap-2 no-underline">
          <Icon.Logo size={32} />
          <span className="leading-tight">
            <span className="block text-base font-bold text-fg">開物 Kaiwu</span>
            <span className="block text-[11px] text-fg-subtle">AI Search API</span>
          </span>
        </a>
        {variant === 'drawer' && (
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-icon -mr-2"
            aria-label="關閉選單"
          >
            <Icon.Close />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="儀表板導覽">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = active === item.id
            const ItemIcon = item.icon
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 h-10 text-sm text-left transition-colors duration-150 ${
                    isActive
                      ? 'bg-accent-soft text-accent font-semibold'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-2'
                  }`}
                >
                  <ItemIcon size={18} />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
          <li className="pt-2 mt-2 border-t border-line">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 h-10 text-sm text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors duration-150 no-underline"
            >
              <Icon.Book size={18} />
              <span className="flex-1">文件</span>
              <Icon.ExternalLink size={14} className="text-fg-subtle" />
            </a>
          </li>
        </ul>
      </nav>

      <div className="border-t border-line px-5 py-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="badge badge-accent">限時免費</span>
          <span className="text-xs text-fg-subtle">每月 1,000 額度</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted" title={userEmail || undefined}>
            {userEmail || '使用者'}
          </span>
          {logoutSlot}
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ open = false, onClose, ...rest }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Drawer behaviour: scroll lock, Escape, focus in, tab trap, auto-close on md+.
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    const mq = window.matchMedia('(min-width: 768px)')
    const onMq = (e: MediaQueryListEvent) => { if (e.matches) onClose?.() }
    mq.addEventListener('change', onMq)

    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      mq.removeEventListener('change', onMq)
      window.clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <>
      {/* Desktop: fixed 256px rail */}
      <aside className="hidden md:block fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-line">
        <SidebarContent {...rest} variant="desktop" />
      </aside>

      {/* Mobile: backdrop + slide-in drawer */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="dashboard-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="導覽選單"
        aria-hidden={!open}
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-line shadow-2xl transition-[transform,visibility] duration-200 ease-out ${
          open ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <SidebarContent {...rest} onClose={onClose} variant="drawer" closeBtnRef={closeBtnRef} />
      </div>
    </>
  )
}
