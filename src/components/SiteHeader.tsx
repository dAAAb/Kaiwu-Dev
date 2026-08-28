import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'

const NAV = [
  { href: '/#how', label: '運作方式' },
  { href: '/developers', label: '開發者' },
  { href: '/cli', label: 'CLI & Skills' },
  { href: '/#pricing', label: '定價' },
  { href: '/about', label: '關於' },
]

export function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="/" className={`inline-flex items-center gap-2.5 text-fg font-semibold ${className}`} aria-label="開物 Kaiwu 首頁">
      <Icon.Logo size={26} />
      <span className="tracking-normal">開物 <span className="text-fg-muted font-medium">Kaiwu</span></span>
    </a>
  )
}

export default function SiteHeader({ cta = { href: '/dashboard', label: '免費開始' } }: { cta?: { href: string; label: string } }) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const navRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'Tab' && navRef.current) {
        const items = [toggleRef.current, ...Array.from(navRef.current.querySelectorAll<HTMLElement>('a, button'))].filter(Boolean) as HTMLElement[]
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    navRef.current?.querySelector<HTMLElement>('a')?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; toggleRef.current?.focus() }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn btn-primary">跳到主要內容</a>
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-1" aria-label="主選單">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="btn btn-ghost h-9 px-3 text-sm">{n.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={cta.href} className="btn btn-primary h-9 hidden sm:inline-flex">{cta.label}</a>
          <button
            type="button"
            ref={toggleRef}
            className="btn btn-ghost btn-icon md:hidden"
            aria-label={open ? '關閉選單' : '開啟選單'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <Icon.Close /> : <Icon.Menu />}
          </button>
        </div>
      </div>

      <div className="md:hidden" hidden={!open}>
        {open && <div className="fixed inset-0 top-16 z-30 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />}
        <nav id="mobile-nav" ref={navRef} aria-label="選單" hidden={!open}
          className="fixed inset-x-0 top-16 z-40 border-b border-line bg-bg p-4 animate-fadeUp">
          <div className="flex flex-col gap-1">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="btn btn-ghost justify-start h-11 text-base" onClick={() => setOpen(false)}>{n.label}</a>
            ))}
            <a href={cta.href} className="btn btn-primary btn-lg mt-2">{cta.label}</a>
          </div>
        </nav>
      </div>
    </header>
  )
}
