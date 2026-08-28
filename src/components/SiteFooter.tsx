import { Logo } from './SiteHeader'

declare const __BUILD_YEAR__: number

/** Email wrapped in Cloudflare's email_off comments so Email Obfuscation leaves it readable. */
export function EmailOff({ address, className = '' }: { address: string; className?: string }) {
  return <a href={`mailto:${address}`} className={className} dangerouslySetInnerHTML={{ __html: `<!--email_off-->${address}<!--/email_off-->` }} />
}

const COLS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: '產品',
    links: [
      { href: '/dashboard', label: '儀表板' },
      { href: '/developers', label: '開發者文件' },
      { href: '/cli', label: 'CLI & Agent Skills' },
      { href: '/openapi.json', label: 'OpenAPI 規格' },
      { href: '/llms.txt', label: 'llms.txt' },
    ],
  },
  {
    title: '整合',
    links: [
      { href: '/developers#mcp', label: 'MCP Server' },
      { href: 'https://github.com/dAAAb/Kaiwu-Dev/tree/main/skills', label: 'Claude Code / Cursor Skills', external: true },
      { href: '/developers#quickstart', label: 'REST API' },
      { href: 'https://github.com/dAAAb/Kaiwu-Dev', label: 'GitHub', external: true },
    ],
  },
  {
    title: '公司',
    links: [
      { href: '/about', label: '關於開物' },
      { href: '/contact', label: '聯絡我們' },
      { href: '/privacy', label: '隱私權政策' },
      { href: 'https://canfly.ai', label: 'CanFly.ai', external: true },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-line mt-8">
      <div className="container-x py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-fg-muted leading-relaxed">
              中文世界的 AI 搜尋 API。無審查、繁簡雙語、LLM-ready，台灣部署。
            </p>
            <p className="mt-4 text-xs text-fg-subtle font-mono"><EmailOff address="hello@kaiwu.dev" /></p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow mb-3">{col.title}</h3>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-fg-muted hover:text-fg transition-colors" {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="divider mt-12 pt-6 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-fg-subtle">
          <p>© {__BUILD_YEAR__} 開物 Kaiwu · 天工開物，AI 開啟萬物知識 · Built in Taiwan</p>
          <p className="font-mono">kaiwu.dev/v1 · MCP · CLI</p>
        </div>
      </div>
    </footer>
  )
}
